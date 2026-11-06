/**
 * Pure business rules shared by the API server and the automated test suite.
 * These functions contain no database or HTTP dependencies so they can be
 * unit-tested directly (real behavior, no mocks).
 */

/** Daily booking quotas and seasonal windows for parish services. */
export function servicePolicy(serviceName, scheduledDate, now = new Date()) {
  const name = String(serviceName || '').toLowerCase();
  const month = new Date(`${scheduledDate}T00:00:00`).getMonth() + 1;
  const currentMonth = now.getMonth() + 1;
  if (name.includes('confirmation')) {
    if (month !== 2) return { allowed: false, message: 'Confirmation ceremonies are available only in February.' };
    if (![1, 12].includes(currentMonth)) return { allowed: false, message: 'Confirmation registration is open only during December and January.' };
  }
  if (name.includes('first communion') && ![2, 12].includes(month)) {
    return { allowed: false, message: 'First Communion is available only in February or December.' };
  }
  if (name.includes('funeral')) return { allowed: true, quota: 3, quotaLabel: 'Funeral Mass' };
  if (name.includes('area') || name.includes('barangay')) return { allowed: true, quota: 2, quotaLabel: 'Area Mass' };
  if (name.includes('hall')) return { allowed: true, quota: 2, quotaLabel: 'Parish hall rental' };
  return { allowed: true };
}

/** Appointment start times during published parish office hours. */
export function officeHourSlotTimes(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return [];

  const weekday = parsed.getUTCDay();
  if (weekday === 0) return ['09:00', '10:00', '11:00'];
  if (weekday >= 2 && weekday <= 6) {
    return Array.from({ length: 8 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`);
  }
  return [];
}

/** Normalize and validate an admin block before it reaches SQL. */
export function normalizeBlockedSlotInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const { date, scope } = input;
  if (typeof date !== 'string' || officeHourSlotTimes(date).length === 0) return null;
  if (!['All', 'Service', 'Certificate'].includes(scope)) return null;

  const time = input.time == null || input.time === '' ? null : input.time;
  if (time !== null && (typeof time !== 'string' || !officeHourSlotTimes(date).includes(time))) return null;

  const serviceId = input.serviceId == null || input.serviceId === '' ? null : Number(input.serviceId);
  if (scope === 'Service' && (!Number.isInteger(serviceId) || serviceId <= 0)) return null;
  if (scope !== 'Service' && serviceId !== null) return null;

  const reason = input.reason == null || input.reason === '' ? null : input.reason;
  if (reason !== null && (typeof reason !== 'string' || reason.trim().length > 300)) return null;

  return { date, time, scope, serviceId, reason: reason?.trim() || null };
}

/**
 * Detect priest/location double-booking for a Mass schedule entry.
 * `candidate`: { date, time, location, priestUsername, excludeId? }
 * `existing`:  [{ id, date, time, location, priestUsername, status }]
 * Returns { conflict, reason } — reason is 'priest' | 'location' | null.
 */
export function findScheduleConflict(candidate, existing) {
  const normDate = value => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || '').slice(0, 10);
  };
  const normTime = value => String(value || '').slice(0, 5);
  const cDate = normDate(candidate.date);
  const cTime = normTime(candidate.time);
  const cLocation = String(candidate.location || '').trim().toLowerCase();
  const cPriest = String(candidate.priestUsername || '').trim().toLowerCase();

  for (const item of existing || []) {
    if (candidate.excludeId != null && Number(item.id) === Number(candidate.excludeId)) continue;
    if (String(item.status || '').toLowerCase() === 'cancelled') continue;
    if (normDate(item.date) !== cDate || normTime(item.time) !== cTime) continue;
    if (cPriest && String(item.priestUsername || '').trim().toLowerCase() === cPriest) {
      return { conflict: true, reason: 'priest', message: 'This minister already has a Mass scheduled at that date and time.' };
    }
    if (cLocation && String(item.location || '').trim().toLowerCase() === cLocation) {
      return { conflict: true, reason: 'location', message: 'That location is already booked at that date and time.' };
    }
  }
  return { conflict: false, reason: null, message: null };
}

/** Mass intention conflict: only one intention per date+time slot. */
export function findIntentionConflict(candidate, existing) {
  const normDate = value => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10));
  const normTime = value => String(value || '').slice(0, 5);
  const clash = (existing || []).some(item =>
    String(item.status || 'Scheduled').toLowerCase() !== 'cancelled' &&
    normDate(item.date) === normDate(candidate.date) &&
    normTime(item.time) === normTime(candidate.time));
  return clash
    ? { conflict: true, message: 'A Mass intention already exists for that date and time.' }
    : { conflict: false, message: null };
}

/**
 * Finance entry state machine.
 * States: Draft -> Submitted -> Approved -> Reconciled (terminal).
 * Submitted entries can be Rejected; Rejected entries go back to Draft on edit.
 * Returns the next status for an action, or null when the action is illegal.
 */
export function financeTransition(currentStatus, action) {
  const transitions = {
    Draft: { submit: 'Submitted', edit: 'Draft', delete: 'Deleted' },
    Submitted: { approve: 'Approved', reject: 'Rejected', edit: null, delete: null },
    Approved: { reconcile: 'Reconciled', edit: null, delete: null },
    Rejected: { edit: 'Draft', delete: 'Deleted', submit: 'Submitted' },
    Reconciled: { edit: null, delete: null, approve: null, reject: null },
  };
  const row = transitions[String(currentStatus || 'Draft')] || {};
  return Object.prototype.hasOwnProperty.call(row, action) ? row[action] : null;
}

export function financeActionForStatus(status) {
  return {
    Submitted: 'submit',
    Rejected: 'reject',
    Approved: 'approve',
    Reconciled: 'reconcile',
  }[status] || String(status).toLowerCase();
}

/**
 * No-show rule: a Confirmed appointment whose scheduled date+time has passed
 * by `graceHours` without attendance being marked is automatically voided.
 */
export function isNoShowEligible(request, now = new Date(), graceHours = 24) {
  if (!request) return false;
  if (String(request.status) !== 'Confirmed') return false;
  if (request.attendanceStatus) return false;
  const dateText = request.scheduledDate instanceof Date
    ? request.scheduledDate.toISOString().slice(0, 10)
    : String(request.scheduledDate || '').slice(0, 10);
  const timeText = String(request.scheduledTime || '00:00').slice(0, 5);
  const scheduledAt = new Date(`${dateText}T${timeText}:00`);
  if (Number.isNaN(scheduledAt.getTime())) return false;
  return now.getTime() - scheduledAt.getTime() >= graceHours * 60 * 60 * 1000;
}

/**
 * Expiration rule: unverified bookings (PendingVerification) are automatically
 * voided `expireHours` after creation so stale slots are released.
 */
export function isUnverifiedExpired(request, now = new Date(), expireHours = 48) {
  if (!request) return false;
  if (String(request.status) !== 'PendingVerification') return false;
  const createdAt = new Date(request.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() >= expireHours * 60 * 60 * 1000;
}

/** Whitelisted service-request statuses staff may set. */
export const ALLOWED_REQUEST_STATUSES = ['PendingVerification', 'PendingReview', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'Voided', 'VoidedNoShow'];

/** Documents are no longer needed once a booking request reaches a terminal state. */
export function shouldDeleteServiceRequestDocuments(status) {
  return ['Completed', 'Rejected', 'Cancelled', 'Voided', 'VoidedNoShow', 'ConflictVoided'].includes(String(status));
}

/** Validate sacramental archive uploads before they reach disk. */
export function isAllowedArchiveUpload(originalName, mimeType, size) {
  const extension = String(originalName || '').toLowerCase().split('.').pop();
  const allowedTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    pdf: 'application/pdf',
  };
  return Number.isFinite(Number(size))
    && Number(size) <= 20 * 1024 * 1024
    && allowedTypes[extension] === String(mimeType || '').toLowerCase();
}

/** Allow only bounded raster image formats that the public site can safely display. */
export function isAllowedImageUpload(originalName, mimeType, size) {
  const extension = String(originalName || '').toLowerCase().split('.').pop();
  const allowedTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return Number.isFinite(Number(size))
    && Number(size) > 0
    && Number(size) <= 5 * 1024 * 1024
    && allowedTypes[extension] === String(mimeType || '').toLowerCase();
}

/** Check file signatures after upload; filename extensions and MIME headers are client supplied. */
export function hasValidImageSignature(mimeType, bytes) {
  if (!(bytes instanceof Uint8Array)) return false;
  const type = String(mimeType || '').toLowerCase();
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === 'image/webp') {
    const header = String.fromCharCode(...bytes.subarray(0, 4));
    const format = String.fromCharCode(...bytes.subarray(8, 12));
    return bytes.length >= 12 && header === 'RIFF' && format === 'WEBP';
  }
  return false;
}

/** Check supported sacramental archive signatures after upload. */
export function hasValidArchiveSignature(mimeType, bytes) {
  if (!(bytes instanceof Uint8Array)) return false;
  const type = String(mimeType || '').toLowerCase();
  if (type === 'application/pdf') return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === 'image/tiff') {
    return bytes.length >= 4
      && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00)
        || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a));
  }
  return false;
}

/** Match client uploads to visible document fields and enforce their requirements. */
export function validateBookingDocumentUploads(fieldDefinitions, keys, files) {
  if (!Array.isArray(keys) || !Array.isArray(files) || keys.length !== files.length) {
    return { error: 'Unable to match the uploaded documents to their fields.' };
  }

  const definitions = new Map(
    (Array.isArray(fieldDefinitions) ? fieldDefinitions : [])
      .filter(field => field.FieldType === 'file' && Boolean(field.IsActive))
      .map(field => [String(field.FieldKey), field]),
  );
  const seen = new Set();
  const documents = [];

  for (let index = 0; index < files.length; index += 1) {
    const key = String(keys[index] || '');
    const definition = definitions.get(key);
    if (!definition || seen.has(key)) {
      return { error: 'A document field is not available for this service.' };
    }

    const file = files[index];
    if (!isAllowedArchiveUpload(file.originalname, file.mimetype, file.size)
      || !hasValidArchiveSignature(file.mimetype, file.buffer)) {
      return { error: 'Each document must be a valid PDF or image file.' };
    }

    seen.add(key);
    documents.push({ key, label: definition.Label, file });
  }

  const missing = [...definitions.values()].find(field => Boolean(field.IsRequired) && !seen.has(String(field.FieldKey)));
  if (missing) return { error: `Please upload "${missing.Label}".` };
  return { documents };
}

/** Validate the saved gallery shape while accepting legacy single-photo items. */
export function isValidGalleryContent(content) {
  const isPhotoUrl = value => typeof value === 'string'
    && value.length <= 2000
    && (/^https?:\/\//i.test(value) || value.startsWith('/assets/') || value.startsWith('/uploads/'));

  // A photo entry is either a plain URL string or an object with url + optional descriptions.
  const isOptionalText = (value, max) => value === undefined || (typeof value === 'string' && value.length <= max);
  const isPhotoEntry = entry => {
    if (typeof entry === 'string') return isPhotoUrl(entry);
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      && isPhotoUrl(entry.url)
      && isOptionalText(entry.description, 1000)
      && isOptionalText(entry.descriptionTl, 1000);
  };
  const photoEntryUrl = entry => (typeof entry === 'string' ? entry : entry?.url);

  return Boolean(content) && typeof content === 'object' && !Array.isArray(content)
    && typeof content.heading === 'string'
    && content.heading.length <= 300
    && (content.headingTl === undefined || (typeof content.headingTl === 'string' && content.headingTl.length <= 300))
    && Array.isArray(content.items)
    && content.items.length <= 100
    && content.items.every(item => item
      && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 100
      && typeof item.title === 'string' && item.title.length <= 200
      && (item.titleTl === undefined || (typeof item.titleTl === 'string' && item.titleTl.length <= 200))
      && isPhotoUrl(item.image)
      && (item.photos === undefined || (
        Array.isArray(item.photos)
        && item.photos.length > 0
        && item.photos.length <= 100
        && item.photos.every(isPhotoEntry)
        && item.photos.map(photoEntryUrl).includes(item.image)
        && new Set(item.photos.map(photoEntryUrl)).size === item.photos.length
      )));
}

/** Validate church news stored through the site-content API. */
export function isValidNewsContent(content) {
  const isText = (value, max) => typeof value === 'string' && value.length <= max;
  const isOptionalText = (value, max) => value === undefined || isText(value, max);
  const isOptionalPhoto = value => value === undefined
    || (typeof value === 'string' && value.length <= 2000
      && (/^https?:\/\//i.test(value) || value.startsWith('/assets/') || value.startsWith('/uploads/')));
  const isDate = value => value === undefined || value === ''
    || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value);

  return Boolean(content) && typeof content === 'object' && !Array.isArray(content)
    && Array.isArray(content.articles)
    && content.articles.length <= 100
    && content.articles.every(article => article && typeof article === 'object' && !Array.isArray(article)
      && isText(article.id, 100) && article.id.length > 0
      && isText(article.title, 300) && article.title.trim().length > 0
      && isOptionalText(article.titleTl, 300)
      && isText(article.body, 10000) && article.body.trim().length > 0
      && isOptionalText(article.bodyTl, 10000)
      && isOptionalPhoto(article.image)
      && isDate(article.date));
}

/** Build a CSV document from an array of flat objects. */
export function toCsv(rows, columns) {
  const escape = value => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map(column => escape(column.label)).join(',');
  const body = (rows || []).map(row => columns.map(column => escape(row[column.key])).join(',')).join('\n');
  return body ? `${header}\n${body}` : header;
}

/** Modules whose access can be overridden per account. User management stays Admin-only. */
export const OVERRIDABLE_MODULES = [
  'MassSchedule', 'ServiceRequest', 'PrayerRequest', 'Finance', 'SacramentalRecords',
  'WebsiteContent', 'Gallery', 'ContactMessages',
];

const MODULE_ROUTES = [
  ['/api/admin/site-content/', null],
  ['/api/admin/contact-messages', 'ContactMessages'],
  ['/api/admin/prayers', 'PrayerRequest'],
  ['/api/prayers', 'PrayerRequest'],
  ['/api/admin/service-requests', 'ServiceRequest'],
  ['/api/admin/service-fields', 'ServiceRequest'],
  ['/api/admin/certificate-requests', 'ServiceRequest'],
  ['/api/admin/blocked-slots', 'ServiceRequest'],
  ['/api/admin/operations/schedule', 'MassSchedule'],
  ['/api/admin/operations/mass-intentions', 'MassSchedule'],
  ['/api/admin/operations/finance', 'Finance'],
  ['/api/admin/operations/reports', 'Finance'],
  ['/api/admin/operations/applications', 'ServiceRequest'],
  ['/api/admin/operations/statistics', 'SacramentalRecords'],
  ['/api/admin/sacramental', 'SacramentalRecords'],
];

/** Resolve which permission module a staff API path belongs to, or null when it is not overridable. */
export function moduleForPath(path) {
  const clean = String(path || '').split('?')[0].replace(/\/+$/, '');
  if (clean.startsWith('/api/admin/site-content/')) {
    return clean.split('/')[4] === 'gallery' ? 'Gallery' : 'WebsiteContent';
  }
  const match = MODULE_ROUTES.find(([prefix]) => prefix && (clean === prefix || clean.startsWith(`${prefix}/`)));
  return match ? match[1] : null;
}

/**
 * Decide whether an account override allows an action.
 * Returns true/false when an override exists for the module, or null to fall back to the role default.
 * Edit access always implies view access.
 */
export function overrideDecision(overrides, module, action) {
  const entry = overrides && module ? overrides[module] : undefined;
  if (!entry) return null;
  return action === 'view' ? Boolean(entry.view || entry.edit) : Boolean(entry.edit);
}
