import { describe, expect, it, vi } from 'vitest';
import {
  approvePostgresPrayer,
  createPostgresContactMessage,
  createPostgresPrayer,
  deletePostgresContactMessage,
  deletePostgresPrayer,
  getPostgresAdminPrayers,
  getPostgresSiteContent,
  listPostgresContactMessages,
  listPostgresPublicPrayers,
  savePostgresSiteContent,
  setPostgresContactMessageRead,
} from './postgres-content.js';

function createPool(results: Array<{
  rows: Record<string, unknown>[];
  rowCount?: number | null;
}> = []) {
  return {
    query: vi.fn(async () => {
      const result = results.shift() || { rows: [] };
      return { ...result, rowCount: result.rowCount ?? result.rows.length };
    }),
  };
}

describe('PostgreSQL public content repositories', () => {
  it('loads website content by key and returns null when no page is stored', async () => {
    const pool = createPool([{ rows: [{ contentJson: '{"title":"Welcome"}' }] }, { rows: [] }]);

    await expect(getPostgresSiteContent(pool, 'home')).resolves.toEqual({ title: 'Welcome' });
    await expect(getPostgresSiteContent(pool, 'home')).resolves.toBeNull();
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('"ContentKey" = $1'), ['home']);
  });

  it('upserts website content with its editor identity', async () => {
    const pool = createPool();

    await savePostgresSiteContent(pool, 'home', '{"title":"Welcome"}', 'admin@example.com');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("ContentKey") DO UPDATE'),
      ['home', '{"title":"Welcome"}', 'admin@example.com'],
    );
  });

  it('creates and lists contact messages in the API response shape', async () => {
    const pool = createPool([{ rows: [] }, { rows: [{
      contactMessageId: 9,
      name: 'Parishioner',
      email: 'person@example.com',
      phone: null,
      message: 'Please call me.',
      isRead: false,
      createdAt: '2026-11-08T10:00:00.000Z',
    }] }]);

    await createPostgresContactMessage(pool, {
      name: 'Parishioner',
      email: 'person@example.com',
      phone: null,
      message: 'Please call me.',
    });

    await expect(listPostgresContactMessages(pool)).resolves.toEqual([{
      id: 9,
      name: 'Parishioner',
      email: 'person@example.com',
      phone: null,
      message: 'Please call me.',
      isRead: false,
      createdAt: '2026-11-08T10:00:00.000Z',
    }]);
  });

  it('updates and deletes contact messages by parameterized IDs', async () => {
    const pool = createPool();

    await setPostgresContactMessageRead(pool, 9, true);
    await deletePostgresContactMessage(pool, 9);

    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('"IsRead" = $1'), [true, 9]);
    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('DELETE FROM "public"."ContactMessages"'), [9]);
  });

  it('returns only approved shared prayers and hides names for anonymous requests', async () => {
    const pool = createPool([{ rows: [{
      prayerId: 4,
      name: 'Hidden name',
      category: 'healing',
      request: 'Please pray for healing.',
      anonymous: true,
      createdAt: '2026-11-08T10:00:00.000Z',
    }] }]);

    await expect(listPostgresPublicPrayers(pool)).resolves.toEqual([{
      id: 4,
      name: 'Anonymous',
      category: 'healing',
      request: 'Please pray for healing.',
      createdAt: '2026-11-08T10:00:00.000Z',
    }]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('"IsApproved" = true'));
  });

  it('creates pending prayer requests, approves them, and lists staff fields', async () => {
    const pool = createPool([
      { rows: [{ id: 12 }] },
      { rows: [{ id: 12 }] },
      { rows: [{
        prayerId: 12,
        name: 'Sam',
        category: 'healing',
        request: 'Please pray for recovery.',
        anonymous: false,
        shareWithCommunity: true,
        isApproved: false,
        createdAt: '2026-11-08T10:00:00.000Z',
      }] },
    ]);

    await expect(createPostgresPrayer(pool, {
      name: 'Sam',
      category: 'healing',
      request: 'Please pray for recovery.',
      anonymous: false,
      shareWithCommunity: true,
    })).resolves.toBe(12);
    await expect(approvePostgresPrayer(pool, 12)).resolves.toBe(true);
    await expect(getPostgresAdminPrayers(pool)).resolves.toEqual([{
      id: 12,
      name: 'Sam',
      category: 'healing',
      request: 'Please pray for recovery.',
      anonymous: false,
      shareWithCommunity: true,
      isApproved: false,
      createdAt: '2026-11-08T10:00:00.000Z',
    }]);
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('RETURNING "PrayerId" AS id'), [
      'Sam', 'healing', 'Please pray for recovery.', false, true,
    ]);
  });

  it('deletes a prayer request by a parameterized ID', async () => {
    const pool = createPool();

    await deletePostgresPrayer(pool, 12);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "public"."PrayerRequests"'), [12]);
  });
});
