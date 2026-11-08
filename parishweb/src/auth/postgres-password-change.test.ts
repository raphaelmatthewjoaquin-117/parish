import { describe, expect, it, vi } from 'vitest';
import { changePostgresStaffPassword } from './postgres-password-change.js';

describe('changePostgresStaffPassword', () => {
  it('updates the password, clears forced change, and records the audit event', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ username: 'staff', password_hash: 'old-hash' }] })
        .mockResolvedValueOnce({ rows: [{ userId: 7 }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await expect(changePostgresStaffPassword(pool, 7, 'current', 'new', {
      verifyPassword: (password, hash) => password === 'current' && hash === 'old-hash',
      hashPassword: password => `hashed:${password}`,
    })).resolves.toEqual({ changed: true, auditError: null });
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('"MustChangePassword" = false'),
      ['hashed:new', 7],
    );
    expect(pool.query).toHaveBeenNthCalledWith(3, expect.stringContaining('"ChangedAt"'), [
      'ChangeOwnPassword', 7, 'staff', 'staff',
    ]);
  });

  it('does not update for a missing account or incorrect current password', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ username: 'staff', password_hash: 'old-hash' }] }),
    };
    const options = {
      verifyPassword: (password: string) => password === 'current',
      hashPassword: (password: string) => `hashed:${password}`,
    };

    await expect(changePostgresStaffPassword(pool, 7, 'current', 'new', options))
      .resolves.toEqual({ changed: false, auditError: null });
    await expect(changePostgresStaffPassword(pool, 7, 'wrong', 'new', options))
      .resolves.toEqual({ changed: false, auditError: null });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('still succeeds if the best-effort audit insert fails', async () => {
    const auditError = new Error('audit unavailable');
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ username: 'staff', password_hash: 'old-hash' }] })
        .mockResolvedValueOnce({ rows: [{ userId: 7 }] })
        .mockRejectedValueOnce(auditError),
    };

    await expect(changePostgresStaffPassword(pool, 7, 'current', 'new', {
      verifyPassword: () => true,
      hashPassword: () => 'new-hash',
    })).resolves.toEqual({ changed: true, auditError });
  });

  it('propagates read or password-update database failures', async () => {
    const error = new Error('database unavailable');
    const pool = { query: vi.fn().mockRejectedValue(error) };

    await expect(changePostgresStaffPassword(pool, 7, 'current', 'new', {
      verifyPassword: () => true,
      hashPassword: () => 'new-hash',
    })).rejects.toBe(error);
  });
});
