import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresSchedule,
  deletePostgresSchedule,
  listPostgresScheduleSlots,
  listPostgresSchedules,
  updatePostgresSchedule,
} from './postgres-schedules.js';

describe('PostgreSQL Mass schedule repository', () => {
  it('lists schedules in date and time order using the existing API shape', async () => {
    const schedules = [{
      id: 5,
      title: 'Sunday Mass',
      date: '2026-11-15',
      time: '09:00',
      location: 'Main Church',
      priestUsername: 'priest@example.org',
      notes: null,
      status: 'Scheduled',
    }];
    const pool = { query: vi.fn().mockResolvedValue({ rows: schedules, rowCount: 1 }) };

    await expect(listPostgresSchedules(pool)).resolves.toEqual(schedules);
  });

  it('loads same-date and same-time schedules for conflict checks', async () => {
    const slots = [{ id: 5, date: '2026-11-15', time: '09:00', location: 'Main Church', priestUsername: 'priest', status: 'Scheduled' }];
    const pool = { query: vi.fn().mockResolvedValue({ rows: slots, rowCount: 1 }) };

    await expect(listPostgresScheduleSlots(pool, '2026-11-15', '09:00')).resolves.toEqual(slots);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['2026-11-15', '09:00']);
  });

  it('creates a schedule and returns its generated ID', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ id: 12 }], rowCount: 1 }) };

    await expect(createPostgresSchedule(pool, {
      title: 'Sunday Mass',
      date: '2026-11-15',
      time: '09:00',
      location: 'Main Church',
      priestUsername: 'priest@example.org',
      notes: null,
      status: 'Scheduled',
    })).resolves.toEqual({ id: 12 });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'Sunday Mass', '2026-11-15', '09:00', 'Main Church',
      'priest@example.org', null, 'Scheduled',
    ]);
  });

  it('updates and deletes a schedule and reports whether a row existed', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const input = {
      title: 'Sunday Mass',
      date: '2026-11-15',
      time: '09:00',
      location: 'Main Church',
      priestUsername: 'priest@example.org',
      notes: null,
      status: 'Scheduled',
    };

    await expect(updatePostgresSchedule(pool, 12, input)).resolves.toBe(true);
    await expect(deletePostgresSchedule(pool, 12)).resolves.toBe(false);
  });
});
