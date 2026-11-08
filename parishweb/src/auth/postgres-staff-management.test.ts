import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresStaffUser,
  deletePostgresStaffUser,
  getPostgresStaffUsers,
  getPostgresUserPermissions,
  listPostgresUserManagementAudit,
  updatePostgresStaffProfile,
  updatePostgresStaffUser,
  updatePostgresUserPermissions,
} from './postgres-staff-management.js';

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
  return { pool: { connect: vi.fn().mockResolvedValue(client), query: vi.fn() }, client };
}

describe('PostgreSQL staff profile and permissions', () => {
  it('lists safe staff fields and returns an empty role as Staff', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { userId: 7, userName: 'admin', email: 'admin@example.com', emailConfirmed: true, roles: ['Admin', 'Staff'] },
          { userId: 8, userName: 'user', email: null, emailConfirmed: false, roles: [] },
        ],
      }),
    };

    await expect(getPostgresStaffUsers(pool, true)).resolves.toEqual([
      { userId: 7, userName: 'admin', email: 'admin@example.com', emailConfirmed: true, lockoutEnabled: false, accessFailedCount: 0, roles: ['Admin', 'Staff'] },
      { userId: 8, userName: 'user', email: null, emailConfirmed: false, lockoutEnabled: false, accessFailedCount: 0, roles: ['Staff'] },
    ]);
  });

  it('lists audit entries with a bounded limit', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ AuditId: 1 }] }) };

    await expect(listPostgresUserManagementAudit(pool, 20)).resolves.toEqual([{ AuditId: 1 }]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [20]);
  });

  it('creates a staff user, role assignment, and audit record atomically', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [] },
      { rows: [{ roleId: 3 }] },
      { rows: [{ userId: 7 }] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(createPostgresStaffUser(pool, {
      userName: 'new staff',
      email: 'new@example.com',
      role: 'Secretary',
      password: 'a-strong-password',
      changedBy: 'admin',
      hashPassword: password => `hashed:${password}`,
    })).resolves.toEqual({ userId: 7 });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('"EmailConfirmed", "PasswordHash", "MustChangePassword"'),
      ['new staff', 'new@example.com', 'hashed:a-strong-password'],
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('"ActionName"'), [
      'CreateUser', 7, 'new staff', 'admin',
      JSON.stringify({ role: 'Secretary', email: 'new@example.com' }),
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('updates roles and audit details atomically', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ roleId: 1 }] },
      { rows: [{ userName: 'staff', email: 'staff@example.com', isAdmin: true }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(updatePostgresStaffUser(pool, {
      userId: 7,
      hasEmail: false,
      resetToDefault: false,
      requestedRoles: ['Admin'],
      changedBy: 'admin',
      hashPassword: password => `hashed:${password}`,
      allowAdminTarget: true,
    })).resolves.toEqual({ updated: true });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "public"."AspNetUserRoles"'),
      [7, 1],
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('"ActionName"'), [
      'UpdateUser', 7, 'staff', 'admin', JSON.stringify({ roles: ['Admin'] }),
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('prevents non-admin callers from changing an Admin account', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ userName: 'admin', email: 'admin@example.com', isAdmin: true }] },
    ]);

    await expect(updatePostgresStaffUser(pool, {
      userId: 7,
      hasEmail: false,
      resetToDefault: false,
      requestedRoles: null,
      changedBy: 'secretary',
      hashPassword: password => `hashed:${password}`,
      allowAdminTarget: false,
    })).resolves.toEqual({ targetIsAdmin: true });

    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('deletes a user and records the deletion in one transaction', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ userName: 'staff', email: 'staff@example.com' }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(deletePostgresStaffUser(pool, 7, 'admin')).resolves.toBe(true);

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "public"."AspNetUserRoles"'), [7]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('"ActionName"'), [
      'DeleteUser', 7, 'staff', 'admin', JSON.stringify({ email: 'staff@example.com' }),
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('updates a profile and reports duplicate email conflicts', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ userName: 'updated', email: 'new@example.com' }] })
        .mockResolvedValueOnce({ rows: [{ userId: 8 }] }),
    };

    await expect(updatePostgresStaffProfile(pool, 7, 'updated', 'new@example.com'))
      .resolves.toEqual({ updated: true, duplicate: false });
    await expect(updatePostgresStaffProfile(pool, 7, 'updated', 'new@example.com'))
      .resolves.toEqual({ updated: false, duplicate: true });
  });

  it('returns module overrides in the API response shape', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { moduleName: 'events', canView: true, canEdit: false },
          { moduleName: 'users', canView: true, canEdit: true },
        ],
      }),
    };

    await expect(getPostgresUserPermissions(pool, 7)).resolves.toEqual({
      events: { view: true, edit: false },
      users: { view: true, edit: true },
    });
  });

  it('replaces overrides and writes its audit row in one transaction', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [{ userName: 'staff' }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(updatePostgresUserPermissions(pool, 7, {
      events: { view: true, edit: false },
      users: { view: false, edit: false },
    }, 'admin')).resolves.toBe(true);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FROM "public"."AspNetUsers"'), [7]);
    expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining('DELETE FROM "public"."UserModulePermissions"'), [7]);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('"UpdatedAt"'),
      [7, 'events', true, false, 'admin'],
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('"ChangedAt"'),
      ['UpdatePermissions', 7, 'staff', 'admin', JSON.stringify({
        events: { view: true, edit: false },
        users: { view: false, edit: false },
      })],
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns false for a missing target and rolls back a failed update', async () => {
    const missing = createTransactionPool([{ rows: [] }, { rows: [] }, { rows: [] }]);
    await expect(updatePostgresUserPermissions(missing.pool, 99, {}, 'admin')).resolves.toBe(false);
    expect(missing.client.query).toHaveBeenLastCalledWith('COMMIT');

    const error = new Error('insert failed');
    const failed = createTransactionPool([
      { rows: [] },
      { rows: [{ userName: 'staff' }] },
      { rows: [] },
      error,
      { rows: [] },
    ]);
    await expect(updatePostgresUserPermissions(failed.pool, 7, {
      events: { view: true, edit: false },
    }, 'admin')).rejects.toBe(error);
    expect(failed.client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(failed.client.release).toHaveBeenCalledOnce();
  });
});
