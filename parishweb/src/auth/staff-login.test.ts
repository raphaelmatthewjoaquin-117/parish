import { describe, expect, it, vi } from 'vitest';
import { authenticatePostgresStaff } from './staff-login.js';

describe('authenticatePostgresStaff', () => {
  it('authenticates a supported role and returns the existing login response fields', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          userId: 7,
          email: 'staff@example.com',
          userName: 'staff',
          passwordHash: 'stored-hash',
          mustChangePassword: true,
          roles: ['Staff', 'Secretary'],
        }],
      }),
    };

    await expect(authenticatePostgresStaff(pool, 'staff@example.com', 'password', (password, hash) =>
      password === 'password' && hash === 'stored-hash',
    )).resolves.toEqual({
      userId: 7,
      email: 'staff@example.com',
      role: 'Secretary',
      mustChangePassword: true,
    });
  });

  it('rejects missing users, unsupported roles, and invalid passwords', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ userId: 7, passwordHash: 'hash', roles: ['Other'] }] })
        .mockResolvedValueOnce({ rows: [{ userId: 7, passwordHash: 'hash', roles: ['Staff'] }] }),
    };

    await expect(authenticatePostgresStaff(pool, 'missing', 'password', () => true)).resolves.toBeNull();
    await expect(authenticatePostgresStaff(pool, 'staff', 'password', () => true)).resolves.toBeNull();
    await expect(authenticatePostgresStaff(pool, 'staff', 'wrong', () => false)).resolves.toBeNull();
  });

  it('propagates database errors so login cannot fall back to SQL Server', async () => {
    const error = new Error('database unavailable');
    const pool = { query: vi.fn().mockRejectedValue(error) };

    await expect(authenticatePostgresStaff(pool, 'staff', 'password', () => true)).rejects.toBe(error);
  });
});
