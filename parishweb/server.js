import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

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

// Simple metrics (fallback)
const metricsCollector = {
  recordMetric: () => {},
  startPeriodicReporting: () => {
    // Placeholder - metrics reporting
  },
};

const metricsMiddleware = (_req, _res, next) => next();

const handleHealthCheck = (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
};

const handleMetricsRequest = (_req, res) => {
  res.json({ totalRequests: 0, uptime: process.uptime() });
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
        AND ExpiresAt > GETUTCDATE()
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
      SET Used = 1, UsedAt = GETUTCDATE()
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
        WHERE ExpiresAt < GETUTCDATE()
      `);
      logger.info('Expired verification tokens cleaned up');
    } catch (error) {
      logError(error, { context: 'tokenCleanup' });
    }
  }, intervalMinutes * 60 * 1000);
};

dotenv.config();

const app = express();
const uploadDirectory = path.resolve('uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

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
    callback(null, file.mimetype.startsWith('image/'));
  },
});

// CORS configuration - restrict to frontend origin for security
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
  maxAge: 3600
};
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(uploadDirectory));

// Add logging and monitoring middleware
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);

const resend = new Resend(process.env.RESEND_API_KEY);

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
    trustServerCertificate: true,
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

const adminSecret = process.env.ADMIN_TOKEN || 'letmein';

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not configured, skipping email send');
    return null;
  }

  try {
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to,
      subject: subject,
      html: html
    });
    logEmail('sent', {
      to,
      subject,
      messageId: response.id,
      timestamp: new Date().toISOString()
    });
    return response;
  } catch (error) {
    logError(error, {
      action: 'sendEmail',
      to,
      subject
    });
    return null;
  }
}

function formatTime(date) {
  return date.toISOString().slice(11, 16);
}

function requireAdmin(req, res, next) {
  const token = String(req.headers['x-admin-token'] ?? '')
  if (!token || token !== adminSecret) {
    logAuth('failed', {
      endpoint: req.path,
      ip: req.ip,
      reason: token ? 'invalid_token' : 'missing_token'
    });
    return res.status(403).json({ message: 'Admin token is required.' })
  }
  logAuth('success', {
    endpoint: req.path,
    ip: req.ip
  });
  next()
}

app.post('/api/admin/uploads', requireAdmin, (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Photo must be smaller than 5 MB.'
        : 'Unable to upload the selected photo.';
      return res.status(400).json({ message });
    }

    if (error) {
      return res.status(400).json({ message: 'Only image files can be uploaded.' });
    }

    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please select an image file.' });
  }

  res.status(201).json({ photoUrl: `/uploads/${req.file.filename}` });
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
  const numericServiceId = Number(serviceId);
  const useServiceId = Number.isInteger(numericServiceId) && String(numericServiceId) === serviceId;

  try {
    if (useServiceId) {
      const pool = getPool();
      const request = pool.request();

      const bookedResult = await request
        .input('serviceId', sql.Int, numericServiceId)
        .query(`
        SELECT ScheduledDate, ScheduledTime
        FROM dbo.ServiceRequest
        WHERE ServiceId = @serviceId
          AND Status IN ('PendingVerification', 'Confirmed')
      `);

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
        slotTimes.forEach(time => {
          const key = `${isoDate}|${time}`;
          slots.push({ date: isoDate, time, available: !bookedSet.has(key) });
        });
        weekdayCount += 1;
      }
      slotDate.setDate(slotDate.getDate() + 1);
    }

    res.json({ serviceId, slots });
  } catch (error) {
    console.error('Slot lookup error:', error);
    res.status(500).json({ message: 'Unable to load available slots.' });
  }
});

app.post('/api/service-requests', async (req, res) => {
  const { serviceId, firstName, lastName, email, mobileNumber, address, scheduledDate, scheduledTime, notes } = req.body;

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
      INSERT INTO dbo.ServiceRequest
        (ParishionerId, ServiceId, RequestDate, ScheduledDate, ScheduledTime, Venue, Status, Notes, CreatedAt,
         ContactFirstName, ContactLastName, ContactEmail, ContactMobile, ContactAddress)
      OUTPUT INSERTED.ServiceRequestId
      VALUES
        (@parishionerId, @serviceId, GETDATE(), @scheduledDate, @scheduledTime, N'', N'PendingVerification', @notes, GETDATE(),
         @firstName, @lastName, @email, @mobileNumber, @address)
    `);

    const requestId = insertRequest.recordset[0].ServiceRequestId;
    const token = await createVerificationToken(requestId);

    const verificationLink = `${req.protocol}://${req.get('host')}/api/service-requests/verify?token=${token}`;

    // Send confirmation email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Service Booking Confirmation</h2>
        <p>Dear ${escapeHtml(firstName)},</p>
        <p>Thank you for booking a service with us! Here are your booking details:</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service ID:</strong> ${escapeHtml(String(serviceId))}</p>
          <p><strong>Scheduled Date:</strong> ${escapeHtml(scheduledDate)}</p>
          <p><strong>Scheduled Time:</strong> ${escapeHtml(scheduledTime)}</p>
          ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}
        </div>

        <p>Please click the link below to verify your booking:</p>
        <p><a href="${verificationLink}" style="background-color: #d4af37; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verify Booking</a></p>

        <p>If you did not make this booking or need to make changes, please contact us.</p>
        <p>Best regards,<br>Saint John Parish</p>
      </div>
    `;

    await sendEmail(email, 'Service Booking Confirmation', emailHtml);

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

app.get('/api/events', async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`SELECT * FROM dbo.Events ORDER BY EventDate`);

    const events = result.recordset
      .map((row, index) => {
        const id = row.EventId ?? row.Id ?? row.ID ?? row.id ?? 'event-' + index;
        const title = row.Title ?? row.Name ?? row.title ?? 'Untitled event';
        const detail = row.Body ?? row.body ?? row.Detail ?? row.detail ?? '';
        const dateValue = row.EventDate ?? row.Date ?? row.eventDate ?? row.date;
        const date = formatEventDate(dateValue);
        const time = String(row.EventTime ?? row.Time ?? row.eventTime ?? row.time ?? '').slice(0, 8);
        const location = row.Location ?? row.Venue ?? row.location ?? '';
        const photoUrl = row.PhotoUrl ?? row.photoUrl ?? '';

        if (!date) return null;

        return {
          id: String(id),
          title: String(title),
          detail: String(detail),
          date,
          time,
          location: String(location),
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
  const { title, detail, date, time, location, photoUrl } = req.body;

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
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('date', sql.Date, date)
      .input('time', sql.VarChar(10), time || '')
      .input('location', sql.NVarChar(255), location || '')
      .input('photoUrl', sql.NVarChar(1000), photoUrl || '');

    const result = await request.query(`
      INSERT INTO dbo.Events (Title, Body, EventDate, EventTime, Location, PhotoUrl)
      OUTPUT INSERTED.EventId
      VALUES (@title, @detail, @date, @time, @location, @photoUrl)
    `);

    const eventId = result.recordset[0]?.EventId;
    res.status(201).json({ id: String(eventId), title, detail, date, time: time || '', location, photoUrl: photoUrl || '' });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Unable to create event.' });
  }
});

app.put('/api/events/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const { title, detail, date, time, location, photoUrl } = req.body;

  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required.' });
  }

  try {
    const pool = getPool();
    const request = pool.request()
      .input('title', sql.NVarChar(255), title)
      .input('detail', sql.NVarChar(sql.MAX), detail || '')
      .input('date', sql.Date, date)
      .input('time', sql.VarChar(10), time || '')
      .input('location', sql.NVarChar(255), location || '')
      .input('photoUrl', sql.NVarChar(1000), photoUrl || '')
      .input('eventId', sql.Int, eventId);

    await request.query(`
      UPDATE dbo.Events
      SET Title = @title, Body = @detail, EventDate = @date, EventTime = @time, Location = @location, PhotoUrl = @photoUrl
      WHERE EventId = @eventId
    `);

    res.json({ id: String(eventId), title, detail, date, time: time || '', location, photoUrl: photoUrl || '' });
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

app.get('/api/admin/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/admin/prayers', requireAdmin, async (_req, res) => {
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
      anonymous: row.Anonymous === 1,
      shareWithCommunity: row.ShareWithCommunity === 1,
      isApproved: row.IsApproved === 1,
      createdAt: row.CreatedAt
    }));

    res.json(prayers);
  } catch (error) {
    console.error('Admin prayers lookup error:', error);
    res.status(500).json({ message: 'Unable to load prayers.' });
  }
})

app.delete('/api/prayers/:prayerId', requireAdmin, async (req, res) => {
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

app.get('/api/admin/service-requests', requireAdmin, async (_req, res) => {
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
        ISNULL(sr.ContactFirstName, p.FirstName) as FirstName,
        ISNULL(sr.ContactLastName, p.LastName) as LastName,
        ISNULL(sr.ContactEmail, p.EmailAddress) as EmailAddress,
        ISNULL(sr.ContactMobile, p.MobileNumber) as MobileNumber,
        ISNULL(sr.ContactAddress, p.Address) as Address,
        s.Name as ServiceName
      FROM dbo.ServiceRequest sr
      JOIN dbo.Parishioners p ON sr.ParishionerId = p.ParishionerId
      JOIN dbo.Service s ON sr.ServiceId = s.ServiceId
      ORDER BY sr.CreatedAt DESC
    `);

    const requests = result.recordset.map(row => ({
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
      createdAt: row.CreatedAt
    }));

    res.json(requests);
  } catch (error) {
    console.error('Service requests lookup error:', error);
    res.status(500).json({ message: 'Unable to load service requests.' });
  }
});

app.put('/api/admin/service-requests/:requestId', requireAdmin, async (req, res) => {
  const { requestId } = req.params;
  const { status, adminNotes } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required.' });
  }

  try {
    const pool = getPool();
    const request = pool.request();

    if (adminNotes) {
      const timestamp = new Date().toISOString();
      const adminNoteText = '\n\n[ADMIN NOTE] ' + timestamp + ': ' + adminNotes;
      await request.query(`
        UPDATE dbo.ServiceRequest
        SET Status = N'${status}', Notes = CONCAT(Notes, N'${adminNoteText.replace(/'/g, "''")}')
        WHERE ServiceRequestId = ${requestId}
      `);
    } else {
      await request.query(`
        UPDATE dbo.ServiceRequest
        SET Status = N'${status}'
        WHERE ServiceRequestId = ${requestId}
      `);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Service request update error:', error);
    res.status(500).json({ message: 'Unable to update service request.' });
  }
});

app.delete('/api/admin/service-requests/:requestId', requireAdmin, async (req, res) => {
  const requestId = Number(req.params.requestId);

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: 'Invalid service request ID.' });
  }

  try {
    const pool = getPool();
    const request = pool.request().input('requestId', sql.Int, requestId);

    await request.query(`
      DELETE FROM dbo.ServiceRequest
      WHERE ServiceRequestId = @requestId
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete service request error:', error);
    res.status(500).json({ message: 'Unable to delete service request.' });
  }
});

// Prayer Request endpoints
app.post('/api/prayers', async (req, res) => {
  const { name, category, request, anonymous, shareWithCommunity } = req.body;

  if (!request || request.trim().length < 10) {
    return res.status(400).json({ message: 'Prayer request must be at least 10 characters.' });
  }

  if (request.trim().length > 2000) {
    return res.status(400).json({ message: 'Prayer request must not exceed 2000 characters.' });
  }

  // Validate name if provided and not anonymous
  if (!anonymous && name && String(name).trim().length < 2) {
    return res.status(400).json({ message: 'Please provide a valid name.' });
  }

  try {
    const pool = getPool();
    const req_obj = pool.request()
      .input('name', sql.NVarChar(255), String(name || ''))
      .input('category', sql.NVarChar(100), String(category || 'other'))
      .input('request', sql.NVarChar(sql.MAX), String(request))
      .input('anonymous', sql.Bit, anonymous ? 1 : 0)
      .input('shareWithCommunity', sql.Bit, shareWithCommunity ? 1 : 0);

    const result = await req_obj.query(`
      INSERT INTO dbo.PrayerRequests (Name, Category, Request, Anonymous, ShareWithCommunity, CreatedAt, IsApproved)
      OUTPUT INSERTED.PrayerId
      VALUES (@name, @category, @request, @anonymous, @shareWithCommunity, GETDATE(), 0)
    `);

    res.json({
      prayerId: result.recordset[0]?.PrayerId,
      message: 'Prayer request submitted successfully. Thank you for your faith.'
    });
  } catch (error) {
    console.error('Prayer submission error:', error);
    res.status(500).json({ message: 'Unable to submit prayer request.' });
  }
});

app.get('/api/prayers', async (_req, res) => {
  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT PrayerId, Name, Category, Request, ShareWithCommunity, CreatedAt
      FROM dbo.PrayerRequests
      WHERE IsApproved = 1 AND ShareWithCommunity = 1
      ORDER BY CreatedAt DESC
    `);

    const prayers = result.recordset.map(row => ({
      id: row.PrayerId,
      name: row.Name,
      category: row.Category,
      request: row.Request,
      createdAt: row.CreatedAt
    }));

    res.json(prayers);
  } catch (error) {
    console.error('Prayers lookup error:', error);
    res.status(500).json({ message: 'Unable to load prayers.' });
  }
});

app.get('/api/prayers/:prayerId', async (req, res) => {
  const { prayerId } = req.params;

  try {
    const pool = getPool();
    const request = pool.request();

    const result = await request.query(`
      SELECT PrayerId, Name, Category, Request, CreatedAt
      FROM dbo.PrayerRequests
      WHERE PrayerId = ${prayerId} AND IsApproved = 1 AND ShareWithCommunity = 1
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Prayer not found.' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Prayer lookup error:', error);
    res.status(500).json({ message: 'Unable to load prayer.' });
  }
});

app.post('/api/prayers/:prayerId/approve', requireAdmin, async (req, res) => {
  const { prayerId } = req.params;

  try {
    const pool = getPool();
    const request = pool.request();

    await request.query(`
      UPDATE dbo.PrayerRequests
      SET IsApproved = 1
      WHERE PrayerId = ${prayerId}
    `);

    res.json({ message: 'Prayer approved.' });
  } catch (error) {
    console.error('Prayer approval error:', error);
    res.status(500).json({ message: 'Unable to approve prayer.' });
  }
});

app.get('/health', handleHealthCheck);

// Metrics endpoint (for monitoring and debugging)
app.get('/api/metrics', handleMetricsRequest);

app.post('/api/test-email', async (req, res) => {
  const { email, subject, message } = req.body;

  if (!email || !subject || !message) {
    return res.status(400).json({ message: 'Email, subject, and message are required.' });
  }

  try {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2></h2>
        <p></p>
        <p>---<br>This is a test email from your Parish website booking system.</p>
      </div>
    `;

    const result = await sendEmail(email, subject, html);

    if (result) {
      res.json({ success: true, message: 'Test email sent successfully!' });
    } else {
      res.status(500).json({ message: 'Failed to send test email. Check API key and try again.' });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ message: 'Error sending test email.' });
  }
});

app.listen(5000, () => {
  logger.info('API server started', {
    port: 5000,
    environment: process.env.NODE_ENV || 'development',
    url: 'http://localhost:5000'
  });
});

// Initialize database pool and handle graceful shutdown
(async () => {
  try {
    await initializePool(config);
    logger.info('Database pool initialized successfully');

    // Start cleanup of expired tokens every 60 minutes
    startTokenCleanupSchedule(60);

    // Start periodic metrics reporting (every 5 minutes)
    metricsCollector.startPeriodicReporting(300);
    logger.info('Metrics collection started');
  } catch (error) {
    logError(error, { context: 'Server initialization' });
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.warn('SIGTERM received, shutting down gracefully...');
  await closePool();
  logger.info('Database pool closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.warn('SIGINT received, shutting down gracefully...');
  await closePool();
  logger.info('Database pool closed');
  process.exit(0);
});