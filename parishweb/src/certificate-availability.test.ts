import { describe, expect, it } from 'vitest';
import { isCertificateDateBlocked, isCertificateTimeBlocked } from './certificate-availability';

const blocks = [
  { date: '2026-11-02', time: null },
  { date: '2026-11-03', time: '10:00' },
];

describe('certificate booking availability', () => {
  it('blocks a full day on the calendar', () => {
    expect(isCertificateDateBlocked(blocks, '2026-11-02')).toBe(true);
    expect(isCertificateDateBlocked(blocks, '2026-11-03')).toBe(false);
  });

  it('blocks only a specifically unavailable time', () => {
    expect(isCertificateTimeBlocked(blocks, '2026-11-03', '10:00')).toBe(true);
    expect(isCertificateTimeBlocked(blocks, '2026-11-03', '11:00')).toBe(false);
  });

  it('treats a full-day block as blocking every time', () => {
    expect(isCertificateTimeBlocked(blocks, '2026-11-02', '11:00')).toBe(true);
  });
});
