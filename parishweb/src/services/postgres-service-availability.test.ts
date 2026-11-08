import { describe, expect, it, vi } from 'vitest';
import { getPostgresServiceAvailability } from './postgres-service-availability.js';

describe('PostgreSQL service availability repository', () => {
  it('returns booking counts and matching date blocks for a service', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ name: 'Funeral Mass' }] })
        .mockResolvedValueOnce({
          rows: [
            { date: '2026-11-10', time: '10:00', total: '3' },
            { date: '2026-11-10', time: '11:00', total: '3' },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ blockDate: '2026-11-10', BlockTime: null, Reason: 'Parish event' }],
        }),
    };

    await expect(getPostgresServiceAvailability(pool, 4)).resolves.toEqual({
      name: 'Funeral Mass',
      bookings: [
        { date: '2026-11-10', time: '10:00', total: 3 },
        { date: '2026-11-10', time: '11:00', total: 3 },
      ],
      blocks: [{ blockDate: '2026-11-10', BlockTime: null, Reason: 'Parish event' }],
    });
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"ScheduledDate" IS NOT NULL'),
      [4],
    );
  });

  it('normalizes missing services and returns empty availability collections', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await expect(getPostgresServiceAvailability(pool, 99)).resolves.toEqual({
      name: '',
      bookings: [],
      blocks: [],
    });
  });
});
