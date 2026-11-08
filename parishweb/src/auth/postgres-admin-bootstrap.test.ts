import { describe, expect, it, vi } from 'vitest';
import {
  createInitialPostgresAdmin,
  validateInitialAdminInput,
} from './postgres-admin-bootstrap.js';

function createTransactionPool(responses: Array<{ rows: Record<string, unknown>[] } | Error>) {
  const client = {
    query: vi.fn(async (..._args: unknown[]) => {
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response || { rows: [] };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: vi.fn().mockResolvedValue(client) }, client };
}

describe('PostgreSQL first-admin bootstrap', () => {
  it('normalizes the account details and validates a strong matching password', () => {
    expect(validateInitialAdminInput({
      userName: '  Parish Admin ',
      email: ' ADMIN@example.com ',
      password: 'a-strong-password',
      confirmation: 'a-strong-password',
      operator: ' Setup operator ',
    })).toEqual({
      userName: 'Parish Admin',
      email: 'admin@example.com',
      password: 'a-strong-password',
      operator: 'Setup operator',
    });
  });

  it('rejects short passwords and mismatched confirmation', () => {
    expect(() => validateInitialAdminInput({
      userName: 'admin',
      email: 'admin@example.com',
      password: 'short',
      confirmation: 'short',
      operator: 'operator',
    })).toThrow('12 to 128 characters');

    expect(() => validateInitialAdminInput({
      userName: 'admin',
      email: 'admin@example.com',
      password: 'a-strong-password',
      confirmation: 'another-strong-password',
      operator: 'operator',
    })).toThrow('passwords do not match');
  });

  it('creates the first Admin account and its audit record in one transaction', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [] },
      { rows: [{ userCount: 0 }] },
      { rows: [{ roleId: 3 }] },
      { rows: [{ userId: 7 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(createInitialPostgresAdmin(pool, {
      userName: 'parish-admin',
      email: 'admin@example.com',
      password: 'a-strong-password',
      operator: 'Parish setup',
      hashPassword: password => `hashed:${password}`,
    })).resolves.toEqual({ userId: 7 });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.any(Array),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('"MustChangePassword"'),
      ['parish-admin', 'admin@example.com', 'hashed:a-strong-password'],
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('"ActionName"'), [
      'BootstrapAdmin', 7, 'parish-admin', 'Parish setup',
      JSON.stringify({ role: 'Admin', email: 'admin@example.com' }),
    ]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('refuses to create an Admin when any staff account already exists', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [] },
      { rows: [{ userCount: 1 }] },
      { rows: [] },
    ]);

    await expect(createInitialPostgresAdmin(pool, {
      userName: 'parish-admin',
      email: 'admin@example.com',
      password: 'a-strong-password',
      operator: 'Parish setup',
      hashPassword: password => `hashed:${password}`,
    })).rejects.toThrow('Bootstrap is only allowed when no staff accounts exist');

    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(call => String(call[0]).includes('INSERT INTO "public"."AspNetUsers"'))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('fails clearly when the Admin role has not been seeded', async () => {
    const { pool, client } = createTransactionPool([
      { rows: [] },
      { rows: [] },
      { rows: [{ userCount: 0 }] },
      { rows: [] },
      { rows: [] },
    ]);

    await expect(createInitialPostgresAdmin(pool, {
      userName: 'parish-admin',
      email: 'admin@example.com',
      password: 'a-strong-password',
      operator: 'Parish setup',
      hashPassword: password => `hashed:${password}`,
    })).rejects.toThrow('Admin role is missing; apply the PostgreSQL identity access migration first.');

    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });
});
