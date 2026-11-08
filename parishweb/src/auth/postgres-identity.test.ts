import { describe, expect, it, vi } from 'vitest';
import { findStaffForLogin, getStaffAuthorizationState } from './postgres-identity.js';

describe('findStaffForLogin', () => {
  it('returns the staff account and roles matched by email or username', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        userId: 7,
        email: 'staff@example.com',
        userName: 'staff',
        passwordHash: 'hash',
        mustChangePassword: false,
        roles: ['Secretary'],
      }],
    });

    await expect(findStaffForLogin({ query }, 'staff@example.com')).resolves.toEqual({
      userId: 7,
      email: 'staff@example.com',
      userName: 'staff',
      passwordHash: 'hash',
      mustChangePassword: false,
      roles: ['Secretary'],
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('$1'), ['staff@example.com']);
  });

  it('returns null when no login matches', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await expect(findStaffForLogin(pool, 'missing')).resolves.toBeNull();
  });
});

describe('getStaffAuthorizationState', () => {
  it('combines current role, permissions, and password-change state', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { userId: 7, userName: 'staff', email: 'staff@example.com', mustChangePassword: true, roleName: 'Staff', moduleName: 'events', canView: true, canEdit: false },
          { userId: 7, userName: 'staff', email: 'staff@example.com', mustChangePassword: true, roleName: 'Secretary', moduleName: 'events', canView: true, canEdit: false },
          { userId: 7, userName: 'staff', email: 'staff@example.com', mustChangePassword: true, roleName: 'Secretary', moduleName: 'users', canView: false, canEdit: false },
        ],
      }),
    };

    await expect(getStaffAuthorizationState(pool, 7)).resolves.toEqual({
      userId: 7,
      userName: 'staff',
      email: 'staff@example.com',
      role: 'Secretary',
      mustChangePassword: true,
      overrides: {
        events: { view: true, edit: false },
        users: { view: false, edit: false },
      },
    });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('$1'), [7]);
  });

  it('returns null for a missing staff account', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await expect(getStaffAuthorizationState(pool, 7)).resolves.toBeNull();
  });

  it('propagates database failures so protected routes can fail closed', async () => {
    const error = new Error('database unavailable');
    const pool = { query: vi.fn().mockRejectedValue(error) };

    await expect(getStaffAuthorizationState(pool, 7)).rejects.toBe(error);
  });
});
