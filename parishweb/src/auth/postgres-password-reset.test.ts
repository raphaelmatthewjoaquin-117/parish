import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresPasswordReset,
  findPostgresStaffForPasswordReset,
  invalidatePostgresPasswordReset,
  resetPostgresStaffPassword,
} from './postgres-password-reset.js';

type MockQueryResult = { rows: Record<string, unknown>[] };

function createTransactionPool(responses: Array<MockQueryResult | Error> = []) {
  const client = {
    query: vi.fn(async () => {
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response || { rows: [] };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: vi.fn().mockResolvedValue(client) }, client };
}

describe('PostgreSQL staff password reset', () => {
  it('finds only staff accounts by case-insensitive email', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ userId: 7, email: 'staff@example.com', userName: 'staff' }],
      }),
    };

    await expect(findPostgresStaffForPasswordReset(pool, 'STAFF@example.com')).resolves.toEqual({
      userId: 7,
      email: 'staff@example.com',
      userName: 'staff',
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('lower(u."EmailAddress")'),
      ['STAFF@example.com', ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff']],
    );
  });

  it('replaces active reset tokens and creates a hashed 30-minute token transactionally', async () => {
    const { pool, client } = createTransactionPool();

    await createPostgresPasswordReset(pool, 7, 'hashed-reset-token');

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('"UsedAt" IS NULL'), [7]);
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INTERVAL '30 minutes'"),
      [7, 'hashed-reset-token'],
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('invalidates an undelivered token by its hash', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await invalidatePostgresPasswordReset(pool, 'hashed-reset-token');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('"TokenHash" = $1'), [
      'hashed-reset-token',
    ]);
  });

  it('consumes a valid token and updates the password atomically', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ userId: 7 }] },
      { rows: [{ userId: 7 }] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(resetPostgresStaffPassword(pool, 'hashed-reset-token', 'new-hash')).resolves.toBe(true);

    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('RETURNING resetToken."UserId"'),
      ['hashed-reset-token', ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff']],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('"MustChangePassword" = false'),
      ['new-hash', 7],
    );
    expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining('"UserId" = $1'), [7]);
    expect(client.query).toHaveBeenNthCalledWith(5, 'COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects invalid or reused tokens without changing account passwords', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(resetPostgresStaffPassword(pool, 'invalid-hash', 'new-hash')).resolves.toBe(false);

    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back the reset when the password update fails', async () => {
    const error = new Error('password update failed');
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ userId: 7 }] },
      error,
      { rows: [] },
    ]);

    await expect(resetPostgresStaffPassword(pool, 'token-hash', 'new-hash')).rejects.toBe(error);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
