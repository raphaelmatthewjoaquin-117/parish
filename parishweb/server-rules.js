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
export const ALLOWED_REQUEST_STATUSES = ['PendingVerification', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'Voided', 'VoidedNoShow'];

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
