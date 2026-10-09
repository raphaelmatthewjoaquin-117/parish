import { describe, it, expect } from 'vitest';
import {
  servicePolicy,
  findScheduleConflict,
  findIntentionConflict,
  financeTransition,
  isNoShowEligible,
  isUnverifiedExpired,
  ALLOWED_REQUEST_STATUSES,
  isAllowedArchiveUpload,
  isValidGalleryContent,
  toCsv,
} from '../server-rules.js';

describe('servicePolicy', () => {
  it('blocks Confirmation outside February', () => {
    const result = servicePolicy('Confirmation', '2026-03-10', new Date('2025-12-15T00:00:00'));
    expect(result.allowed).toBe(false);
  });

  it('blocks Confirmation registration outside December/January', () => {
    const result = servicePolicy('Confirmation', '2026-02-10', new Date('2025-06-15T00:00:00'));
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/December and January/);
  });

  it('allows Confirmation in February when registered during December or January', () => {
    expect(servicePolicy('Confirmation', '2026-02-10', new Date('2026-01-10T00:00:00')).allowed).toBe(true);
    expect(servicePolicy('Confirmation', '2026-02-10', new Date('2025-12-10T00:00:00')).allowed).toBe(true);
  });

  it('restricts First Communion to December or February', () => {
    expect(servicePolicy('First Communion', '2026-02-10').allowed).toBe(true);
    expect(servicePolicy('First Communion', '2026-12-10').allowed).toBe(true);
    expect(servicePolicy('First Communion', '2026-05-10').allowed).toBe(false);
  });

  it('applies daily quotas for funeral, area Mass, and hall rental', () => {
    expect(servicePolicy('Funeral Mass', '2026-05-10').quota).toBe(3);
    expect(servicePolicy('Area Mass', '2026-05-10').quota).toBe(2);
    expect(servicePolicy('Parish hall rental', '2026-05-10').quota).toBe(2);
  });

  it('allows unrestricted services without quota', () => {
    const result = servicePolicy('General Mass', '2026-05-10');
    expect(result.allowed).toBe(true);
    expect(result.quota).toBeUndefined();
  });
});

describe('findScheduleConflict', () => {
  const existing = [
    { id: 1, date: '2026-10-01', time: '09:00', location: 'Main Church', priestUsername: 'frjohn', status: 'Scheduled' },
    { id: 2, date: '2026-10-01', time: '10:00', location: 'Chapel', priestUsername: 'frmark', status: 'Cancelled' },
  ];

  it('flags priest double-booking on the same date and time', () => {
    const result = findScheduleConflict(
      { date: '2026-10-01', time: '09:00', location: 'Other', priestUsername: 'FrJohn' },
      existing,
    );
    expect(result.conflict).toBe(true);
    expect(result.reason).toBe('priest');
  });

  it('flags location double-booking on the same date and time', () => {
    const result = findScheduleConflict(
      { date: '2026-10-01', time: '09:00', location: 'main church', priestUsername: 'frother' },
      existing,
    );
    expect(result.conflict).toBe(true);
    expect(result.reason).toBe('location');
  });

  it('ignores cancelled schedules and the record being edited', () => {
    expect(findScheduleConflict({ date: '2026-10-01', time: '10:00', location: 'Chapel', priestUsername: 'frmark' }, existing).conflict).toBe(false);
    expect(findScheduleConflict({ date: '2026-10-01', time: '09:00', location: 'Main Church', priestUsername: 'frjohn', excludeId: 1 }, existing).conflict).toBe(false);
  });

  it('allows different dates and times', () => {
    expect(findScheduleConflict({ date: '2026-10-02', time: '09:00', location: 'Main Church', priestUsername: 'frjohn' }, existing).conflict).toBe(false);
  });
});

describe('findIntentionConflict', () => {
  it('blocks a second intention for the same date and time', () => {
    const result = findIntentionConflict(
      { date: '2026-10-01', time: '09:00' },
      [{ date: '2026-10-01', time: '09:00', status: 'Scheduled' }],
    );
    expect(result.conflict).toBe(true);
  });

  it('allows slots whose existing intention was cancelled', () => {
    const result = findIntentionConflict(
      { date: '2026-10-01', time: '09:00' },
      [{ date: '2026-10-01', time: '09:00', status: 'Cancelled' }],
    );
    expect(result.conflict).toBe(false);
  });
});

describe('financeTransition', () => {
  it('enforces the Draft -> Submitted -> Approved -> Reconciled workflow', () => {
    expect(financeTransition('Draft', 'submit')).toBe('Submitted');
    expect(financeTransition('Submitted', 'approve')).toBe('Approved');
    expect(financeTransition('Approved', 'reconcile')).toBe('Reconciled');
  });

  it('allows rejection of submitted entries and resubmission of rejected entries', () => {
    expect(financeTransition('Submitted', 'reject')).toBe('Rejected');
    expect(financeTransition('Rejected', 'submit')).toBe('Submitted');
  });

  it('prevents editing or deleting approved entries', () => {
    expect(financeTransition('Approved', 'edit')).toBeNull();
    expect(financeTransition('Approved', 'delete')).toBeNull();
  });

  it('prevents any mutation of reconciled entries', () => {
    expect(financeTransition('Reconciled', 'edit')).toBeNull();
    expect(financeTransition('Reconciled', 'delete')).toBeNull();
    expect(financeTransition('Reconciled', 'approve')).toBeNull();
  });

  it('allows editing and deleting drafts only', () => {
    expect(financeTransition('Draft', 'edit')).toBe('Draft');
    expect(financeTransition('Draft', 'delete')).toBe('Deleted');
    expect(financeTransition('Submitted', 'edit')).toBeNull();
  });
});

describe('isNoShowEligible', () => {
  const now = new Date('2026-09-24T12:00:00');

  it('voids confirmed appointments past the grace period without attendance', () => {
    expect(isNoShowEligible({ status: 'Confirmed', scheduledDate: '2026-09-22', scheduledTime: '09:00', attendanceStatus: null }, now)).toBe(true);
  });

  it('does not void appointments inside the grace period', () => {
    expect(isNoShowEligible({ status: 'Confirmed', scheduledDate: '2026-09-24', scheduledTime: '09:00', attendanceStatus: null }, now, 24)).toBe(false);
  });

  it('does not void appointments with attendance already marked', () => {
    expect(isNoShowEligible({ status: 'Confirmed', scheduledDate: '2026-09-20', scheduledTime: '09:00', attendanceStatus: 'Present' }, now)).toBe(false);
  });

  it('only applies to confirmed appointments', () => {
    expect(isNoShowEligible({ status: 'PendingVerification', scheduledDate: '2026-09-20', scheduledTime: '09:00' }, now)).toBe(false);
  });
});

describe('isUnverifiedExpired', () => {
  const now = new Date('2026-09-24T12:00:00');

  it('expires stale pending-verification bookings', () => {
    expect(isUnverifiedExpired({ status: 'PendingVerification', createdAt: '2026-09-20T12:00:00' }, now)).toBe(true);
  });

  it('keeps recent pending-verification bookings', () => {
    expect(isUnverifiedExpired({ status: 'PendingVerification', createdAt: '2026-09-24T06:00:00' }, now)).toBe(false);
  });
});

describe('ALLOWED_REQUEST_STATUSES', () => {
  it('contains the supported lifecycle statuses', () => {
    for (const status of ['PendingVerification', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'Voided', 'VoidedNoShow']) {
      expect(ALLOWED_REQUEST_STATUSES).toContain(status);
    }
  });
});

describe('isAllowedArchiveUpload', () => {
  it('accepts supported archive formats at or below 20 MB', () => {
    expect(isAllowedArchiveUpload('scan.pdf', 'application/pdf', 20 * 1024 * 1024)).toBe(true);
    expect(isAllowedArchiveUpload('scan.TIFF', 'image/tiff', 1024)).toBe(true);
    expect(isAllowedArchiveUpload('scan.jpeg', 'image/jpeg', 1024)).toBe(true);
  });

  it('rejects unsupported, mismatched, or oversized files', () => {
    expect(isAllowedArchiveUpload('scan.exe', 'application/pdf', 1024)).toBe(false);
    expect(isAllowedArchiveUpload('scan.pdf', 'image/png', 1024)).toBe(false);
    expect(isAllowedArchiveUpload('scan.pdf', 'application/pdf', 20 * 1024 * 1024 + 1)).toBe(false);
  });
});

describe('isValidGalleryContent', () => {
  const legacyGallery = {
    heading: 'Parish gallery',
    items: [{ id: 'faith', title: 'Faith', image: '/assets/faith.jpg' }],
  };

  it('accepts legacy one-photo albums and multi-photo albums with a selected cover', () => {
    expect(isValidGalleryContent(legacyGallery)).toBe(true);
    expect(isValidGalleryContent({
      ...legacyGallery,
      items: [{ ...legacyGallery.items[0], photos: ['/assets/faith.jpg', '/uploads/second.jpg'] }],
    })).toBe(true);
  });

  it('rejects empty albums, invalid photo URLs, and covers not in the album', () => {
    expect(isValidGalleryContent({
      ...legacyGallery,
      items: [{ ...legacyGallery.items[0], photos: [] }],
    })).toBe(false);
    expect(isValidGalleryContent({
      ...legacyGallery,
      items: [{ ...legacyGallery.items[0], photos: ['/assets/other.jpg'] }],
    })).toBe(false);
    expect(isValidGalleryContent({
      ...legacyGallery,
      items: [{ ...legacyGallery.items[0], photos: ['/private/photo.jpg'] }],
    })).toBe(false);
  });

  it('rejects albums with more than 100 photos', () => {
    expect(isValidGalleryContent({
      ...legacyGallery,
      items: [{ ...legacyGallery.items[0], photos: Array(101).fill('/assets/photo.jpg') }],
    })).toBe(false);
    expect(isValidGalleryContent(null)).toBe(false);
  });
});

describe('toCsv', () => {
  it('renders headers and rows with escaping', () => {
    const csv = toCsv(
      [{ EntryType: 'StoleFee', Total: 1500.5 }, { EntryType: 'Donation, General', Total: 200 }],
      [{ key: 'EntryType', label: 'Category' }, { key: 'Total', label: 'Total' }],
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Category,Total');
    expect(lines[1]).toBe('StoleFee,1500.5');
    expect(lines[2]).toBe('"Donation, General",200');
  });
});
