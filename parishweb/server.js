import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import sql from 'mssql';
import { Resend } from 'resend';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import {
  servicePolicy,
  findScheduleConflict,
  findIntentionConflict,
  financeActionForStatus,
  financeTransition,
  isNoShowEligible,
  isUnverifiedExpired,
  ALLOWED_REQUEST_STATUSES,
  isAllowedArchiveUpload,
  isAllowedImageUpload,
  hasValidImageSignature,
  isValidGalleryContent,
  isValidNewsContent,
  toCsv,
  OVERRIDABLE_MODULES,
  moduleForPath,
  overrideDecision,
} from './server-rules.js';
import { hashAspNetPassword } from './password-hash.js';
import { deleteServiceRequest } from './src/service-request-deletion.js';
import { certificateRequestEmail, passwordResetEmail, serviceBookingEmail } from './email-templates.js';
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidPasswordResetToken,
  isValidResetPassword,
} from './password-reset.js';

// Connection pool - simple implementation
let pool = null;

async function initializePool(config) {
  if (pool) return pool;
  pool = new sql.ConnectionPool(config);
  pool.on('error', (err) => {
    console.error('Pool error:', err);
    pool = null;
  });
  await pool.connect();
  console.log('Database pool connected');
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database pool not initialized');
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database pool closed');
  }
}

// Simple logger (fallback)
const logger = {
  info: (msg, data) => console.log('[INFO]', msg, data || ''),
  warn: (msg, data) => console.warn('[WARN]', msg, data || ''),
  error: (msg, data) => console.error('[ERROR]', msg, data || ''),
};

const requestLoggingMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
};

const logError = (msg, data) => logger.error(msg, data);
const logEmail = (msg, data) => logger.info('[EMAIL] ' + msg, data);
const logAuth = (msg, data) => logger.info('[AUTH] ' + msg, data);

let totalRequests = 0;
const metricsMiddleware = (_req, _res, next) => {
  totalRequests += 1;
  next();
};

function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function previousCompletedPeriods(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = today.getUTCDay() || 7;
  const currentMonday = new Date(today);
  currentMonday.setUTCDate(today.getUTCDate() - day + 1);
  const weekStart = new Date(currentMonday);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekEnd = new Date(currentMonday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() - 1);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return [
    { type: 'Weekly', start: dateOnly(weekStart), end: dateOnly(weekEnd) },
    { type: 'Monthly', start: dateOnly(monthStart), end: dateOnly(monthEnd) },
  ];
}

async function generateFinanceSnapshots() {
  const db = getPool();
  for (const period of previousCompletedPeriods()) {
    const totals = await db.request()
      .input('start', sql.Date, period.start)
      .input('end', sql.Date, period.end)
      .query(`SELECT COALESCE(SUM(CASE WHEN EntryType <> 'Expense' THEN Amount ELSE 0 END), 0) AS income, COALESCE(SUM(CASE WHEN EntryType = 'Expense' THEN Amount ELSE 0 END), 0) AS expenses FROM dbo.FinancialEntries WHERE EntryDate BETWEEN @start AND @end AND Status IN ('Approved','Reconciled')`);
    const row = totals.recordset[0] || { income: 0, expenses: 0 };
    await db.request()
      .input('type', sql.VarChar(20), period.type)
      .input('start', sql.Date, period.start)
      .input('end', sql.Date, period.end)
      .input('income', sql.Decimal(14, 2), Number(row.income || 0))
      .input('expenses', sql.Decimal(14, 2), Number(row.expenses || 0))
      .input('net', sql.Decimal(14, 2), Number(row.income || 0) - Number(row.expenses || 0))
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ generatedAutomatically: true }))
      .input('by', sql.NVarChar(256), 'System')
      .query(`MERGE dbo.FinanceReportSnapshots AS target USING (SELECT @type AS ReportType, @start AS PeriodStart, @end AS PeriodEnd) AS source ON target.ReportType=source.ReportType AND target.PeriodStart=source.PeriodStart AND target.PeriodEnd=source.PeriodEnd WHEN MATCHED THEN UPDATE SET TotalIncome=@income, TotalExpenses=@expenses, NetTotal=@net, Details=@details, GeneratedAt=SYSUTCDATETIME(), GeneratedBy=@by WHEN NOT MATCHED THEN INSERT (ReportType, PeriodStart, PeriodEnd, TotalIncome, TotalExpenses, NetTotal, Details, GeneratedBy) VALUES (@type,@start,@end,@income,@expenses,@net,@details,@by);`);
  }
}

function startFinanceReportSchedule(intervalHours = 6) {
  const run = () => generateFinanceSnapshots().catch(error => logError(error, { context: 'financeReportSchedule' }));
  run();
  setInterval(run, intervalHours * 60 * 60 * 1000);
}

/**
 * Automatic appointment voiding. Confirmed appointments whose scheduled time
 * has passed without attendance being marked become no-shows, and stale
 * unverified bookings expire so their slots are released (the ActiveSlotKey
 * trigger clears the slot lock for non-active statuses).
 */
async function voidNoShowAppointments() {
  const db = getPool();
  const now = new Date();
  const candidates = await db.request().query(`
    SELECT ServiceRequestId, Status, ScheduledDate, ScheduledTime, AttendanceStatus, CreatedAt
    FROM dbo.ServiceRequest
    WHERE Status IN ('Confirmed', 'PendingVerification')
  `);
  const normalized = candidates.recordset.map(row => ({
    id: row.ServiceRequestId,
    status: row.Status,
    scheduledDate: row.ScheduledDate,
    scheduledTime: row.ScheduledTime instanceof Date ? formatTime(row.ScheduledTime) : String(row.ScheduledTime || '00:00').slice(0, 5),
    attendanceStatus: row.AttendanceStatus,
    createdAt: row.CreatedAt,
  }));
  const noShows = normalized.filter(row => isNoShowEligible(row, now));
  const expired = normalized.filter(row => isUnverifiedExpired(row, now));
  for (const row of noShows) {
    await db.request().input('id', sql.Int, row.id).query(`UPDATE dbo.ServiceRequest SET Status='VoidedNoShow', AttendanceStatus='NoShow', AttendanceMarkedAt=SYSUTCDATETIME(), VoidedAt=SYSUTCDATETIME() WHERE ServiceRequestId=@id AND Status='Confirmed'`);
  }
  for (const row of expired) {
    await db.request().input('id', sql.Int, row.id).query(`UPDATE dbo.ServiceRequest SET Status='Voided', VoidedAt=SYSUTCDATETIME() WHERE ServiceRequestId=@id AND Status='PendingVerification'`);
  }
  if (noShows.length || expired.length) {
    logger.info('Automatic appointment voiding completed', { noShows: noShows.length, expiredUnverified: expired.length });
  }
}

function startNoShowVoidSchedule(intervalMinutes = 60) {
  const run = () => voidNoShowAppointments().catch(error => logError(error, { context: 'noShowVoidSchedule' }));
  run();
  setInterval(run, intervalMinutes * 60 * 1000);
}

const handleHealthCheck = (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
};

const handleMetricsRequest = (_req, res) => {
  res.json({ totalRequests, uptime: process.uptime() });
};

// Token management - using database storage for persistence across restarts
const createVerificationToken = async (requestId) => {
  try {
    const pool = getPool();
    // Generate a secure random token
    const token = randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await pool.request()
      .input('token', sql.VarChar(64), token)
      .input('requestId', sql.Int, requestId)
      .input('expiresAt', sql.DateTime2, expiresAt)
      .query(`
      INSERT INTO dbo.VerificationTokens (Token, ServiceRequestId, ExpiresAt)
      VALUES (@token, @requestId, @expiresAt)
    `);
    return token;
  } catch (error) {
    logError(error, { context: 'createVerificationToken' });
    // Fallback to random string if DB fails (shouldn't happen in production)
    return Math.random().toString(36).substring(2, 15);
  }
};

const verifyToken = async (token) => {
  try {
    const pool = getPool();
    const result = await pool.request()
      .input('token', sql.VarChar(64), token)
      .query(`
      SELECT ServiceRequestId
      FROM dbo.VerificationTokens
      WHERE Token = @token
        AND Used = 0
        AND ExpiresAt > GETUTCDATETIME()
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    const requestId = result.recordset[0].ServiceRequestId;

    // Mark token as used
    await pool.request()
      .input('token', sql.VarChar(64), token)
      .query(`
      UPDATE dbo.VerificationTokens
      SET Used = 1, UsedAt = GETUTCDATETIME()
      WHERE Token = @token
    `);

    return requestId;
  } catch (error) {
    logError(error, { context: 'verifyToken' });
    return null;
  }
};

const startTokenCleanupSchedule = (intervalMinutes = 60) => {
  setInterval(async () => {
    try {
      const pool = getPool();
      await pool.request().query(`
        DELETE FROM dbo.VerificationTokens
        WHERE ExpiresAt < GETUTCDATETIME()
      `);
      logger.info('Expired verification tokens cleaned up');
    } catch (error) {
      logError(error, { context: 'tokenCleanup' });
    }
  }, intervalMinutes * 60 * 1000);
};

dotenv.config();

const app = express();
const trustProxyHopsValue = process.env.TRUST_PROXY_HOPS ?? '0';
if (!/^\d+$/.test(trustProxyHopsValue) || !Number.isSafeInteger(Number(trustProxyHopsValue))) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', Number(trustProxyHopsValue));

const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

const contactRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many messages sent. Please try again later.' },
});

const uploadDirectory = path.resolve(process.env.UPLOADS_DIR || 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const configuredPublicUploadBaseUrl = (process.env.PUBLIC_UPLOAD_BASE_URL || '').trim().replace(/\/+$/, '');
const azureStorageAccountName = (process.env.AZURE_STORAGE_ACCOUNT_NAME || '').trim();
const azureStorageAccountKey = (process.env.AZURE_STORAGE_ACCOUNT_KEY || '').trim();
const azureStorageContainer = (process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads').trim();
const azureStorageConnectionString = (process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();

function buildPublicUploadUrl(filename) {
  const safeFilename = String(filename || '').trim();
  if (!safeFilename) return '';

  if (configuredPublicUploadBaseUrl) {
    const normalizedBase = configuredPublicUploadBaseUrl.replace(/\/+$/, '');
    const looksLikeFullFileUrl = /^https?:\/\//i.test(safeFilename);
    if (looksLikeFullFileUrl) return safeFilename;
    return `${normalizedBase}/${safeFilename}`;
  }

  if (azureStorageAccountName && azureStorageContainer) {
    return `https://${azureStorageAccountName}.blob.core.windows.net/${azureStorageContainer}/${safeFilename}`;
  }

  return `/uploads/${safeFilename}`;
}

function isAzureConfigured() {
  return Boolean(
    (azureStorageConnectionString || (azureStorageAccountName && azureStorageAccountKey)) &&
    azureStorageContainer
  );
}

async function uploadFileToAzure(file, fileName) {
  if (!isAzureConfigured()) {
    return null;
  }

  const storageClient = azureStorageConnectionString
    ? BlobServiceClient.fromConnectionString(azureStorageConnectionString)
    : new BlobServiceClient(
        `https://${azureStorageAccountName}.blob.core.windows.net`,
        new StorageSharedKeyCredential(azureStorageAccountName, azureStorageAccountKey)
      );

  const containerClient = storageClient.getContainerClient(azureStorageContainer);
  await containerClient.createIfNotExists({ access: 'blob' });

  const extension = path.extname(fileName || file.originalname || '').toLowerCase();
  const objectPath = `${randomUUID()}${extension}`;
  const fileBuffer = await fs.promises.readFile(file.path);

  const blockBlobClient = containerClient.getBlockBlobClient(objectPath);
  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype || 'application/octet-stream',
    },
  });

  return `https://${azureStorageAccountName}.blob.core.windows.net/${azureStorageContainer}/${objectPath}`;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedImageUpload(file.originalname, file.mimetype, 5 * 1024 * 1024)) {
      return callback(new Error('Only JPEG, PNG, and WebP images up to 5 MB are allowed.'));
    }
    callback(null, true);
  },
});

const archiveUpload = multer({
  storage: upload.storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, isAllowedArchiveUpload(file.originalname, file.mimetype, file.size || 0));
  },
});

// CORS configuration - allow localhost and dynamic FRONTEND_URL
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token'],
  maxAge: 3600
};
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());

// Add logging and monitoring middleware
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);
app.use('/api', apiRateLimit);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const dbAuth = (process.env.DB_AUTH || '').toLowerCase();
logger.info('DB startup config:', {
  authMode: dbAuth || '(default)',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishDB',
  user: process.env.DB_USER ? process.env.DB_USER : '(none)'
});

// Build config depending on authentication mode.
// DB_AUTH: 'sql' for SQL Server authentication (user/password),
// 'ntlm' for Windows NTLM with explicit credentials,
// empty/default => integrated authentication (when using msnodesqlv8 driver).
const baseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishDB',
  options: {
    encrypt: true,
    trustServerCertificate: (() => {
      const setting = process.env.DB_TRUST_SERVER_CERTIFICATE;
      if (setting === undefined) return process.env.NODE_ENV !== 'production';
      if (setting.toLowerCase() === 'true') return true;
      if (setting.toLowerCase() === 'false') return false;
      throw new Error('DB_TRUST_SERVER_CERTIFICATE must be true or false.');
    })(),
  },
  port: Number(process.env.DB_PORT || 1433),
};

let config = { ...baseConfig };

if (dbAuth === 'sql') {
  // SQL authentication using username/password
  config = {
    ...baseConfig,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
} else if (dbAuth === 'ntlm') {
  // Explicit Windows credentials over NTLM
  config = {
    ...baseConfig,
    authentication: {
      type: 'ntlm',
      options: {
        domain: process.env.DB_DOMAIN || '',
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
    },
  };
} else {
  // Leave config as baseConfig; for integrated auth you should use msnodesqlv8 driver
  config = baseConfig;
}

const adminSecret = process.env.ADMIN_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'letmein');
if (process.env.NODE_ENV === 'production' && !adminSecret) {
  throw new Error('ADMIN_TOKEN must be configured in production.');
}
const staffTokenLifetimeMs = 8 * 60 * 60 * 1000;

async function sendEmail(to, subject, html) {
  if (!resend) {
    logger.warn('RESEND_API_KEY not configured, skipping email send');
    return null;
  }

  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: html
    });
    if (response.error) {
      logError(response.error.message, {
        action: 'sendEmail',
        statusCode: response.error.statusCode,
        subject,
      });
      return null;
    }
    logEmail('sent', {
      subject,
      messageId: response.data.id,
      timestamp: new Date().toISOString()
    });
    return response;
  } catch (error) {
    logError(error, {
      action: 'sendEmail',
      subject
    });
    return null;
  }
}

function formatTime(date) {
  return date.toISOString().slice(11, 16);
}

function createStaffToken(userId, role, expiresAt = Date.now() + staffTokenLifetimeMs) {
  return `${adminSecret}.${userId}.${role}.${expiresAt}`;
}

function parseStaffToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== adminSecret) return null;
  const userId = Number(parts[1]);
  const role = String(parts[2] || '');
  const expiresAt = Number(parts[3]);
  if (!Number.isInteger(userId) || !role || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { userId, role, email: null, expiresAt };
}

const staffRolePriority = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];

async function requireAdmin(req, res, next) {
  const token = String(req.headers['x-admin-token'] ?? '')
  const staff = parseStaffToken(token);
  if (staff && staff.userId > 0) {
    // Roles can change after sign-in, so use the current database role instead of the one baked into the token.
    try {
      const result = await getPool().request().input('id', sql.Int, staff.userId)
        .query('SELECT r.Name FROM dbo.AspNetUserRoles ur INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId WHERE ur.UserId = @id');
      const names = result.recordset.map(row => row.Name);
      const current = staffRolePriority.find(name => names.includes(name));
      if (!current) return res.status(403).json({ message: 'Admin token is required.' });
      staff.role = current;
    } catch (error) {
      logError(error, { context: 'requireAdminRoleRefresh' });
    }
    try {
      const [overrides, account] = await Promise.all([
        getPool().request().input('id', sql.Int, staff.userId)
          .query('SELECT ModuleName, CanView, CanEdit FROM dbo.UserModulePermissions WHERE UserId = @id'),
        getPool().request().input('id', sql.Int, staff.userId)
          .query('SELECT MustChangePassword FROM dbo.AspNetUsers WHERE UserId = @id'),
      ]);
      staff.overrides = Object.fromEntries(overrides.recordset.map(row => [row.ModuleName, { view: Boolean(row.CanView), edit: Boolean(row.CanEdit) }]));
      staff.mustChangePassword = Boolean(account.recordset[0]?.MustChangePassword);
    } catch (error) {
      logError(error, { context: 'requireAdminPermissionRefresh' });
    }
    if (staff.mustChangePassword && !passwordChangeExemptPaths.includes(req.path)) {
      return res.status(403).json({ message: 'You must change your password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
  }
  if (!staff) {
    logAuth('failed', {
      endpoint: req.path,
      ip: req.ip,
      reason: token ? 'invalid_token' : 'missing_token'
    });
    return res.status(403).json({ message: 'Admin token is required.' })
  }
  req.staff = staff;
  logAuth('success', {
    endpoint: req.path,
    ip: req.ip
  });
  next()
}

const passwordChangeExemptPaths = ['/api/admin/verify', '/api/admin/change-password'];

function requireRole(roles) {
  return (req, res, next) => {
    if (req.staff && req.staff.role !== 'Admin') {
      const action = req.method === 'GET' || req.method === 'HEAD' ? 'view' : 'edit';
      const decision = overrideDecision(req.staff.overrides, moduleForPath(req.originalUrl), action);
      if (decision === true) return next();
      if (decision === false) {
        return res.status(403).json({ message: 'Your account does not have permission for this operation.' });
      }
    }
    if (!req.staff || (!roles.includes(req.staff.role) && req.staff.role !== 'Admin')) {
      return res.status(403).json({ message: 'Your staff role does not have permission for this operation.' });
    }
    next();
  };
}

function requireAdminWithQueryToken(req, res, next) {
  if (!req.headers['x-admin-token'] && typeof req.query.token === 'string') {
    req.headers['x-admin-token'] = req.query.token;
  }
  return requireAdmin(req, res, next);
}

function verifyAspNetPassword(password, storedHash) {
  try {
    const buffer = Buffer.from(String(storedHash || ''), 'base64');
    if (buffer.length !== 49 || buffer[0] !== 0x01) return false;
    const salt = buffer.subarray(1, 17);
    const storedSubkey = buffer.subarray(17, 49);
    const computedSubkey = pbkdf2Sync(password, salt, 10000, 32, 'sha256');
    return timingSafeEqual(storedSubkey, computedSubkey);
  } catch {
    return false;
  }
}

// Parishioner portal authentication is not yet implemented; reject until a real session/token check exists.
async function requirePortal(req, res, next) {
  const token = String(req.headers['x-portal-token'] || req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Portal sign-in is required.' });
  try {
    const result = await getPool().request().input('token', sql.VarChar(64), token).query(`SELECT s.AccountId, a.EmailAddress FROM dbo.ParishionerPortalSessions s JOIN dbo.ParishionerAccounts a ON a.AccountId=s.AccountId WHERE s.SessionToken=@token AND s.ExpiresAt>SYSUTCDATETIME() AND a.IsActive=1`);
    if (!result.recordset[0]) return res.status(401).json({ message: 'Portal session is invalid or expired.' });
    req.portal = result.recordset[0];
    next();
  } catch (error) { logError(error, { context: 'requirePortal' }); res.status(500).json({ message: 'Unable to verify portal session.' }); }
}

app.post('/api/portal/register', authRateLimit, async (req, res) => {
  const { firstName, lastName, email, mobileNumber, address, password } = req.body || {};
  if (!firstName || !lastName || !isValidEmail(String(email || '')) || !password || String(password).length < 8) return res.status(400).json({ message: 'Name, valid email, and an eight-character password are required.' });
  try {
    const db = getPool(); const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.request().input('email', sql.VarChar(255), normalizedEmail).query('SELECT AccountId FROM dbo.ParishionerAccounts WHERE EmailAddress=@email');
    if (existing.recordset.length) return res.status(409).json({ message: 'An account already exists for this email.' });
    const parishioner = await db.request().input('first', sql.NVarChar(510), firstName).input('last', sql.NVarChar(510), lastName).input('email', sql.VarChar(255), normalizedEmail).input('mobile', sql.NVarChar(100), mobileNumber || null).input('address', sql.NVarChar(510), address || null).query('INSERT INTO dbo.Parishioners (FirstName, LastName, EmailAddress, MobileNumber, Address) OUTPUT INSERTED.ParishionerId VALUES (@first,@last,@email,@mobile,@address)');
    await db.request().input('parishionerId', sql.Int, parishioner.recordset[0].ParishionerId).input('email', sql.VarChar(255), normalizedEmail).input('hash', sql.NVarChar(1000), hashAspNetPassword(password)).query('INSERT INTO dbo.ParishionerAccounts (ParishionerId, EmailAddress, PasswordHash) VALUES (@parishionerId,@email,@hash)');
    res.status(201).json({ message: 'Portal account created.' });
  } catch (error) { logError(error, { context: 'portalRegister' }); res.status(500).json({ message: 'Unable to create portal account.' }); }
});

app.post('/api/portal/login', authRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || '');
  try {
    const result = await getPool().request().input('email', sql.VarChar(255), email).query('SELECT TOP 1 a.AccountId, a.PasswordHash, a.EmailAddress FROM dbo.ParishionerAccounts a WHERE a.EmailAddress=@email AND a.IsActive=1'); const account = result.recordset[0];
    if (!account || !verifyAspNetPassword(password, account.PasswordHash)) return res.status(401).json({ message: 'Invalid portal credentials.' });
    const token = randomBytes(32).toString('hex'); await getPool().request().input('token', sql.VarChar(64), token).input('accountId', sql.Int, account.AccountId).input('expires', sql.DateTime2, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).query('INSERT INTO dbo.ParishionerPortalSessions (SessionToken, AccountId, ExpiresAt) VALUES (@token,@accountId,@expires)');
    res.json({ token, email: account.EmailAddress });
  } catch (error) { logError(error, { context: 'portalLogin' }); res.status(500).json({ message: 'Unable to sign in to the portal.' }); }
});

app.get('/api/portal/me', requirePortal, async (req, res) => {
  try { const result = await getPool().request().input('accountId', sql.Int, req.portal.AccountId).query(`SELECT a.AccountId, a.EmailAddress, p.FirstName, p.LastName, p.MobileNumber, p.Address FROM dbo.ParishionerAccounts a JOIN dbo.Parishioners p ON p.ParishionerId=a.ParishionerId WHERE a.AccountId=@accountId`); res.json(result.recordset[0] || {}); } catch (error) { logError(error, { context: 'portalMe' }); res.status(500).json({ message: 'Unable to load portal profile.' }); }
});

app.get('/api/portal/certificate-requests', requirePortal, async (req, res) => {
  try { const result = await getPool().request().input('accountId', sql.Int, req.portal.AccountId).query('SELECT CertificateRequestId, CertificateType, PreferredDate, PreferredTime, Status, Notes, CreatedAt, UpdatedAt FROM dbo.CertificateRequests WHERE AccountId=@accountId ORDER BY CreatedAt DESC'); res.json(result.recordset); } catch (error) { logError(error, { context: 'portalCertificateRequests' }); res.status(500).json({ message: 'Unable to load certificate requests.' }); }
});

// -- Guest certificate endpoints (no auth required) --------------------------

const VALID_CERT_TYPES = ['Baptism', 'Confirmation', 'Marriage', 'Death'];

// Configure a separate multer instance for certificate documents (PDF + images)
const certUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(null, allowed);
  },
});

app.post('/api/certificate-requests', async (req, res) => {
  const { firstName, lastName, email, phone, certificateType, preferredDate, preferredTime, notes } = req.body;

  if (!firstName || !lastName || !isValidEmail(String(email || '')) || !phone) {
    return res.status(400).json({ message: 'Please provide your name, email, and phone number.' });
  }
  if (!VALID_CERT_TYPES.includes(certificateType)) {
    return res.status(400).json({ message: 'Please select a valid certificate type.' });
  }
  if (!isValidDate(preferredDate) || !isFutureDate(preferredDate) || !preferredTime) {
    return res.status(400).json({ message: 'Please provide a valid future date and time.' });
  }

  // Generate a 6-char uppercase hex reference code
  const referenceCode = randomBytes(3).toString('hex').toUpperCase();

  try {
    const block = await findBlockedSlot(getPool(), { date: preferredDate, time: preferredTime, certificate: true });
    if (block) return res.status(409).json({ message: blockedMessage(block) });
    const result = await getPool().request()
      .input('certificateType', sql.VarChar(30), certificateType)
      .input('preferredDate', sql.Date, preferredDate)
      .input('preferredTime', sql.VarChar(10), preferredTime)
      .input('notes', sql.NVarChar(1000), notes ? sanitizeText(notes) : null)
      .input('firstName', sql.NVarChar(100), sanitizeText(firstName))
      .input('lastName', sql.NVarChar(100), sanitizeText(lastName))
      .input('email', sql.VarChar(255), String(email).trim().toLowerCase())
      .input('phone', sql.VarChar(50), sanitizeText(phone))
      .input('referenceCode', sql.VarChar(10), referenceCode)
      .query(`
        INSERT INTO dbo.CertificateRequests
          (CertificateType, PreferredDate, PreferredTime, Notes,
           FirstName, LastName, ContactEmail, ContactPhone, ReferenceCode)
        OUTPUT INSERTED.CertificateRequestId
        VALUES
          (@certificateType, @preferredDate, @preferredTime, @notes,
           @firstName, @lastName, @email, @phone, @referenceCode)
      `);

    const requestId = result.recordset[0].CertificateRequestId;

    // Send confirmation email if configured
    const { subject, html } = certificateRequestEmail({
      firstName,
      certificateType,
      referenceCode,
      preferredDate,
      preferredTime,
    });
    await sendEmail(String(email).trim().toLowerCase(), subject, html);

    res.status(201).json({ requestId, referenceCode });
  } catch (error) {
    logError(error, { context: 'createCertificateRequest' });
    res.status(500).json({ message: 'Unable to submit your certificate request.' });
  }
});

app.post('/api/certificate-requests/:id/documents', (req, res, next) => {
  certUpload.array('documents', 5)(req, res, error => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each file must be smaller than 10 MB.'
        : 'Unable to upload one or more files.';
      return res.status(400).json({ message });
    }
    if (error) return res.status(400).json({ message: 'Only PDF and image files are accepted.' });
    next();
  });
}, async (req, res) => {
  const requestId = Number(req.params.id);
  const referenceCode = String(req.body.referenceCode || '').toUpperCase();

  if (!Number.isInteger(requestId) || requestId <= 0 || !referenceCode) {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Please select at least one file.' });
  }

  try {
    // Verify ownership by matching requestId + referenceCode
    const check = await getPool().request()
      .input('id', sql.Int, requestId)
      .input('ref', sql.VarChar(10), referenceCode)
      .query(`SELECT CertificateRequestId FROM dbo.CertificateRequests WHERE CertificateRequestId = @id AND ReferenceCode = @ref`);

    if (check.recordset.length === 0) {
      return res.status(403).json({ message: 'Reference code does not match this request.' });
    }

    const db = getPool();
    for (const file of req.files) {
      await db.request()
        .input('requestId', sql.Int, requestId)
        .input('originalName', sql.NVarChar(255), file.originalname)
        .input('storedName', sql.NVarChar(255), file.filename)
        .input('fileUrl', sql.NVarChar(500), `/uploads/${file.filename}`)
        .input('mimeType', sql.VarChar(100), file.mimetype)
        .input('fileSize', sql.Int, file.size)
        .query(`
          INSERT INTO dbo.CertificateRequestDocuments
            (CertificateRequestId, OriginalFileName, StoredFileName, FileUrl, MimeType, FileSizeBytes)
          VALUES (@requestId, @originalName, @storedName, @fileUrl, @mimeType, @fileSize)
        `);
    }

    res.json({ message: `${req.files.length} document(s) uploaded successfully.` });
  } catch (error) {
    logError(error, { context: 'uploadCertificateDocuments' });
    res.status(500).json({ message: 'Unable to save uploaded documents.' });
  }
});

app.get('/api/certificate-requests/lookup', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  const ref = String(req.query.ref || '').toUpperCase();

  if (!isValidEmail(email) || !ref) {
    return res.status(400).json({ message: 'Please provide your email and reference code.' });
  }

  try {
    const result = await getPool().request()
      .input('email', sql.VarChar(255), email)
      .input('ref', sql.VarChar(10), ref)
      .query(`
        SELECT CertificateType, PreferredDate, PreferredTime, Status, Notes
        FROM dbo.CertificateRequests
        WHERE ContactEmail = @email AND ReferenceCode = @ref
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'No request found. Check your email and reference code.' });
    }

    const row = result.recordset[0];
    res.json({
      certificateType: row.CertificateType,
      preferredDate: row.PreferredDate,
      preferredTime: row.PreferredTime,
      status: row.Status,
      notes: row.Notes,
    });
  } catch (error) {
    logError(error, { context: 'lookupCertificateRequest' });
    res.status(500).json({ message: 'Unable to look up your request.' });
  }
});

app.post('/api/admin/uploads', requireAdmin, (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Photo must be 5 MB or smaller.'
        : 'Unable to upload the selected photo.';
      return res.status(400).json({ message });
    }

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please select an image file.' });
  }

  try {
    const contents = await fs.promises.readFile(req.file.path);
    if (!hasValidImageSignature(req.file.mimetype, contents)) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (error) {
        logError(error, { context: 'removeInvalidImageUpload' });
        return res.status(500).json({ message: 'Unable to validate the uploaded image.' });
      }
      return res.status(400).json({ message: 'The selected file is not a valid JPEG, PNG, or WebP image.' });
    }

    let photoUrl = buildPublicUploadUrl(req.file.filename);

    if (isAzureConfigured()) {
      try {
        photoUrl = await uploadFileToAzure(req.file, req.file.originalname);
      } catch (error) {
        logError(error, { context: 'uploadToAzure' });
        return res.status(500).json({ message: 'Unable to upload the photo to Azure Blob Storage.' });
      }
    }

    try {
      if (isAzureConfigured()) {
        await fs.promises.unlink(req.file.path);
      }
    } catch (error) {
      logError(error, { context: 'cleanupLocalUpload' });
    }

    return res.status(201).json({ photoUrl });
  } catch (error) {
    logError(error, { context: 'validateImageUpload' });
    return res.status(500).json({ message: 'Unable to validate the uploaded image.' });
  }
});

// Public access is limited to files referenced by an event or published site content.
app.get('/uploads/:filename', async (req, res) => {
  const filename = String(req.params.filename || '');
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    return res.status(400).json({ message: 'Invalid file name.' });
  }

  try {
    const result = await getPool().request()
      .input('url', sql.NVarChar(1000), `/uploads/${filename}`)
      .query(`
        SELECT TOP 1 1 AS found
        WHERE EXISTS (SELECT 1 FROM dbo.Events WHERE PhotoUrl = @url)
           OR EXISTS (
             SELECT 1 FROM dbo.SiteContent
             WHERE ContentKey IN ('about', 'gallery', 'news') AND ContentJson LIKE '%' + @url + '%'
           )
      `);
    const filePath = path.join(uploadDirectory, filename);
    if (result.recordset.length === 0 || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Photo not found.' });
    }
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(filePath);
  } catch (error) {
    logError(error, { context: 'serveEventPhoto' });
    return res.status(500).json({ message: 'Unable to load photo.' });
  }
});

function formatEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Input validation helpers
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhoneNumber(phone) {
  // Accept basic phone format: at least 10 digits
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length >= 10;
}

function isValidDate(dateStr) {
  const date = new Date(dateStr);
  return !Number.isNaN(date.getTime());
}

function isFutureDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

async function getServicePolicy(pool, serviceId, scheduledDate) {
  const result = await pool.request().input('serviceId', sql.Int, serviceId).query('SELECT Name FROM dbo.Service WHERE ServiceId=@serviceId');
  const service = result.recordset[0];
  return { name: service?.Name || '', ...servicePolicy(service?.Name, scheduledDate) };
}

async function quotaCount(pool, serviceId, scheduledDate) {
  const result = await pool.request().input('serviceId', sql.Int, serviceId).input('scheduledDate', sql.Date, scheduledDate).query(`SELECT COUNT(*) AS total FROM dbo.ServiceRequest WHERE ServiceId=@serviceId AND ScheduledDate=@scheduledDate AND Status IN ('PendingVerification','Confirmed')`);
  return Number(result.recordset[0]?.total || 0);
}

// Returns the first admin block covering this date/time, or null. A null BlockTime blocks the whole day.
async function findBlockedSlot(pool, { date, time, serviceId = null, certificate = false }) {
  const result = await pool.request()
    .input('date', sql.Date, date)
    .input('time', sql.VarChar(5), time ? String(time).slice(0, 5) : null)
    .input('serviceId', sql.Int, serviceId)
    .input('certificate', sql.Bit, certificate ? 1 : 0)
    .query(`SELECT TOP 1 Reason FROM dbo.BlockedSlots
      WHERE BlockDate=@date
        AND (BlockTime IS NULL OR BlockTime=@time)
        AND (Scope='All' OR (Scope='Certificate' AND @certificate=1) OR (Scope='Service' AND ServiceId=@serviceId))`);
  return result.recordset[0] || null;
}

function blockedMessage(block) {
  return block?.Reason ? `This date or time is unavailable: ${block.Reason}` : 'This date or time is unavailable for booking.';
}

function sanitizeText(text) {
  return String(text).trim().slice(0, 500);
}

function escapeHtml(text) {
  const htmlMap = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, char => htmlMap[char]);
}

app.get('/api/services', async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT ServiceId, Name, Description
      FROM dbo.Service
      WHERE IsActive = 1
      ORDER BY Name
    `);

    const services = result.recordset.map(row => ({
      id: row.ServiceId,
      name: row.Name,
      description: row.Description,
    }));

    res.json(services);
  } catch (error) {
    console.error('Services lookup error:', error);
    res.status(500).json({
      message: 'Unable to load services.',
    });
  }
});

app.get('/api/services/:serviceId/slots', async (req, res) => {
  const { serviceId } = req.params;
  const date = req.query.date ? String(req.query.date) : null;
  const startDate = date ? new Date(date) : new Date();

  const slotTimes = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
  const daysToShow = 30;
  const requestedDate = new Date(startDate);

  let bookedSet = new Set();
  let quotaFullDates = new Set();
  let blocks = [];
  let policy = { name: '' };
  const numericServiceId = Number(serviceId);
  const useServiceId = Number.isInteger(numericServiceId) && String(numericServiceId) === serviceId;

  try {
    if (useServiceId) {
      const pool = getPool();
      policy = await getServicePolicy(pool, numericServiceId, requestedDate.toISOString().slice(0, 10));
      const request = pool.request();

      const bookedResult = await request
        .input('serviceId', sql.Int, numericServiceId)
        .query(`
        SELECT ScheduledDate, ScheduledTime
        FROM dbo.ServiceRequest
        WHERE ServiceId = @serviceId
          AND Status IN ('PendingVerification', 'Confirmed')
      `);

      if (policy.quota) {
        const quotaResult = await pool.request().input('serviceId', sql.Int, numericServiceId).query(`SELECT CONVERT(varchar(10), ScheduledDate, 23) AS scheduledDate, COUNT(*) AS total FROM dbo.ServiceRequest WHERE ServiceId=@serviceId AND Status IN ('PendingVerification','Confirmed') GROUP BY ScheduledDate`);
        quotaFullDates = new Set(quotaResult.recordset.filter(row => Number(row.total) >= policy.quota).map(row => row.scheduledDate));
      }

      const blockResult = await pool.request().input('serviceId', sql.Int, numericServiceId).query(`SELECT CONVERT(varchar(10), BlockDate, 23) AS blockDate, BlockTime, Reason FROM dbo.BlockedSlots WHERE BlockDate >= CAST(SYSUTCDATETIME() AS date) AND (Scope='All' OR (Scope='Service' AND ServiceId=@serviceId))`);
      blocks = blockResult.recordset;

      bookedSet = new Set(bookedResult.recordset.map((row) => {
        const timeText = row.ScheduledTime instanceof Date
          ? formatTime(row.ScheduledTime)
          : String(row.ScheduledTime).slice(0, 5);
        const dateText = row.ScheduledDate instanceof Date
          ? row.ScheduledDate.toISOString().slice(0, 10)
          : String(row.ScheduledDate).slice(0, 10);
        return `${dateText}|${timeText}`;
      }));
    }

    const slots = [];
    const slotDate = new Date(
      requestedDate.getFullYear(),
      requestedDate.getMonth(),
      requestedDate.getDate(),
    );
    let weekdayCount = 0;
    while (weekdayCount < daysToShow) {
      const dayOfWeek = slotDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const isoDate = [
          slotDate.getFullYear(),
          String(slotDate.getMonth() + 1).padStart(2, '0'),
          String(slotDate.getDate()).padStart(2, '0'),
        ].join('-');
        const policyForDate = servicePolicy(policy.name, isoDate);
        slotTimes.forEach(time => {
          const key = `${isoDate}|${time}`;
          const quotaFull = quotaFullDates.has(isoDate);
          const block = blocks.find(b => b.blockDate === isoDate && (!b.BlockTime || b.BlockTime === time));
          slots.push({ date: isoDate, time, available: policyForDate.allowed && !quotaFull && !block && !bookedSet.has(key), restricted: !policyForDate.allowed || quotaFull || !!block, message: policyForDate.message || (quotaFull ? `Daily booking limit reached for ${policy.quotaLabel}.` : block ? blockedMessage(block) : undefined) });
        });
        weekdayCount += 1;
      }
      slotDate.setDate(slotDate.getDate() + 1);
    }

    const restrictionMessage = slots.find(slot => slot.restricted)?.message;
    res.json({ serviceId, slots, restrictionMessage });
  } catch (error) {
    console.error('Slot lookup error:', error);
    res.status(500).json({ message: 'Unable to load available slots.' });
  }
});

// Maps a service name to its typed detail table so sacrament-specific answers can be persisted.
const SACRAMENT_DETAIL_TABLES = {
  'Baptism': { table: 'BaptismRequestDetail', columns: ['ChildFirstName', 'ChildMiddleName', 'ChildLastName', 'ChildDateOfBirth', 'PlaceOfBirth', 'FatherFullName', 'MotherFullName', 'GodfatherName', 'GodmotherName'] },
  'Marriage': { table: 'MarriageRequestDetail', columns: ['GroomFirstName', 'GroomMiddleName', 'GroomLastName', 'GroomAge', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName', 'BrideAge', 'CenomarNumber', 'Witnesses'] },
  'Confirmation': { table: 'ConfirmationRequestDetail', columns: ['CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName', 'CandidateDateOfBirth', 'SponsorName', 'ParishOfBaptism'] },
  'Funeral Mass': { table: 'FuneralRequestDetail', columns: ['DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName', 'DateOfDeath', 'RelationshipToDeceased', 'PlaceOfWake'] },
  'House Blessing': { table: 'HouseBlessingRequestDetail', columns: ['FullAddress', 'Landmark', 'PreferredContactPerson'] },
};

// Persists the sacrament-specific answers a parishioner submitted, using the matching column when one
// exists and stashing anything else (including admin-added custom fields) in ExtraFieldsJson.
async function saveSacramentDetails(pool, serviceName, serviceRequestId, details) {
  const mapping = SACRAMENT_DETAIL_TABLES[serviceName];
  if (!mapping || !details || typeof details !== 'object') return;

  const columnByKey = new Map(mapping.columns.map(col => [col.charAt(0).toLowerCase() + col.slice(1), col]));
  const request = pool.request().input('serviceRequestId', sql.Int, serviceRequestId);
  const extras = {};
  const providedColumns = new Set();

  for (const [key, value] of Object.entries(details)) {
    const column = columnByKey.get(key);
    if (column) {
      request.input(`col_${column}`, sql.NVarChar(sql.MAX), value == null ? null : String(value).slice(0, 4000));
      providedColumns.add(column);
    } else {
      extras[key] = value;
    }
  }

  // Every mapped column needs an input (even null) so the INSERT's column/value lists line up.
  for (const col of mapping.columns) {
    if (!providedColumns.has(col)) request.input(`col_${col}`, sql.NVarChar(sql.MAX), null);
  }

  request.input('extraFieldsJson', sql.NVarChar(sql.MAX), Object.keys(extras).length ? JSON.stringify(extras) : null);
  const columnList = mapping.columns.join(', ');
  const paramList = mapping.columns.map(col => `@col_${col}`).join(', ');

  await request.query(`
    INSERT INTO dbo.${mapping.table} (ServiceRequestId, ${columnList}, ExtraFieldsJson)
    VALUES (@serviceRequestId, ${paramList}, @extraFieldsJson)
  `);
}

app.get('/api/services/:serviceId/fields', async (req, res) => {
  const numericServiceId = Number(req.params.serviceId);
  if (!Number.isInteger(numericServiceId) || numericServiceId <= 0) {
    return res.status(400).json({ message: 'Invalid service ID.' });
  }
  try {
    const pool = getPool();
    const result = await pool.request().input('serviceId', sql.Int, numericServiceId).query(`
      SELECT FieldKey, Label, FieldType, OptionsJson, IsRequired, SortOrder
      FROM dbo.ServiceFieldDefinition
      WHERE ServiceId = @serviceId AND IsActive = 1
      ORDER BY SortOrder, FieldDefinitionId
    `);
    const fields = result.recordset.map(row => ({
      key: row.FieldKey,
      label: row.Label,
      type: row.FieldType,
      options: row.OptionsJson ? JSON.parse(row.OptionsJson) : undefined,
      required: !!row.IsRequired,
    }));
    res.json({ fields });
  } catch (error) {
    console.error('Field definitions lookup error:', error);
    res.status(500).json({ message: 'Unable to load form fields.' });
  }
});

app.post('/api/service-requests', async (req, res) => {
  const { serviceId, firstName, lastName, email, mobileNumber, address, scheduledDate, scheduledTime, notes, details } = req.body;

  if (!serviceId || !firstName || !lastName || !email || !scheduledDate || !scheduledTime) {
    return res.status(400).json({ message: 'Missing required booking fields.' });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  // Validate phone number
  if (mobileNumber && !isValidPhoneNumber(mobileNumber)) {
    return res.status(400).json({ message: 'Please provide a valid phone number.' });
  }

  // Validate scheduled date
  if (!isValidDate(scheduledDate)) {
    return res.status(400).json({ message: 'Please provide a valid date.' });
  }

  // Validate date is not in the past
  if (!isFutureDate(scheduledDate)) {
    return res.status(400).json({ message: 'Scheduled date must be in the future.' });
  }

  // Validate serviceId is numeric
  const numericServiceId = Number(serviceId);
  if (!Number.isInteger(numericServiceId) || numericServiceId <= 0) {
    return res.status(400).json({ message: 'Invalid service ID.' });
  }

  try {
    const pool = getPool();
    const policy = await getServicePolicy(pool, numericServiceId, scheduledDate);
    if (!policy.allowed) return res.status(400).json({ message: policy.message });
    const block = await findBlockedSlot(pool, { date: scheduledDate, time: scheduledTime, serviceId: numericServiceId });
    if (block) return res.status(409).json({ message: blockedMessage(block) });
    if (policy.quota && await quotaCount(pool, numericServiceId, scheduledDate) >= policy.quota) {
      return res.status(409).json({ message: `${policy.quotaLabel} bookings are limited to ${policy.quota} per day.` });
    }
    const booked = await pool.request().input('serviceId', sql.Int, numericServiceId).input('scheduledDate', sql.Date, scheduledDate).input('scheduledTime', sql.VarChar(10), scheduledTime).query(`SELECT TOP 1 ServiceRequestId FROM dbo.ServiceRequest WHERE ServiceId=@serviceId AND ScheduledDate=@scheduledDate AND ScheduledTime=@scheduledTime AND Status IN ('PendingVerification','Confirmed')`);
    if (booked.recordset.length) return res.status(409).json({ message: 'That appointment slot is already booked.' });

    // Step 1: Check if parishioner exists
    const parishionerLookup = pool.request()
      .input('email', sql.VarChar(255), email)
      .query(`
      SELECT ParishionerId
      FROM dbo.Parishioners
      WHERE EmailAddress = @email
    `);
    let existingParishioner = await parishionerLookup;

    if (existingParishioner.recordset.length === 0 && mobileNumber) {
      existingParishioner = await pool.request()
        .input('mobileNumber', sql.VarChar(50), mobileNumber)
        .query(`
        SELECT ParishionerId
        FROM dbo.Parishioners
        WHERE MobileNumber = @mobileNumber
      `);
    }

    let parishionerId;
    if (existingParishioner.recordset.length > 0) {
      parishionerId = existingParishioner.recordset[0].ParishionerId;
      // Update parishioner table with latest contact info for account profile
      await pool.request()
        .input('firstName', sql.VarChar(100), firstName)
        .input('lastName', sql.VarChar(100), lastName)
        .input('address', sql.VarChar(500), address || null)
        .input('email', sql.VarChar(255), email)
        .input('mobileNumber', sql.VarChar(50), mobileNumber || null)
        .input('parishionerId', sql.Int, parishionerId)
        .query(`
        UPDATE dbo.Parishioners
        SET FirstName = @firstName, LastName = @lastName, Address = @address, EmailAddress = @email, MobileNumber = @mobileNumber
        WHERE ParishionerId = @parishionerId
      `);
    } else {
      const insertResult = await pool.request()
        .input('firstName', sql.VarChar(100), firstName)
        .input('lastName', sql.VarChar(100), lastName)
        .input('email', sql.VarChar(255), email)
        .input('mobileNumber', sql.VarChar(50), mobileNumber || null)
        .input('address', sql.VarChar(500), address || null)
        .query(`
        INSERT INTO dbo.Parishioners (FirstName, LastName, EmailAddress, MobileNumber, Address, CreatedAt)
        OUTPUT INSERTED.ParishionerId
        VALUES (@firstName, @lastName, @email, @mobileNumber, @address, GETDATE())
      `);
      parishionerId = insertResult.recordset[0].ParishionerId;
    }

    // Step 2: Save the submitted contact details with this booking.
    // OUTPUT ... INTO is required because dbo.ServiceRequest has triggers; SQL Server
    // forbids OUTPUT without INTO on tables with enabled triggers.
    const insertRequest = await pool.request()
      .input('parishionerId', sql.Int, parishionerId)
      .input('serviceId', sql.Int, numericServiceId)
      .input('scheduledDate', sql.Date, scheduledDate)
      .input('scheduledTime', sql.VarChar(10), scheduledTime)
      .input('notes', sql.VarChar(500), notes || null)
      .input('firstName', sql.VarChar(100), firstName)
      .input('lastName', sql.VarChar(100), lastName)
      .input('email', sql.VarChar(255), email)
      .input('mobileNumber', sql.VarChar(50), mobileNumber || null)
      .input('address', sql.VarChar(500), address || null)
      .query(`
      DECLARE @inserted TABLE (ServiceRequestId INT);
      INSERT INTO dbo.ServiceRequest
        (ParishionerId, ServiceId, RequestDate, ScheduledDate, ScheduledTime, Venue, Status, Notes, CreatedAt,
         ContactFirstName, ContactLastName, ContactEmail, ContactMobile, ContactAddress)
      OUTPUT INSERTED.ServiceRequestId INTO @inserted
      VALUES
        (@parishionerId, @serviceId, GETDATE(), @scheduledDate, @scheduledTime, N'', N'PendingVerification', @notes, GETDATE(),
         @firstName, @lastName, @email, @mobileNumber, @address);
      SELECT ServiceRequestId FROM @inserted;
    `);

    const requestId = insertRequest.recordset[0].ServiceRequestId;
    try {
      await saveSacramentDetails(pool, policy.name, requestId, details);
    } catch (error) {
      // Keep the appointment usable when an optional detail-table migration is stale.
      logError(error, { context: 'saveSacramentDetails', requestId, serviceId: numericServiceId });
    }
    const token = await createVerificationToken(requestId);

    const verificationLink = `${req.protocol}://${req.get('host')}/api/service-requests/verify?token=${token}`;

    // Send confirmation email
    const { subject, html } = serviceBookingEmail({
      firstName,
      requestId,
      scheduledDate,
      scheduledTime,
      notes,
      verificationLink,
    });
    await sendEmail(email, subject, html);

    res.json({ requestId, status: 'PendingVerification', verificationLink });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Unable to create booking.' });
  }
});

app.get('/api/service-requests/verify', async (req, res) => {
  const token = String(req.query.token || '');

  if (!token) {
    return res.status(400).json({ message: 'Verification token is required.' });
  }

  try {
    const requestId = await verifyToken(token);

    if (!requestId) {
      return res.status(400).json({ message: 'Invalid or expired verification token.' });
    }

    const pool = getPool();
    const request = pool.request().input('requestId', sql.Int, requestId);

    await request.query(`
      UPDATE dbo.ServiceRequest
      SET Status = N'Confirmed'
      WHERE ServiceRequestId = @requestId
    `);

    res.json({ message: 'Booking verified and confirmed.' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Unable to verify booking.' });
  }
});

const VATICAN_NEWS_RSS_URL = 'https://www.vaticannews.va/en.rss.xml';
const VATICAN_NEWS_CACHE_TTL_MS = 15 * 60 * 1000;
let vaticanNewsCache = { data: null, fetchedAt: 0 };

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractRssTag(itemXml, tag) {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match) return '';
  const raw = match[1].trim();
  const cdataMatch = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeXmlEntities((cdataMatch ? cdataMatch[1] : raw).trim());
}

function summarizeRssDescription(description) {
  return description
    .replace(/<a[^>]*>\s*Read all\s*<\/a>/i, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchVaticanNews() {
  const now = Date.now();
  if (vaticanNewsCache.data && now - vaticanNewsCache.fetchedAt < VATICAN_NEWS_CACHE_TTL_MS) {
    return vaticanNewsCache.data;
  }

  const response = await fetch(VATICAN_NEWS_RSS_URL, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Vatican News feed returned status ${response.status}`);
  const xml = await response.text();

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const news = items.slice(0, 6).map((item, index) => {
    const title = extractRssTag(item, 'title');
    const description = extractRssTag(item, 'description');
    const link = extractRssTag(item, 'link');
    const pubDate = extractRssTag(item, 'pubDate');
    const imageMatch = item.match(/<media:content[^>]*url="([^"]+)"/);
    const parsedDate = pubDate ? new Date(pubDate) : new Date();

    return {
      id: `vatican-news-${index}`,
      title,
      summary: summarizeRssDescription(description),
      date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      link,
      imageUrl: imageMatch ? imageMatch[1] : '',
    };
  });

  vaticanNewsCache = { data: news, fetchedAt: now };
  return news;
}

app.get('/api/vatican-news', async (_req, res) => {
  try {
    const news = await fetchVaticanNews();
    res.json(news);
  } catch (error) {
    logError(error, { context: 'vaticanNewsFeed' });
    res.status(502).json({ message: 'Unable to load Vatican News right now.' });
  }
});

app.get('/api/events', async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`SELECT * FROM dbo.Events ORDER BY EventDate`);

    const events = result.recordset
      .map((row, index) => {
        const id = row.EventId ?? row.Id ?? row.ID ?? row.id ?? 'event-' + index;
        const title = row.Title ?? row.Name ?? row.title ?? 'Untitled event';
        const titleTl = row.TitleTl ?? row.titleTl ?? '';
        const description = row.Description ?? row.description ?? row.Body ?? row.body ?? '';
        const descriptionTl = row.DescriptionTl ?? row.descriptionTl ?? '';
        const detail = row.Body ?? row.body ?? row.Detail ?? row.detail ?? '';
        const detailTl = row.BodyTl ?? row.bodyTl ?? row.DetailTl ?? row.detailTl ?? '';
        const dateValue = row.EventDate ?? row.Date ?? row.eventDate ?? row.date;
        const date = formatEventDate(dateValue);
        const time = String(row.EventTime ?? row.Time ?? row.eventTime ?? row.time ?? '').slice(0, 8);
        const location = row.Location ?? row.Venue ?? row.location ?? '';
        const locationTl = row.LocationTl ?? row.locationTl ?? '';
        const photoUrl = row.PhotoUrl ?? row.photoUrl ?? '';

        if (!date) return null;

        return {
          id: String(id),
          title: String(title),
          titleTl: String(titleTl),
          description: String(description),
          descriptionTl: String(descriptionTl),
          detail: String(detail),
          detailTl: String(detailTl),
          date,
          time,
          location: String(location),
          locationTl: String(locationTl),
          photoUrl: String(photoUrl),
        };
      })
      .filter(Boolean);

    res.json(events);
  } catch (error) {
    console.error('Events lookup error:', error);
    res.status(500).json({ message: 'Unable to load events.' });
  }
});

app.post('/api/events', requireAdmin, async (req, res) => {
  const { title, titleTl, description, descriptionTl, detail, detailTl, date, time, location, locationTl, photoUrl } = req.body;

  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required.' });
  }

  // Validate title length
  if (String(title).trim().length < 3) {
    return res.status(400).json({ message: 'Event title must be at least 3 characters.' });
  }

  // Validate date format
  if (!isValidDate(date)) {
    return res.status(400).json({ message: 'Please provide a valid event date.' });
  }

  try {
    const pool = getPool();
    const request = pool.request()
      .input('title', sql.NVarChar(255), title)
      .input('titleTl', sql.NVarChar(255), titleTl || '')
      .input('description', sql.NVarChar(sql.MAX), description || '')
      .input('descriptionTl', sql.NVarChar(sql.MAX), descriptionTl || '')
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('detailTl', sql.NVarChar(sql.MAX), detailTl || '')
      .input('date', sql.Date, date)
      .input('time', sql.VarChar(10), time || '')
      .input('location', sql.NVarChar(255), location || '')
      .input('locationTl', sql.NVarChar(255), locationTl || '')
      .input('photoUrl', sql.NVarChar(1000), photoUrl || '');

    const result = await request.query(`
      INSERT INTO dbo.Events (Title, TitleTl, Description, DescriptionTl, Body, BodyTl, EventDate, EventTime, Location, LocationTl, PhotoUrl)
      OUTPUT INSERTED.EventId
      VALUES (@title, @titleTl, @description, @descriptionTl, @detail, @detailTl, @date, @time, @location, @locationTl, @photoUrl)
    `);

    const eventId = result.recordset[0]?.EventId;
    res.status(201).json({
      id: String(eventId), title, titleTl: titleTl || '', description: description || '',
      descriptionTl: descriptionTl || '', detail, detailTl: detailTl || '', date,
      time: time || '', location, locationTl: locationTl || '', photoUrl: photoUrl || '',
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Unable to create event.' });
  }
});

app.put('/api/events/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const { title, titleTl, description, descriptionTl, detail, detailTl, date, time, location, locationTl, photoUrl } = req.body;

  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required.' });
  }

  try {
    const pool = getPool();
    const request = pool.request()
      .input('title', sql.NVarChar(255), title)
      .input('titleTl', sql.NVarChar(255), titleTl || '')
      .input('description', sql.NVarChar(sql.MAX), description || '')
      .input('descriptionTl', sql.NVarChar(sql.MAX), descriptionTl || '')
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('detailTl', sql.NVarChar(sql.MAX), detailTl || '')
      .input('date', sql.Date, date)
      .input('time', sql.VarChar(10), time || '')
      .input('location', sql.NVarChar(255), location || '')
      .input('locationTl', sql.NVarChar(255), locationTl || '')
      .input('photoUrl', sql.NVarChar(1000), photoUrl || '')
      .input('eventId', sql.Int, eventId);

    await request.query(`
      UPDATE dbo.Events
      SET Title = @title, TitleTl = @titleTl, Description = @description, DescriptionTl = @descriptionTl,
          Body = @detail, BodyTl = @detailTl, EventDate = @date, EventTime = @time,
          Location = @location, LocationTl = @locationTl, PhotoUrl = @photoUrl
      WHERE EventId = @eventId
    `);

    res.json({
      id: String(eventId), title, titleTl: titleTl || '', description: description || '',
      descriptionTl: descriptionTl || '', detail, detailTl: detailTl || '', date,
      time: time || '', location, locationTl: locationTl || '', photoUrl: photoUrl || '',
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Unable to update event.' });
  }
});

app.delete('/api/events/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;

  try {
    const pool = getPool();
    const request = pool.request().input('eventId', sql.Int, eventId);

    await request.query(`
      DELETE FROM dbo.Events
      WHERE EventId = @eventId
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Unable to delete event.' });
  }
});

const siteContentPages = new Set(['about', 'gallery', 'contact', 'footer', 'news']);

const isOptionalText = (value, max) => value === undefined || (typeof value === 'string' && value.length <= max);

function isSiteContentDocument(page, content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;

  if (page === 'about') {
    return typeof content.heading === 'string'
      && content.heading.length <= 300
      && isOptionalText(content.headingTl, 300)
      && (content.paragraphsTl === undefined || (Array.isArray(content.paragraphsTl)
        && content.paragraphsTl.length <= 30
        && content.paragraphsTl.every(paragraph => typeof paragraph === 'string' && paragraph.length <= 10000)))
      && Array.isArray(content.paragraphs)
      && content.paragraphs.length <= 30
      && content.paragraphs.every(paragraph => typeof paragraph === 'string' && paragraph.length <= 10000)
      && Array.isArray(content.stats)
      && content.stats.length <= 20
      && content.stats.every(stat => stat && typeof stat.value === 'string' && stat.value.length <= 100
        && typeof stat.label === 'string' && stat.label.length <= 300
        && isOptionalText(stat.labelTl, 300))
      && isOptionalText(content.intro, 1000)
      && isOptionalText(content.introTl, 1000)
      && (content.heroImage === undefined || content.heroImage === ''
        || (typeof content.heroImage === 'string' && content.heroImage.length <= 2000
          && (/^https?:\/\//i.test(content.heroImage) || content.heroImage.startsWith('/assets/') || content.heroImage.startsWith('/uploads/'))))
      && (content.timeline === undefined || (Array.isArray(content.timeline)
        && content.timeline.length <= 30
        && content.timeline.every(item => item && typeof item.year === 'string' && item.year.length <= 50
          && typeof item.title === 'string' && item.title.length <= 200
          && isOptionalText(item.titleTl, 200)
          && typeof item.description === 'string' && item.description.length <= 2000
          && isOptionalText(item.descriptionTl, 2000))))
      && (content.quote === undefined || (content.quote && typeof content.quote === 'object'
        && typeof content.quote.text === 'string' && content.quote.text.length <= 1000
        && isOptionalText(content.quote.textTl, 1000)
        && isOptionalText(content.quote.attribution, 200)));
  }

  if (page === 'contact') {
    return typeof content.heading === 'string' && content.heading.length <= 300
      && isOptionalText(content.headingTl, 300)
      && isOptionalText(content.eyebrow, 100)
      && isOptionalText(content.eyebrowTl, 100)
      && isOptionalText(content.description, 1000)
      && isOptionalText(content.descriptionTl, 1000)
      && isOptionalText(content.formTitle, 200)
      && isOptionalText(content.formTitleTl, 200)
      && isOptionalText(content.formDescription, 1000)
      && isOptionalText(content.formDescriptionTl, 1000)
      && Array.isArray(content.cards)
      && content.cards.length <= 12
      && content.cards.every(card => card
        && ['visit', 'call', 'email'].includes(card.type)
        && typeof card.title === 'string' && card.title.length <= 200
        && isOptionalText(card.titleTl, 200)
        && Array.isArray(card.lines) && card.lines.length <= 10
        && card.lines.every(line => typeof line === 'string' && line.length <= 300)
        && (card.linesTl === undefined || (Array.isArray(card.linesTl) && card.linesTl.length <= 10
          && card.linesTl.every(line => typeof line === 'string' && line.length <= 300))));
  }

  if (page === 'footer') {
    const isTextList = (value, maxItems, maxLength) => Array.isArray(value)
      && value.length <= maxItems
      && value.every(item => typeof item === 'string' && item.length <= maxLength);
    return typeof content.parishTitle === 'string' && content.parishTitle.length <= 200
      && isTextList(content.addressLines, 10, 300)
      && typeof content.scheduleTitle === 'string' && content.scheduleTitle.length <= 100
      && isTextList(content.scheduleLines, 20, 300)
      && typeof content.officeHoursTitle === 'string' && content.officeHoursTitle.length <= 100
      && isTextList(content.officeHoursLines, 20, 300)
      && typeof content.contactTitle === 'string' && content.contactTitle.length <= 100
      && typeof content.contactIntro === 'string' && content.contactIntro.length <= 500
      && isTextList(content.phoneNumbers, 10, 50)
      && typeof content.email === 'string' && content.email.length <= 320
      && typeof content.quickLinksTitle === 'string' && content.quickLinksTitle.length <= 100
      && Array.isArray(content.quickLinks) && content.quickLinks.length <= 12
      && content.quickLinks.every(link => link
        && typeof link.label === 'string' && link.label.length <= 100
        && typeof link.path === 'string' && link.path.length <= 500
        && link.path.startsWith('/') && !link.path.startsWith('//'))
      && typeof content.copyright === 'string' && content.copyright.length <= 300;
  }

  if (page === 'news') return isValidNewsContent(content);
  return page === 'gallery' && isValidGalleryContent(content);
}

app.get('/api/site-content/:page', async (req, res) => {
  const page = String(req.params.page || '').toLowerCase();
  if (!siteContentPages.has(page)) {
    return res.status(404).json({ message: 'Website content page not found.' });
  }

  try {
    const result = await getPool().request()
      .input('key', sql.NVarChar(50), page)
      .query('SELECT ContentJson FROM dbo.SiteContent WHERE ContentKey = @key');
    const stored = result.recordset[0]?.ContentJson;
    return res.json({ content: stored ? JSON.parse(stored) : null });
  } catch (error) {
    logError(error, { context: 'getSiteContent', page });
    return res.status(500).json({ message: 'Unable to load website content.' });
  }
});

app.put('/api/admin/site-content/:page', requireAdmin, requireRole(['Admin', 'Secretary', 'ParishPriest']), async (req, res) => {
  const page = String(req.params.page || '').toLowerCase();
  const content = req.body?.content;
  if (!siteContentPages.has(page)) {
    return res.status(404).json({ message: 'Website content page not found.' });
  }
  if (!isSiteContentDocument(page, content)) {
    return res.status(400).json({ message: 'The website content has an invalid format.' });
  }

  try {
    const contentJson = JSON.stringify(content);
    await getPool().request()
      .input('key', sql.NVarChar(50), page)
      .input('content', sql.NVarChar(sql.MAX), contentJson)
      .input('updatedBy', sql.NVarChar(256), req.staff?.email || String(req.staff?.userId || ''))
      .query(`
        MERGE dbo.SiteContent WITH (HOLDLOCK) AS target
        USING (SELECT @key AS ContentKey) AS source
        ON target.ContentKey = source.ContentKey
        WHEN MATCHED THEN
          UPDATE SET ContentJson = @content, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
        WHEN NOT MATCHED THEN
          INSERT (ContentKey, ContentJson, UpdatedBy)
          VALUES (@key, @content, @updatedBy);
      `);
    return res.json({ content });
  } catch (error) {
    logError(error, { context: 'saveSiteContent', page });
    return res.status(500).json({ message: 'Unable to save website content.' });
  }
});

app.post('/api/contact', contactRateLimit, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const phone = String(req.body?.phone || '').trim();
  const message = String(req.body?.message || '').trim();

  if (name.length < 2 || name.length > 200) {
    return res.status(400).json({ message: 'Please provide your name.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  if (phone.length > 50) {
    return res.status(400).json({ message: 'Phone number is too long.' });
  }
  if (message.length < 5 || message.length > 5000) {
    return res.status(400).json({ message: 'Message must be between 5 and 5000 characters.' });
  }

  try {
    await getPool().request()
      .input('name', sql.NVarChar(200), name)
      .input('email', sql.NVarChar(320), email)
      .input('phone', sql.NVarChar(50), phone || null)
      .input('message', sql.NVarChar(sql.MAX), message)
      .query('INSERT INTO dbo.ContactMessages (Name, Email, Phone, Message) VALUES (@name, @email, @phone, @message)');
    return res.json({ success: true });
  } catch (error) {
    logError(error, { context: 'submitContactMessage' });
    return res.status(500).json({ message: 'Unable to send your message.' });
  }
});

// Any signed-in staff role may read and mark messages; only senior roles may delete.
app.get('/api/admin/contact-messages', requireAdmin, requireRole(staffRolePriority), async (_req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT ContactMessageId, Name, Email, Phone, Message, IsRead, CreatedAt
      FROM dbo.ContactMessages
      ORDER BY CreatedAt DESC
    `);
    return res.json(result.recordset.map(row => ({
      id: row.ContactMessageId,
      name: row.Name,
      email: row.Email,
      phone: row.Phone,
      message: row.Message,
      isRead: !!row.IsRead,
      createdAt: row.CreatedAt,
    })));
  } catch (error) {
    logError(error, { context: 'listContactMessages' });
    return res.status(500).json({ message: 'Unable to load messages.' });
  }
});

app.patch('/api/admin/contact-messages/:id', requireAdmin, requireRole(staffRolePriority), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || typeof req.body?.isRead !== 'boolean') {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  try {
    await getPool().request()
      .input('id', sql.Int, id)
      .input('isRead', sql.Bit, req.body.isRead ? 1 : 0)
      .query('UPDATE dbo.ContactMessages SET IsRead = @isRead WHERE ContactMessageId = @id');
    return res.json({ success: true });
  } catch (error) {
    logError(error, { context: 'updateContactMessage' });
    return res.status(500).json({ message: 'Unable to update message.' });
  }
});

app.delete('/api/admin/contact-messages/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'Invalid request.' });
  }
  try {
    await getPool().request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.ContactMessages WHERE ContactMessageId = @id');
    return res.json({ success: true });
  } catch (error) {
    logError(error, { context: 'deleteContactMessage' });
    return res.status(500).json({ message: 'Unable to delete message.' });
  }
});

app.post('/api/admin/login', authRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await getPool().request()
      .input('email', sql.NVarChar(510), email)
      .query(`
        SELECT TOP 1 u.UserId, u.EmailAddress, u.PasswordHash, u.MustChangePassword, r.Name AS RoleName
        FROM dbo.AspNetUsers u
        INNER JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.UserId
        INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
        WHERE u.EmailAddress = @email
      `);
    const user = result.recordset[0];

    const supportedRoles = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];
    if (!user || !supportedRoles.includes(user.RoleName) || !verifyAspNetPassword(password, user.PasswordHash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({
      token: createStaffToken(user.UserId, user.RoleName),
      user: { id: user.UserId, email: user.EmailAddress, role: user.RoleName, mustChangePassword: Boolean(user.MustChangePassword) },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ message: 'Unable to sign in.' });
  }
});

app.post('/api/admin/forgot-password', authRateLimit, async (req, res) => {
  const message = 'If a staff account matches that email, password reset instructions will be sent if email delivery is available.';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(202).json({ message });
  }

  try {
    const accountResult = await getPool().request()
      .input('email', sql.NVarChar(255), email)
      .query(`
        SELECT TOP 1 u.UserId, u.EmailAddress, u.UserName
        FROM dbo.AspNetUsers u
        INNER JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.UserId
        INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
        WHERE u.EmailAddress = @email
          AND r.Name IN ('Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff')
      `);
    const account = accountResult.recordset[0];

    if (!account) {
      return res.status(404).json({ message: 'No staff account was found for that email address.' });
    }

    if (account && resend) {
      const token = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(token);
      const transaction = new sql.Transaction(getPool());
      let transactionStarted = false;
      try {
        await transaction.begin();
        transactionStarted = true;
        await transaction.request()
          .input('userId', sql.Int, account.UserId)
          .query(`
            UPDATE dbo.PasswordResetTokens
            SET UsedAt = SYSUTCDATETIME()
            WHERE UserId = @userId AND UsedAt IS NULL
          `);
        await transaction.request()
          .input('userId', sql.Int, account.UserId)
          .input('tokenHash', sql.Char(64), tokenHash)
          .query(`
            INSERT INTO dbo.PasswordResetTokens (UserId, TokenHash, ExpiresAt)
            VALUES (@userId, @tokenHash, DATEADD(MINUTE, 30, SYSUTCDATETIME()))
          `);
        await transaction.commit();
        transactionStarted = false;
      } catch (error) {
        if (transactionStarted) {
          try { await transaction.rollback(); } catch (rollbackError) {
            logError(rollbackError, { context: 'forgotPasswordRollback' });
          }
        }
        throw error;
      }

      const resetUrl = new URL('/admin/reset-password', process.env.FRONTEND_URL || 'http://localhost:5173');
      resetUrl.searchParams.set('token', token);
      const { subject, html } = passwordResetEmail({
        userName: account.UserName,
        resetLink: resetUrl.toString(),
      });
      if (!await sendEmail(account.EmailAddress, subject, html)) {
        try {
          await getPool().request()
            .input('tokenHash', sql.Char(64), tokenHash)
            .query('UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE TokenHash = @tokenHash');
        } catch (error) {
          logError(error, { context: 'invalidateUndeliveredPasswordReset' });
        }
      }
    } else if (account) {
      logger.warn('RESEND_API_KEY not configured, skipping password reset email');
    }

    return res.status(202).json({ message });
  } catch (error) {
    logError(error, { context: 'forgotPassword' });
    return res.status(500).json({ message: 'Unable to process the password reset request.' });
  }
});

app.post('/api/admin/reset-password', authRateLimit, async (req, res) => {
  const token = req.body?.token;
  const newPassword = req.body?.newPassword;
  if (!isValidPasswordResetToken(token)) {
    return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
  }
  if (!isValidResetPassword(newPassword)) {
    return res.status(400).json({ message: 'The new password must be 8 to 128 characters.' });
  }
  if (newPassword === defaultStaffPassword()) {
    return res.status(400).json({ message: 'Choose a password that is different from the default password.' });
  }

  let transaction;
  let transactionStarted = false;
  try {
    transaction = new sql.Transaction(getPool());
    await transaction.begin();
    transactionStarted = true;
    const tokenResult = await transaction.request()
      .input('tokenHash', sql.Char(64), hashPasswordResetToken(token))
      .query(`
        UPDATE resetToken
        SET UsedAt = SYSUTCDATETIME()
        OUTPUT inserted.UserId
        FROM dbo.PasswordResetTokens AS resetToken WITH (UPDLOCK, ROWLOCK)
        WHERE resetToken.TokenHash = @tokenHash
          AND resetToken.UsedAt IS NULL
          AND resetToken.ExpiresAt > SYSUTCDATETIME()
          AND EXISTS (
            SELECT 1
            FROM dbo.AspNetUserRoles ur
            INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = resetToken.UserId
              AND r.Name IN ('Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff')
          )
      `);
    const userId = tokenResult.recordset[0]?.UserId;
    if (!userId) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    const passwordResult = await transaction.request()
      .input('userId', sql.Int, userId)
      .input('passwordHash', sql.NVarChar(1024), hashAspNetPassword(newPassword))
      .query('UPDATE dbo.AspNetUsers SET PasswordHash = @passwordHash, MustChangePassword = 0 WHERE UserId = @userId');
    if (passwordResult.rowsAffected[0] !== 1) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(500).json({ message: 'Unable to reset password.' });
    }
    await transaction.request()
      .input('userId', sql.Int, userId)
      .query('UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE UserId = @userId AND UsedAt IS NULL');
    await transaction.commit();
    transactionStarted = false;
    return res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (error) {
    if (transactionStarted && transaction) {
      try { await transaction.rollback(); } catch (rollbackError) {
        logError(rollbackError, { context: 'resetPasswordRollback' });
      }
    }
    logError(error, { context: 'resetPassword' });
    return res.status(500).json({ message: 'Unable to reset the password. Please request a new reset link.' });
  }
});

app.get('/api/admin/verify', requireAdmin, async (req, res) => {
  const staff = req.staff;
  let profile = { userName: '', email: '' };
  if (staff.userId > 0) {
    try {
      const result = await getPool().request().input('id', sql.Int, staff.userId)
        .query('SELECT UserName, EmailAddress FROM dbo.AspNetUsers WHERE UserId = @id');
      const row = result.recordset[0];
      if (row) profile = { userName: row.UserName, email: row.EmailAddress };
    } catch (error) {
      logError(error, { context: 'adminVerifyProfile' });
    }
  }
  res.json({
    ok: true,
    user: {
      id: staff.userId,
      role: staff.role || 'Admin',
      ...profile,
      mustChangePassword: Boolean(staff.mustChangePassword),
      overrides: staff.overrides || {},
    },
  });
});

function defaultStaffPassword() {
  return process.env.DEFAULT_STAFF_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'Parish@12345');
}

app.post('/api/admin/change-password', authRateLimit, requireAdmin, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (req.staff.userId <= 0) return res.status(400).json({ message: 'This sign-in method has no password to change.' });
  if (newPassword.length < 8 || newPassword.length > 128) {
    return res.status(400).json({ message: 'The new password must be 8 to 128 characters.' });
  }
  if (newPassword === currentPassword || newPassword === defaultStaffPassword()) {
    return res.status(400).json({ message: 'Choose a new password that is different from your current and default password.' });
  }
  try {
    const result = await getPool().request().input('id', sql.Int, req.staff.userId)
      .query('SELECT UserName, PasswordHash FROM dbo.AspNetUsers WHERE UserId = @id');
    const user = result.recordset[0];
    if (!user || !verifyAspNetPassword(currentPassword, user.PasswordHash)) {
      return res.status(401).json({ message: 'Your current password is incorrect.' });
    }
    const updateResult = await getPool().request()
      .input('id', sql.Int, req.staff.userId)
      .input('hash', sql.NVarChar(1024), hashAspNetPassword(newPassword))
      .query('UPDATE dbo.AspNetUsers SET PasswordHash = @hash, MustChangePassword = 0 WHERE UserId = @id');
    if (updateResult.rowsAffected[0] !== 1) {
      return res.status(500).json({ message: 'Unable to change password.' });
    }
    try {
      await getPool().request()
        .input('action', sql.VarChar(40), 'ChangeOwnPassword')
        .input('target', sql.Int, req.staff.userId)
        .input('targetName', sql.NVarChar(512), user.UserName)
        .input('by', sql.NVarChar(512), user.UserName)
        .input('details', sql.NVarChar(sql.MAX), null)
        .query(`
          INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
          VALUES (@action, @target, @targetName, @by, @details)
        `);
    } catch (auditError) {
      logError(auditError, { context: 'auditChangeOwnPassword', userId: req.staff.userId });
    }
    return res.json({ message: 'Password changed.' });
  } catch (error) {
    logError(error, { context: 'changeOwnPassword' });
    return res.status(500).json({ message: 'Unable to change password.' });
  }
});

app.put('/api/admin/profile', requireAdmin, async (req, res) => {
  const userName = typeof req.body?.userName === 'string' ? req.body.userName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (req.staff.userId <= 0) return res.status(400).json({ message: 'This sign-in method has no profile.' });
  if (!userName || userName.length > 256 || !isValidEmail(email) || email.length > 510) {
    return res.status(400).json({ message: 'A username and valid email address are required.' });
  }
  try {
    const duplicate = await getPool().request()
      .input('id', sql.Int, req.staff.userId)
      .input('email', sql.NVarChar(510), email)
      .query('SELECT TOP 1 UserId FROM dbo.AspNetUsers WHERE EmailAddress = @email AND UserId <> @id');
    if (duplicate.recordset.length) return res.status(409).json({ message: 'Another account already uses this email address.' });
    await getPool().request()
      .input('id', sql.Int, req.staff.userId)
      .input('userName', sql.NVarChar(256), userName)
      .input('email', sql.NVarChar(510), email)
      .query('UPDATE dbo.AspNetUsers SET UserName = @userName, EmailAddress = @email WHERE UserId = @id');
    return res.json({ userName, email });
  } catch (error) {
    logError(error, { context: 'updateOwnProfile' });
    return res.status(500).json({ message: 'Unable to update profile.' });
  }
});

app.get('/api/admin/users/:id/permissions', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid staff account ID is required.' });
  try {
    const result = await getPool().request().input('id', sql.Int, id)
      .query('SELECT ModuleName, CanView, CanEdit FROM dbo.UserModulePermissions WHERE UserId = @id');
    res.json({ overrides: Object.fromEntries(result.recordset.map(row => [row.ModuleName, { view: Boolean(row.CanView), edit: Boolean(row.CanEdit) }])) });
  } catch (error) {
    logError(error, { context: 'getUserPermissions' });
    res.status(500).json({ message: 'Unable to load permissions.' });
  }
});

app.put('/api/admin/users/:id/permissions', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const id = Number(req.params.id);
  const overrides = req.body?.overrides;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid staff account ID is required.' });
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) ||
      !Object.entries(overrides).every(([module, value]) =>
        OVERRIDABLE_MODULES.includes(module) && value && typeof value.view === 'boolean' && typeof value.edit === 'boolean')) {
    return res.status(400).json({ message: 'The permissions have an invalid format.' });
  }

  let transaction;
  let transactionStarted = false;
  try {
    transaction = new sql.Transaction(getPool());
    await transaction.begin();
    transactionStarted = true;
    const target = await transaction.request().input('id', sql.Int, id)
      .query('SELECT UserName FROM dbo.AspNetUsers WHERE UserId = @id');
    if (!target.recordset[0]) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Staff account not found.' });
    }
    await transaction.request().input('id', sql.Int, id).query('DELETE FROM dbo.UserModulePermissions WHERE UserId = @id');
    for (const [module, value] of Object.entries(overrides)) {
      await transaction.request()
        .input('id', sql.Int, id)
        .input('module', sql.NVarChar(50), module)
        .input('view', sql.Bit, value.view || value.edit)
        .input('edit', sql.Bit, value.edit)
        .input('by', sql.NVarChar(512), staffName(req))
        .query('INSERT INTO dbo.UserModulePermissions (UserId, ModuleName, CanView, CanEdit, UpdatedBy) VALUES (@id, @module, @view, @edit, @by)');
    }
    await transaction.request()
      .input('action', sql.VarChar(40), 'UpdatePermissions')
      .input('target', sql.Int, id)
      .input('targetName', sql.NVarChar(512), target.recordset[0].UserName)
      .input('by', sql.NVarChar(512), staffName(req))
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify(overrides))
      .query(`
        INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
        VALUES (@action, @target, @targetName, @by, @details)
      `);
    await transaction.commit();
    transactionStarted = false;
    res.json({ message: 'Permissions updated.' });
  } catch (error) {
    if (transactionStarted) {
      try { await transaction.rollback(); } catch (rollbackError) { logError(rollbackError, { context: 'updatePermissionsRollback' }); }
    }
    logError(error, { context: 'updateUserPermissions' });
    res.status(500).json({ message: 'Unable to update permissions.' });
  }
});

app.get('/api/admin/users', requireAdmin, requireRole(['Admin', 'ParishPriest', 'Secretary']), async (req, res) => {
  try {
    const result = await getPool().request()
      .input('includeDetails', sql.Bit, req.staff.role === 'Admin' ? 1 : 0)
      .query(`
      SELECT u.UserId AS userId, u.UserName AS userName,
        CASE WHEN @includeDetails = 1 THEN u.EmailAddress ELSE NULL END AS email,
        u.EmailConfirmed AS emailConfirmed, CAST(0 AS bit) AS lockoutEnabled,
        0 AS accessFailedCount, COALESCE(r.Name, 'Staff') AS roleName
      FROM dbo.AspNetUsers u
      LEFT JOIN dbo.AspNetUserRoles ur ON ur.UserId = u.UserId
      LEFT JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
      ORDER BY u.UserName
    `);
    const users = result.recordset.reduce((items, row) => {
      const item = items.find(value => value.userId === row.userId);
      if (item) item.roles.push(row.roleName);
      else items.push({
        userId: row.userId,
        userName: row.userName,
        email: row.email,
        emailConfirmed: Boolean(row.emailConfirmed),
        lockoutEnabled: Boolean(row.lockoutEnabled),
        accessFailedCount: row.accessFailedCount,
        roles: row.roleName ? [row.roleName] : [],
      });
      return items;
    }, []);
    res.json(users);
  } catch (error) {
    logError(error, { context: 'adminUsers' });
    res.status(500).json({ message: 'Unable to load staff accounts.' });
  }
});

app.get('/api/admin/audit/user-management', requireAdmin, requireRole(['Admin']), async (req, res) => {
  try { const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100)); const result = await getPool().request().input('limit', sql.Int, limit).query('SELECT TOP (@limit) * FROM dbo.UserManagementAudit ORDER BY ChangedAt DESC'); res.json(result.recordset); } catch (error) { logError(error, { context: 'userAudit' }); res.status(500).json({ message: 'Unable to load user audit history.' }); }
});

app.post('/api/admin/users', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const { userName, email, role } = req.body || {};
  const password = req.body?.password ? req.body.password : defaultStaffPassword();
  const username = typeof userName === 'string' ? userName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const validRoles = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];
  const selectedRole = role || 'Staff';
  if (!username || username.length > 256 || !isValidEmail(normalizedEmail) || normalizedEmail.length > 510 ||
      typeof password !== 'string' || password.length < 8 || !validRoles.includes(selectedRole)) {
    return res.status(400).json({ message: 'A username, valid email, and valid role are required, and a default password of at least eight characters must be configured.' });
  }

  let transaction;
  let transactionStarted = false;
  try {
    const db = getPool();
    const roleResult = await db.request()
      .input('name', sql.NVarChar(510), selectedRole)
      .query('SELECT RoleId FROM dbo.AspNetRoles WHERE Name = @name');
    if (!roleResult.recordset[0]) {
      return res.status(500).json({ message: 'Role is not configured in the database.' });
    }

    transaction = new sql.Transaction(db);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    const duplicate = await transaction.request()
      .input('email', sql.NVarChar(510), normalizedEmail)
      .query('SELECT TOP 1 UserId FROM dbo.AspNetUsers WHERE EmailAddress = @email');
    if (duplicate.recordset.length) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }

    const user = await transaction.request()
      .input('username', sql.NVarChar(256), username)
      .input('email', sql.NVarChar(510), normalizedEmail)
      .input('hash', sql.NVarChar(1024), hashAspNetPassword(password))
      .query(`
        INSERT INTO dbo.AspNetUsers (UserName, EmailAddress, EmailConfirmed, PasswordHash, MustChangePassword)
        OUTPUT INSERTED.UserId
        VALUES (@username, @email, 1, @hash, 1)
      `);
    const userId = user.recordset[0].UserId;

    await transaction.request()
      .input('userId', sql.Int, userId)
      .input('roleId', sql.Int, roleResult.recordset[0].RoleId)
      .query('INSERT INTO dbo.AspNetUserRoles (UserId, RoleId) VALUES (@userId, @roleId)');
    await transaction.request()
      .input('action', sql.VarChar(40), 'CreateUser')
      .input('target', sql.Int, userId)
      .input('targetName', sql.NVarChar(512), username)
      .input('by', sql.NVarChar(512), staffName(req))
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ role: selectedRole, email: normalizedEmail }))
      .query(`
        INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
        VALUES (@action, @target, @targetName, @by, @details)
      `);
    await transaction.commit();
    transactionStarted = false;
    res.status(201).json({ userId });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logError(rollbackError, { context: 'createAdminUserRollback' });
      }
    }
    logError(error, { context: 'createAdminUser' });
    res.status(500).json({ message: 'Unable to create staff account.' });
  }
});

app.put('/api/admin/users/:id', requireAdmin, requireRole(['Admin', 'ParishPriest', 'Secretary']), async (req, res) => {
  const id = Number(req.params.id);
  const resetToDefault = req.body?.resetToDefault === true;
  const password = resetToDefault ? defaultStaffPassword() : req.body?.password;
  const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email');
  const email = hasEmail && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const validRoles = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];
  const requestedRoles = Array.isArray(req.body?.roles) ? req.body.roles : (req.body?.role ? [req.body.role] : null);
  const hasPassword = password !== undefined && password !== null && password !== '';
  if (resetToDefault && req.body?.password) return res.status(400).json({ message: 'Choose either a default reset or a custom password.' });
  if (req.staff.role !== 'Admin' && (
    hasEmail ||
    hasPassword ||
    !requestedRoles ||
    Object.keys(req.body || {}).some(key => !['roles', 'role'].includes(key)) ||
    requestedRoles.includes('Admin')
  )) {
    return res.status(403).json({ message: 'Only Admin users can change account details or assign the Admin role.' });
  }
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid staff account ID is required.' });
  if (hasEmail && (!isValidEmail(email) || email.length > 510)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (hasPassword && (typeof password !== 'string' || password.length < 8)) {
    return res.status(400).json({ message: 'The password must be at least eight characters.' });
  }
  if (requestedRoles && (requestedRoles.length === 0 || !requestedRoles.every(name => validRoles.includes(name)))) {
    return res.status(400).json({ message: 'A valid role is required.' });
  }
  if (!hasEmail && !hasPassword && !requestedRoles) {
    return res.status(400).json({ message: 'At least one account change is required.' });
  }

  let transaction;
  let transactionStarted = false;
  try {
    const db = getPool();
    const roleIds = [];
    if (requestedRoles) {
      for (const name of [...new Set(requestedRoles)]) {
        const roleRow = await db.request()
          .input('name', sql.NVarChar(510), name)
          .query('SELECT RoleId FROM dbo.AspNetRoles WHERE Name = @name');
        if (!roleRow.recordset[0]) {
          return res.status(400).json({ message: `Role ${name} is not configured.` });
        }
        roleIds.push(roleRow.recordset[0].RoleId);
      }
    }

    transaction = new sql.Transaction(db);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    const targetResult = await transaction.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT u.UserName, u.EmailAddress,
          CASE WHEN EXISTS (
            SELECT 1 FROM dbo.AspNetUserRoles ur
            INNER JOIN dbo.AspNetRoles r ON r.RoleId = ur.RoleId
            WHERE ur.UserId = u.UserId AND r.Name = 'Admin'
          ) THEN 1 ELSE 0 END AS IsAdmin
        FROM dbo.AspNetUsers u
        WHERE u.UserId = @id
      `);
    const target = targetResult.recordset[0];
    if (!target) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Staff account not found.' });
    }
    if (req.staff.role !== 'Admin' && target.IsAdmin) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(403).json({ message: 'Only Admin users can change an Admin account.' });
    }

    if (hasEmail) {
      const duplicate = await transaction.request()
        .input('id', sql.Int, id)
        .input('email', sql.NVarChar(510), email)
        .query('SELECT TOP 1 UserId FROM dbo.AspNetUsers WHERE EmailAddress = @email AND UserId <> @id');
      if (duplicate.recordset.length) {
        await transaction.rollback();
        transactionStarted = false;
        return res.status(409).json({ message: 'Another account already uses this email address.' });
      }
      await transaction.request()
        .input('id', sql.Int, id)
        .input('email', sql.NVarChar(510), email)
        .query('UPDATE dbo.AspNetUsers SET EmailAddress = @email WHERE UserId = @id');
    }
    if (hasPassword) {
      await transaction.request()
        .input('id', sql.Int, id)
        .input('hash', sql.NVarChar(1024), hashAspNetPassword(password))
        .query('UPDATE dbo.AspNetUsers SET PasswordHash = @hash, MustChangePassword = 1 WHERE UserId = @id');
    }
    if (requestedRoles) {
      await transaction.request()
        .input('id', sql.Int, id)
        .query('DELETE FROM dbo.AspNetUserRoles WHERE UserId = @id');
      for (const roleId of roleIds) {
        await transaction.request()
          .input('id', sql.Int, id)
          .input('role', sql.Int, roleId)
          .query('INSERT INTO dbo.AspNetUserRoles (UserId, RoleId) VALUES (@id, @role)');
      }
    }

    const details = {};
    if (hasEmail) details.email = email;
    if (hasPassword) details.passwordChanged = true;
    if (resetToDefault) details.passwordResetToDefault = true;
    if (requestedRoles) details.roles = [...new Set(requestedRoles)];
    await transaction.request()
      .input('action', sql.VarChar(40), 'UpdateUser')
      .input('target', sql.Int, id)
      .input('targetName', sql.NVarChar(512), target.UserName)
      .input('by', sql.NVarChar(512), staffName(req))
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify(details))
      .query(`
        INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
        VALUES (@action, @target, @targetName, @by, @details)
      `);
    await transaction.commit();
    transactionStarted = false;
    res.json({ message: 'Staff account updated.' });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logError(rollbackError, { context: 'updateAdminUserRollback' });
      }
    }
    logError(error, { context: 'updateAdminUser' });
    res.status(500).json({ message: 'Unable to update staff account.' });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid staff account ID is required.' });

  let transaction;
  let transactionStarted = false;
  try {
    const db = getPool();
    transaction = new sql.Transaction(db);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    transactionStarted = true;
    const targetResult = await transaction.request()
      .input('id', sql.Int, id)
      .query('SELECT UserName, EmailAddress FROM dbo.AspNetUsers WHERE UserId = @id');
    const target = targetResult.recordset[0];
    if (!target) {
      await transaction.rollback();
      transactionStarted = false;
      return res.status(404).json({ message: 'Staff account not found.' });
    }

    await transaction.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.AspNetUserRoles WHERE UserId = @id');
    await transaction.request()
      .input('id', sql.Int, id)
      .query('DELETE FROM dbo.AspNetUsers WHERE UserId = @id');
    await transaction.request()
      .input('action', sql.VarChar(40), 'DeleteUser')
      .input('target', sql.Int, id)
      .input('targetName', sql.NVarChar(512), target.UserName)
      .input('by', sql.NVarChar(512), staffName(req))
      .input('details', sql.NVarChar(sql.MAX), JSON.stringify({ email: target.EmailAddress }))
      .query(`
        INSERT INTO dbo.UserManagementAudit (ActionName, TargetUserId, TargetUserName, ChangedBy, Details)
        VALUES (@action, @target, @targetName, @by, @details)
      `);
    await transaction.commit();
    transactionStarted = false;
    res.json({ message: 'Staff account deleted.' });
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logError(rollbackError, { context: 'deleteAdminUserRollback' });
      }
    }
    logError(error, { context: 'deleteAdminUser' });
    res.status(500).json({ message: 'Unable to delete staff account.' });
  }
});

app.get('/api/admin/prayers', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT PrayerId, Name, Category, Request, Anonymous, ShareWithCommunity, IsApproved, CreatedAt
      FROM dbo.PrayerRequests
      ORDER BY CreatedAt DESC
    `);

    const prayers = result.recordset.map(row => ({
      id: row.PrayerId,
      name: row.Name,
      category: row.Category,
      request: row.Request,
      anonymous: sqlBitToBoolean(row.Anonymous),
      shareWithCommunity: sqlBitToBoolean(row.ShareWithCommunity),
      isApproved: sqlBitToBoolean(row.IsApproved),
      createdAt: row.CreatedAt
    }));

    res.json(prayers);
  } catch (error) {
    console.error('Admin prayers lookup error:', error);
    res.status(500).json({ message: 'Unable to load prayers.' });
  }
})

app.delete('/api/prayers/:prayerId', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const { prayerId } = req.params;

  try {
    const pool = getPool();
    const request = pool.request().input('prayerId', sql.Int, prayerId);

    await request.query(`
      DELETE FROM dbo.PrayerRequests
      WHERE PrayerId = @prayerId
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete prayer error:', error);
    res.status(500).json({ message: 'Unable to delete prayer.' });
  }
});

app.get('/api/admin/service-requests', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    // Prefer ContactSnapshot columns if populated, fallback to Parishioner columns for legacy rows
    const result = await request.query(`
      SELECT
        sr.ServiceRequestId,
        sr.ParishionerId,
        sr.ServiceId,
        sr.ScheduledDate,
        sr.ScheduledTime,
        sr.Status,
        sr.Notes,
        sr.CreatedAt,
        bd.ChildFirstName, bd.ChildMiddleName, bd.ChildLastName, bd.ChildDateOfBirth, bd.PlaceOfBirth, bd.FatherFullName, bd.MotherFullName, bd.GodfatherName, bd.GodmotherName, bd.ExtraFieldsJson AS BaptismExtraFields,
        md.GroomFirstName, md.GroomMiddleName, md.GroomLastName, md.GroomAge, md.BrideFirstName, md.BrideMiddleName, md.BrideLastName, md.BrideAge, md.CenomarNumber, md.Witnesses, md.ExtraFieldsJson AS MarriageExtraFields,
        cd.CandidateFirstName, cd.CandidateMiddleName, cd.CandidateLastName, cd.CandidateDateOfBirth, cd.SponsorName, cd.ParishOfBaptism, cd.ExtraFieldsJson AS ConfirmationExtraFields,
        fd.DeceasedFirstName, fd.DeceasedMiddleName, fd.DeceasedLastName, fd.DateOfDeath, fd.RelationshipToDeceased, fd.PlaceOfWake, fd.ExtraFieldsJson AS FuneralExtraFields,
        hd.FullAddress AS HouseBlessingFullAddress, hd.Landmark AS HouseBlessingLandmark, hd.PreferredContactPerson AS HouseBlessingPreferredContactPerson, hd.ExtraFieldsJson AS HouseBlessingExtraFields,
        ISNULL(sr.ContactFirstName, p.FirstName) as FirstName,
        ISNULL(sr.ContactLastName, p.LastName) as LastName,
        ISNULL(sr.ContactEmail, p.EmailAddress) as EmailAddress,
        ISNULL(sr.ContactMobile, p.MobileNumber) as MobileNumber,
        ISNULL(sr.ContactAddress, p.Address) as Address,
        s.Name as ServiceName
      FROM dbo.ServiceRequest sr
      JOIN dbo.Parishioners p ON sr.ParishionerId = p.ParishionerId
      JOIN dbo.Service s ON sr.ServiceId = s.ServiceId
      LEFT JOIN dbo.BaptismRequestDetail bd ON sr.ServiceRequestId = bd.ServiceRequestId
      LEFT JOIN dbo.MarriageRequestDetail md ON sr.ServiceRequestId = md.ServiceRequestId
      LEFT JOIN dbo.ConfirmationRequestDetail cd ON sr.ServiceRequestId = cd.ServiceRequestId
      LEFT JOIN dbo.FuneralRequestDetail fd ON sr.ServiceRequestId = fd.ServiceRequestId
      LEFT JOIN dbo.HouseBlessingRequestDetail hd ON sr.ServiceRequestId = hd.ServiceRequestId
      ORDER BY sr.CreatedAt DESC
    `);

    const requests = result.recordset.map(row => {
      const details = Object.fromEntries(Object.entries({
        childFirstName: row.ChildFirstName,
        childMiddleName: row.ChildMiddleName,
        childLastName: row.ChildLastName,
        childDateOfBirth: row.ChildDateOfBirth,
        placeOfBirth: row.PlaceOfBirth,
        fatherFullName: row.FatherFullName,
        motherFullName: row.MotherFullName,
        godfatherName: row.GodfatherName,
        godmotherName: row.GodmotherName,
        groomFirstName: row.GroomFirstName,
        groomMiddleName: row.GroomMiddleName,
        groomLastName: row.GroomLastName,
        groomAge: row.GroomAge,
        brideFirstName: row.BrideFirstName,
        brideMiddleName: row.BrideMiddleName,
        brideLastName: row.BrideLastName,
        brideAge: row.BrideAge,
        cenomarNumber: row.CenomarNumber,
        witnesses: row.Witnesses,
        candidateFirstName: row.CandidateFirstName,
        candidateMiddleName: row.CandidateMiddleName,
        candidateLastName: row.CandidateLastName,
        candidateDateOfBirth: row.CandidateDateOfBirth,
        sponsorName: row.SponsorName,
        parishOfBaptism: row.ParishOfBaptism,
        deceasedFirstName: row.DeceasedFirstName,
        deceasedMiddleName: row.DeceasedMiddleName,
        deceasedLastName: row.DeceasedLastName,
        dateOfDeath: row.DateOfDeath,
        relationshipToDeceased: row.RelationshipToDeceased,
        placeOfWake: row.PlaceOfWake,
        fullAddress: row.HouseBlessingFullAddress,
        landmark: row.HouseBlessingLandmark,
        preferredContactPerson: row.HouseBlessingPreferredContactPerson,
      }).filter(([, value]) => value !== null && value !== undefined && value !== ''));

      for (const extraJson of [row.BaptismExtraFields, row.MarriageExtraFields, row.ConfirmationExtraFields, row.FuneralExtraFields, row.HouseBlessingExtraFields]) {
        if (extraJson) {
          try {
            Object.assign(details, JSON.parse(extraJson));
          } catch {
            // Keep the request visible if legacy detail JSON is malformed.
          }
        }
      }

      return {
        id: row.ServiceRequestId,
        parishionerId: row.ParishionerId,
        serviceId: row.ServiceId,
        firstName: row.FirstName,
        lastName: row.LastName,
        email: row.EmailAddress,
        mobileNumber: row.MobileNumber,
        address: row.Address,
        serviceName: row.ServiceName,
        scheduledDate: row.ScheduledDate,
        scheduledTime: row.ScheduledTime,
        status: row.Status,
        notes: row.Notes,
        createdAt: row.CreatedAt,
        details,
      };
    });

    res.json(requests);
  } catch (error) {
    console.error('Service requests lookup error:', error);
    res.status(500).json({ message: 'Unable to load service requests.' });
  }
});

app.get('/api/admin/service-fields', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (_req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT f.FieldDefinitionId, f.ServiceId, s.Name AS ServiceName, f.FieldKey, f.Label, f.FieldType, f.OptionsJson, f.IsRequired, f.SortOrder, f.IsActive
      FROM dbo.ServiceFieldDefinition f
      JOIN dbo.Service s ON s.ServiceId = f.ServiceId
      ORDER BY s.Name, f.SortOrder, f.FieldDefinitionId
    `);
    res.json(result.recordset.map(row => ({
      id: row.FieldDefinitionId,
      serviceId: row.ServiceId,
      serviceName: row.ServiceName,
      key: row.FieldKey,
      label: row.Label,
      type: row.FieldType,
      options: row.OptionsJson ? JSON.parse(row.OptionsJson) : undefined,
      required: !!row.IsRequired,
      sortOrder: row.SortOrder,
      active: !!row.IsActive,
    })));
  } catch (error) {
    console.error('Service field definitions lookup error:', error);
    res.status(500).json({ message: 'Unable to load field definitions.' });
  }
});

app.post('/api/admin/service-fields', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const { serviceId, key, label, type, options, required, sortOrder } = req.body;
  const numericServiceId = Number(serviceId);
  if (!Number.isInteger(numericServiceId) || numericServiceId <= 0 || !key || !label) {
    return res.status(400).json({ message: 'Service, field key, and label are required.' });
  }
  try {
    const result = await getPool().request()
      .input('serviceId', sql.Int, numericServiceId)
      .input('key', sql.VarChar(100), String(key))
      .input('label', sql.NVarChar(200), String(label))
      .input('type', sql.VarChar(20), String(type || 'text'))
      .input('options', sql.NVarChar(sql.MAX), Array.isArray(options) ? JSON.stringify(options) : null)
      .input('required', sql.Bit, !!required)
      .input('sortOrder', sql.Int, Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0)
      .query(`
        INSERT INTO dbo.ServiceFieldDefinition (ServiceId, FieldKey, Label, FieldType, OptionsJson, IsRequired, SortOrder)
        OUTPUT INSERTED.FieldDefinitionId
        VALUES (@serviceId, @key, @label, @type, @options, @required, @sortOrder)
      `);
    res.status(201).json({ id: result.recordset[0].FieldDefinitionId });
  } catch (error) {
    console.error('Field definition create error:', error);
    res.status(500).json({ message: 'Unable to create field definition. The field key may already exist for this service.' });
  }
});

app.put('/api/admin/service-fields/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const id = Number(req.params.id);
  const { label, type, options, required, sortOrder, active } = req.body;
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid field definition ID.' });
  }
  try {
    await getPool().request()
      .input('id', sql.Int, id)
      .input('label', sql.NVarChar(200), String(label))
      .input('type', sql.VarChar(20), String(type || 'text'))
      .input('options', sql.NVarChar(sql.MAX), Array.isArray(options) ? JSON.stringify(options) : null)
      .input('required', sql.Bit, !!required)
      .input('sortOrder', sql.Int, Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0)
      .input('active', sql.Bit, active === undefined ? true : !!active)
      .query(`
        UPDATE dbo.ServiceFieldDefinition
        SET Label = @label, FieldType = @type, OptionsJson = @options, IsRequired = @required, SortOrder = @sortOrder, IsActive = @active
        WHERE FieldDefinitionId = @id
      `);
    res.json({ message: 'Field definition updated.' });
  } catch (error) {
    console.error('Field definition update error:', error);
    res.status(500).json({ message: 'Unable to update field definition.' });
  }
});

app.delete('/api/admin/service-fields/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid field definition ID.' });
  }
  try {
    await getPool().request().input('id', sql.Int, id).query('DELETE FROM dbo.ServiceFieldDefinition WHERE FieldDefinitionId=@id');
    res.json({ message: 'Field definition deleted.' });
  } catch (error) {
    console.error('Field definition delete error:', error);
    res.status(500).json({ message: 'Unable to delete field definition.' });
  }
});

app.put('/api/admin/service-requests/:requestId', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (req, res) => {
  const requestId = Number(req.params.requestId);
  const { status, adminNotes } = req.body;

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: 'Invalid service request ID.' });
  }
  if (!status || !ALLOWED_REQUEST_STATUSES.includes(String(status))) {
    return res.status(400).json({ message: `Status must be one of: ${ALLOWED_REQUEST_STATUSES.join(', ')}.` });
  }

  try {
    const pool = getPool();
    const request = pool.request()
      .input('requestId', sql.Int, requestId)
      .input('status', sql.NVarChar(200), String(status));

    if (adminNotes) {
      const timestamp = new Date().toISOString();
      request.input('adminNote', sql.NVarChar(sql.MAX), '\n\n[ADMIN NOTE] ' + timestamp + ': ' + String(adminNotes));
      await request.query(`
        UPDATE dbo.ServiceRequest
        SET Status = @status,
            Notes = CONCAT(ISNULL(Notes, N''), @adminNote),
            VoidedAt = CASE WHEN @status IN ('Voided','VoidedNoShow','Cancelled') THEN SYSUTCDATETIME() ELSE VoidedAt END
        WHERE ServiceRequestId = @requestId
      `);
    } else {
      await request.query(`
        UPDATE dbo.ServiceRequest
        SET Status = @status,
            VoidedAt = CASE WHEN @status IN ('Voided','VoidedNoShow','Cancelled') THEN SYSUTCDATETIME() ELSE VoidedAt END
        WHERE ServiceRequestId = @requestId
      `);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Service request update error:', error);
    res.status(500).json({ message: 'Unable to update service request.' });
  }
});

app.delete('/api/admin/service-requests/:requestId', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (req, res) => {
  const requestId = Number(req.params.requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: 'Invalid service request ID.' });
  }

  try {
    await deleteServiceRequest(new sql.Transaction(getPool()), requestId);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete service request error:', error);
    res.status(500).json({ message: 'Unable to delete service request.' });
  }
});

const sacramentalDefinitions = {
  baptism: { table: 'BaptismRecords', id: 'BaptismId', date: 'DateOfBaptism', name: "CONCAT(ChildFirstName, ' ', ChildLastName)", priest: 'MinisterName', columns: ['RegistryNumber', 'ChildFirstName', 'ChildMiddleName', 'ChildLastName', 'DateOfBirth', 'PlaceOfBirth', 'DateOfBaptism', 'FatherFullName', 'MotherFullName', 'MinisterName', 'Sponsors', 'Remarks'] },
  confirmation: { table: 'ConfirmationRecords', id: 'ConfirmationId', date: 'DateOfConfirmation', name: "CONCAT(CandidateFirstName, ' ', CandidateLastName)", priest: 'BishopOrMinister', columns: ['RegistryNumber', 'CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName', 'CandidateDateOfBirth', 'SponsorName', 'ParishOfBaptism'] },
  marriage: { table: 'MarriageRecords', id: 'MarriageId', date: 'DateOfMarriage', name: "CONCAT(GroomFirstName, ' ', GroomLastName, ' / ', BrideFirstName, ' ', BrideLastName)", priest: 'SolemnizingPriest', columns: ['RegistryNumber', 'GroomFirstName', 'GroomMiddleName', 'GroomLastName', 'GroomAge', 'GroomParents', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName', 'BrideAge', 'BrideParents', 'DateOfMarriage', 'Witnesses', 'SolemnizingPriest'] },
  death: { table: 'DeathRecords', id: 'DeathId', date: 'DateOfDeath', name: "CONCAT(DeceasedFirstName, ' ', DeceasedLastName)", priest: 'OfficiatingPriest', columns: ['RegistryNumber', 'DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName', 'Age', 'DateOfDeath', 'DateOfBurial', 'CauseOfDeath', 'PlaceOfBurial', 'SacramentsReceived', 'OfficiatingPriest'] },
};

const staffName = req => req.staff?.email || req.staff?.role || 'staff';
const requestValue = (body, key) => body[key] ?? body[key.charAt(0).toLowerCase() + key.slice(1)] ?? null;
const sqlBitToBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', ''].includes(normalized)) return false;
  }
  return Boolean(value);
};

app.get('/api/admin/operations/schedule', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper', 'Staff']), async (_req, res) => {
  try {
    const result = await getPool().request().query(`SELECT MassScheduleId AS id, Title AS title, MassDate AS date, MassTime AS time, Location AS location, PriestUsername AS priestUsername, Notes AS notes, Status AS status FROM dbo.MassSchedule ORDER BY MassDate, MassTime`);
    res.json(result.recordset);
  } catch (error) { logError(error, { context: 'operationSchedule' }); res.status(500).json({ message: 'Unable to load schedules.' }); }
});

app.post('/api/admin/operations/schedule', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const { title, date, time, location, priestUsername, notes, status } = req.body || {};
  if (!title || !date || !time || !location || !priestUsername) return res.status(400).json({ message: 'Schedule title, date, time, location, and minister are required.' });
  try {
    const pool = getPool();
    const clash = await pool.request().input('date', sql.Date, date).input('time', sql.VarChar(10), time).query(`SELECT MassScheduleId AS id, MassDate AS date, MassTime AS time, Location AS location, PriestUsername AS priestUsername, Status AS status FROM dbo.MassSchedule WHERE MassDate=@date AND MassTime=@time`);
    const conflict = findScheduleConflict({ date, time, location, priestUsername }, clash.recordset);
    if (conflict.conflict) return res.status(409).json({ message: conflict.message });
    const result = await pool.request().input('title', sql.NVarChar(400), title).input('date', sql.Date, date).input('time', sql.VarChar(10), time).input('location', sql.NVarChar(510), location).input('priest', sql.VarChar(256), priestUsername).input('notes', sql.NVarChar(2000), notes || null).input('status', sql.VarChar(30), status || 'Scheduled').query(`INSERT INTO dbo.MassSchedule (Title, MassDate, MassTime, Location, PriestUsername, Notes, Status) OUTPUT INSERTED.MassScheduleId AS id VALUES (@title, @date, @time, @location, @priest, @notes, @status)`);
    res.status(201).json(result.recordset[0]);
  } catch (error) { logError(error, { context: 'createSchedule' }); res.status(500).json({ message: 'Unable to save schedule.' }); }
});

app.put('/api/admin/operations/schedule/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (req, res) => {
  const { title, date, time, location, priestUsername, notes, status } = req.body || {};
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid schedule ID.' });
  try {
    const pool = getPool();
    const clash = await pool.request().input('date', sql.Date, date).input('time', sql.VarChar(10), time).query(`SELECT MassScheduleId AS id, MassDate AS date, MassTime AS time, Location AS location, PriestUsername AS priestUsername, Status AS status FROM dbo.MassSchedule WHERE MassDate=@date AND MassTime=@time`);
    const conflict = findScheduleConflict({ date, time, location, priestUsername, excludeId: id }, clash.recordset);
    if (conflict.conflict) return res.status(409).json({ message: conflict.message });
    await pool.request().input('id', sql.Int, id).input('title', sql.NVarChar(400), title).input('date', sql.Date, date).input('time', sql.VarChar(10), time).input('location', sql.NVarChar(510), location).input('priest', sql.VarChar(256), priestUsername).input('notes', sql.NVarChar(2000), notes || null).input('status', sql.VarChar(30), status || 'Scheduled').query(`UPDATE dbo.MassSchedule SET Title=@title, MassDate=@date, MassTime=@time, Location=@location, PriestUsername=@priest, Notes=@notes, Status=@status, UpdatedAt=SYSUTCDATETIME() WHERE MassScheduleId=@id`);
    res.json({ message: 'Schedule updated.' });
  } catch (error) { logError(error, { context: 'updateSchedule' }); res.status(500).json({ message: 'Unable to update schedule.' }); }
});

app.delete('/api/admin/operations/schedule/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid schedule ID.' });
  try {
    const result = await getPool().request().input('id', sql.Int, id).query('DELETE FROM dbo.MassSchedule WHERE MassScheduleId=@id');
    if (!result.rowsAffected[0]) return res.status(404).json({ message: 'Schedule not found.' });
    res.json({ message: 'Schedule deleted.' });
  } catch (error) { logError(error, { context: 'deleteSchedule' }); res.status(500).json({ message: 'Unable to delete schedule.' }); }
});

app.get('/api/admin/operations/mass-intentions', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (_req, res) => {
  try { const result = await getPool().request().query('SELECT * FROM dbo.MassIntentions ORDER BY IntentionDate, IntentionTime'); res.json(result.recordset); } catch (error) { logError(error, { context: 'massIntentions' }); res.status(500).json({ message: 'Unable to load Mass intentions.' }); }
});

app.post('/api/admin/operations/mass-intentions', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (req, res) => {
  const { date, time, offering, requestedBy, intentionText } = req.body || {};
  if (!date || !time || !requestedBy || !intentionText) return res.status(400).json({ message: 'Mass intention date, time, requester, and intention are required.' });
  try {
    const pool = getPool();
    const clash = await pool.request().input('date', sql.Date, date).input('time', sql.VarChar(10), time).query('SELECT MassIntentionId AS id, IntentionDate AS date, IntentionTime AS time, Status AS status FROM dbo.MassIntentions WHERE IntentionDate=@date AND IntentionTime=@time');
    const conflict = findIntentionConflict({ date, time }, clash.recordset);
    if (conflict.conflict) return res.status(409).json({ message: conflict.message });
    const result = await pool.request().input('date', sql.Date, date).input('time', sql.VarChar(10), time).input('offering', sql.Decimal(12, 2), Number(offering || 0)).input('requestedBy', sql.NVarChar(200), requestedBy).input('text', sql.NVarChar(1000), intentionText).input('createdBy', sql.NVarChar(256), staffName(req)).query(`INSERT INTO dbo.MassIntentions (IntentionDate, IntentionTime, Offering, RequestedBy, IntentionText, CreatedBy) OUTPUT INSERTED.MassIntentionId VALUES (@date,@time,@offering,@requestedBy,@text,@createdBy)`); res.status(201).json(result.recordset[0]);
  } catch (error) { logError(error, { context: 'createMassIntention' }); res.status(500).json({ message: 'Unable to save Mass intention.' }); }
});

app.put('/api/admin/operations/mass-intentions/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff']), async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid Mass intention ID.' });
  if (!['Scheduled', 'Completed', 'Cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid intention status.' });
  try { await getPool().request().input('id', sql.Int, id).input('status', sql.VarChar(30), status).query('UPDATE dbo.MassIntentions SET Status=@status, UpdatedAt=SYSUTCDATETIME() WHERE MassIntentionId=@id'); res.json({ message: 'Mass intention updated.' }); } catch (error) { logError(error, { context: 'updateMassIntention' }); res.status(500).json({ message: 'Unable to update Mass intention.' }); }
});

app.get('/api/admin/operations/finance', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper']), async (_req, res) => {
  try { const result = await getPool().request().query('SELECT TOP 200 * FROM dbo.FinancialEntries ORDER BY EntryDate DESC, FinancialEntryId DESC'); res.json(result.recordset); } catch (error) { logError(error, { context: 'financeEntries' }); res.status(500).json({ message: 'Unable to load financial entries.' }); }
});

app.post('/api/admin/operations/finance', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper']), async (req, res) => {
  const { date, entryType, description, amount } = req.body || {};
  if (!date || !entryType || !description || Number(amount) <= 0) return res.status(400).json({ message: 'A valid finance date, type, description, and amount are required.' });
  try { const result = await getPool().request().input('date', sql.Date, date).input('type', sql.VarChar(30), entryType).input('description', sql.NVarChar(500), description).input('amount', sql.Decimal(12, 2), Number(amount)).input('enteredBy', sql.NVarChar(256), staffName(req)).query(`INSERT INTO dbo.FinancialEntries (EntryDate, EntryType, Description, Amount, EnteredBy) OUTPUT INSERTED.FinancialEntryId VALUES (@date,@type,@description,@amount,@enteredBy)`); res.status(201).json(result.recordset[0]); } catch (error) { logError(error, { context: 'createFinanceEntry' }); res.status(500).json({ message: 'Unable to create finance entry.' }); }
});

app.put('/api/admin/operations/finance/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper']), async (req, res) => {
  const id = Number(req.params.id);
  const { date, entryType, description, amount, status } = req.body;
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid finance entry ID.' });
  try {
    const pool = getPool();
    await pool.request()
      .input('id', sql.Int, id)

      .input('date', sql.Date, date)
      .input('type', sql.VarChar(30), entryType)
      .input('description', sql.NVarChar(500), description)
      .input('amount', sql.Decimal(12, 2), Number(amount))
      .input('status', sql.VarChar(30), status)
      .query(`
        UPDATE dbo.FinancialEntries
        SET EntryDate = @date, EntryType = @type, Description = @description, Amount = @amount, Status = @status
        WHERE FinancialEntryId = @id
      `);
    res.json({ message: 'Finance entry updated.' });
  } catch (error) {
    console.error('Finance entry update error:', error);
    res.status(500).json({ message: 'Unable to update finance entry.' });
  }
});

app.delete('/api/admin/operations/finance/:id', requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper']), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid finance entry ID.' });
  try {
    await getPool().request().input('id', sql.Int, id).query('DELETE FROM dbo.FinancialEntries WHERE FinancialEntryId=@id');
    res.json({ message: 'Finance entry deleted.' });
  } catch (error) { logError(error, { context: 'deleteFinanceEntry' }); res.status(500).json({ message: 'Unable to delete finance entry.' }); }
});

app.get('/api/admin/operations/audit', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try { const result = await getPool().request().query('SELECT * FROM dbo.SystemAudit ORDER BY EventTime DESC'); res.json(result.recordset); } catch (error) { logError(error, { context: 'auditLog' }); res.status(500).json({ message: 'Unable to load audit log.' }); }
});

app.post('/api/admin/operations/audit/clear', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    await getPool().request().query('DELETE FROM dbo.SystemAudit');
    res.json({ message: 'Audit log cleared.' });
  } catch (error) {
    logError(error, { context: 'clearAuditLog' });
    res.status(500).json({ message: 'Unable to clear audit log.' });
  }
});

app.get('/api/admin/operations/health', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const result = await getPool().request().query('SELECT 1 AS HealthCheck');
    res.json({ healthy: true, details: result.recordset });
  } catch (error) {
    logError(error, { context: 'adminHealthCheck' });
    res.status(500).json({ healthy: false, message: 'Health check failed.' });
  }
});

app.get('/api/admin/operations/status', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const result = await getPool().request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.ServiceRequest WHERE Status = 'PendingVerification') AS PendingVerifications,
        (SELECT COUNT(*) FROM dbo.ServiceRequest WHERE Status = 'Confirmed') AS ConfirmedRequests,
        (SELECT COUNT(*) FROM dbo.ServiceRequest WHERE Status IN ('Voided', 'VoidedNoShow')) AS VoidedRequests,
        (SELECT COUNT(*) FROM dbo.Parishioners) AS TotalParishioners,
        (SELECT COUNT(*) FROM dbo.AspNetUsers WHERE IsActive = 1) AS ActiveStaff
    `);
    res.json(result.recordset[0] || {});
  } catch (error) {
    logError(error, { context: 'adminStatusCheck' });
    res.status(500).json({ message: 'Unable to retrieve system status.' });
  }
});

app.get('/api/admin/operations/backup', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const backupFile = `ParishDB_Backup_${timestamp}.bak`;
    const backupPath = path.join(__dirname, 'backups', backupFile);

    await getPool().request()
      .input('file', sql.NVarChar(500), backupPath)
      .query(`
        BACKUP DATABASE [ParishDB]
        TO DISK = @file
        WITH FORMAT, MEDIANAME = 'SQLServerBackups', NAME = 'Full Backup of ParishDB'
      `);

    res.download(backupPath, backupFile, (err) => {
      if (err) {
        logError(err, { context: 'downloadBackupFile' });
        res.status(500).json({ message: 'Backup created but file download failed.' });
      } else {
        // Optionally, delete the backup file after download
        fs.unlink(backupPath, (err) => {
          if (err) logError(err, { context: 'deleteBackupFile' });
        });
      }
    });
  } catch (error) {
    logError(error, { context: 'backupDatabase' });
    res.status(500).json({ message: 'Unable to create database backup.' });
  }
});

app.post('/api/admin/operations/restore', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const { fileName } = req.body;
  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ message: 'A valid backup file name is required.' });
  }

  const filePath = path.join(__dirname, 'backups', fileName);
  try {
    await getPool().request()
      .input('file', sql.NVarChar(500), filePath)
      .query(`
        RESTORE DATABASE [ParishDB]
        FROM DISK = @file
        WITH REPLACE, RECOVERY
      `);
    res.json({ message: 'Database restore initiated. Please check the logs for progress.' });
  } catch (error) {
    logError(error, { context: 'restoreDatabase' });
    res.status(500).json({ message: 'Unable to restore database from the specified backup file.' });
  }
});

app.get('/api/admin/operations/backup-list', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    const files = await fs.promises.readdir(backupDir);
    const backups = files
      .filter(file => file.endsWith('.bak'))
      .map(file => ({
        fileName: file,
        filePath: path.join(backupDir, file),
        createdAt: fs.statSync(path.join(backupDir, file)).birthtime,
      }))
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first

    res.json(backups);
  } catch (error) {
    logError(error, { context: 'listBackupFiles' });
    res.status(500).json({ message: 'Unable to list backup files.' });
  }
});

app.delete('/api/admin/operations/backups', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const { olderThanDays } = req.body;
  if (typeof olderThanDays !== 'number' || olderThanDays < 1) {
    return res.status(400).json({ message: 'Invalid retention period. Specify the number of days.' });
  }

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - olderThanDays);

    const backupDir = path.join(__dirname, 'backups');
    const files = await fs.promises.readdir(backupDir);
    const deletions = [];

    for (const file of files) {
      if (file.endsWith('.bak')) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.birthtime < thresholdDate) {
          deletions.push(fs.promises.unlink(filePath));
        }
      }
    }

    await Promise.all(deletions);
    res.json({ message: 'Old backup files deleted.' });
  } catch (error) {
    logError(error, { context: 'deleteOldBackups' });
    res.status(500).json({ message: 'Unable to delete old backup files.' });
  }
});

app.get('/api/admin/operations/email-test', requireAdmin, requireRole(['Admin']), async (req, res) => {
  try {
    const testEmail = process.env.TEST_EMAIL_ADDRESS;
    if (!testEmail) {
      return res.status(500).json({ message: 'Test email address is not configured.' });
    }

    const subject = 'Test Email from Parish Management System';
    const html = '<p>This is a test email to verify the email configuration in the Parish Management System.</p>';

    const result = await sendEmail(testEmail, subject, html);
    res.json({ message: 'Test email sent.', result });
  } catch (error) {
    logError(error, { context: 'emailTest' });
    res.status(500).json({ message: 'Unable to send test email.' });
  }
});

app.get('/api/admin/operations/email-logs', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const result = await getPool().request().query('SELECT * FROM dbo.EmailLogs ORDER BY SentAt DESC');
    res.json(result.recordset);
  } catch (error) {
    logError(error, { context: 'emailLogs' });
    res.status(500).json({ message: 'Unable to load email logs.' });
  }
});

app.delete('/api/admin/operations/email-logs', requireAdmin, requireRole(['Admin']), async (req, res) => {
  const { olderThanDays } = req.body;
  if (typeof olderThanDays !== 'number' || olderThanDays < 1) {
    return res.status(400).json({ message: 'Invalid retention period. Specify the number of days.' });
  }

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - olderThanDays);

    await getPool().request()
      .input('olderThan', sql.DateTime, thresholdDate)
      .query('DELETE FROM dbo.EmailLogs WHERE SentAt < @olderThan');

    res.json({ message: 'Old email logs deleted.' });
  } catch (error) {
    logError(error, { context: 'deleteOldEmailLogs' });
    res.status(500).json({ message: 'Unable to delete old email logs.' });
  }
});

app.get('/api/admin/operations/system-info', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  try {
    const [dbVersion, serverTime, uptime] = await Promise.all([
      getPool().request().query('SELECT @@VERSION AS version'),
      getPool().request().query('SELECT SYSDATETIME() AS serverTime'),
      new Promise(resolve => {
        const start = Date.now();
        setInterval(() => {
          const diff = Date.now() - start;
          resolve(diff);
        }, 1000);
      }),
    ]);

    res.json({
      version: dbVersion.recordset[0]?.version || 'Unknown',
      serverTime: serverTime.recordset[0]?.serverTime || new Date(),
      uptime: Math.floor(uptime / 1000),
    });
  } catch (error) {
    logError(error, { context: 'systemInfo' });
    res.status(500).json({ message: 'Unable to retrieve system information.' });
  }
});

app.get('/api/admin/operations/test', requireAdmin, requireRole(['Admin']), async (_req, res) => {
  res.json({ message: 'Test endpoint is working.' });
});

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ message: 'An unexpected error occurred.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  initializePool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }).catch(err => {
    console.error('Database initialization failed:', err);
    process.exit(1);
  });
});

startFinanceReportSchedule();
startNoShowVoidSchedule();
startTokenCleanupSchedule();