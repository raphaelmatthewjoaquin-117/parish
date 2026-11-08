import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresMassIntention,
  listPostgresIntentionSlots,
  listPostgresMassIntentions,
  updatePostgresMassIntentionStatus,
} from './postgres-mass-intentions.js';

describe('PostgreSQL Mass intentions repository', () => {
  it('lists Mass intentions ordered by date and time', async () => {
    const intentions = [{
      MassIntentionId: 3,
      IntentionDate: '2026-11-15',
      IntentionTime: '09:00',
      Offering: 100,
      RequestedBy: 'Test parishioner',
      IntentionText: 'Clearly labeled test intention',
      Status: 'Scheduled',
    }];
    const pool = { query: vi.fn().mockResolvedValue({ rows: intentions, rowCount: 1 }) };

    await expect(listPostgresMassIntentions(pool)).resolves.toEqual(intentions);
  });

  it('loads intentions at the requested date and time for duplicate checks', async () => {
    const slots = [{ id: 3, date: '2026-11-15', time: '09:00', status: 'Scheduled' }];
    const pool = { query: vi.fn().mockResolvedValue({ rows: slots, rowCount: 1 }) };

    await expect(listPostgresIntentionSlots(pool, '2026-11-15', '09:00')).resolves.toEqual(slots);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['2026-11-15', '09:00']);
  });

  it('creates an intention and returns the legacy response field', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ MassIntentionId: 9 }], rowCount: 1 }) };

    await expect(createPostgresMassIntention(pool, {
      date: '2026-11-15',
      time: '09:00',
      offering: 100,
      requestedBy: 'Test parishioner',
      intentionText: 'Clearly labeled test intention',
      createdBy: 'test-staff@example.org',
    })).resolves.toEqual({ MassIntentionId: 9 });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      '2026-11-15', '09:00', 100, 'Test parishioner',
      'Clearly labeled test intention', 'test-staff@example.org',
    ]);
  });

  it('updates intention status and update timestamp by parameterized ID', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };

    await expect(updatePostgresMassIntentionStatus(pool, 9, 'Completed')).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [9, 'Completed']);
  });
});
