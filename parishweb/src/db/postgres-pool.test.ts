import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { mockPoolConstructor } = vi.hoisted(() => ({
  mockPoolConstructor: vi.fn(),
}));

vi.mock('pg', () => ({ Pool: mockPoolConstructor }));

import {
  assertRestrictedPostgresRole,
  closePostgresPool,
  createPostgresPoolConfig,
  initializePostgresPool,
} from './postgres-pool.js';

describe('createPostgresPoolConfig', () => {
  it('requires a valid PostgreSQL URL', () => {
    expect(() => createPostgresPoolConfig({})).toThrow('DATABASE_URL must be configured.');
    expect(() => createPostgresPoolConfig({ DATABASE_URL: 'https://example.com' }))
      .toThrow('DATABASE_URL must be a valid PostgreSQL connection URL.');
  });

  it('requires TLS and strips sslmode so it cannot override certificate validation', () => {
    const config = createPostgresPoolConfig({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/parish?sslmode=require&application_name=parish-api',
    });

    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain('sslmode=');
    expect(config.connectionString).toContain('application_name=parish-api');
  });

  it('uses the configured CA certificate while keeping certificate verification enabled', () => {
    const config = createPostgresPoolConfig({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/parish',
      DATABASE_SSL_CA: '-----BEGIN CERTIFICATE-----\\nroot certificate\\n-----END CERTIFICATE-----',
    });

    expect(config.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nroot certificate\n-----END CERTIFICATE-----',
    });
  });

  it('loads the CA certificate from a configured path', () => {
    const directory = mkdtempSync(join(tmpdir(), 'parish-postgres-ca-'));
    const certificatePath = join(directory, 'ca.crt');
    const certificate = '-----BEGIN CERTIFICATE-----\nroot certificate\n-----END CERTIFICATE-----';
    writeFileSync(certificatePath, certificate);

    try {
      const config = createPostgresPoolConfig({
        DATABASE_URL: 'postgresql://user:password@db.example.com:5432/parish',
        DATABASE_SSL_CA_PATH: certificatePath,
      });

      expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: certificate });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects a connection string that disables TLS', () => {
    expect(() => createPostgresPoolConfig({
      DATABASE_URL: 'postgresql://user:password@db.example.com:5432/parish?sslmode=disable',
    })).toThrow('DATABASE_URL must require TLS.');
  });
});

describe('assertRestrictedPostgresRole', () => {
  it('accepts a role that is neither privileged nor an application object owner', async () => {
    const pool = {
      query: async () => ({
        rows: [{
          is_superuser: false,
          bypasses_rls: false,
          owns_application_objects: false,
          owns_database: false,
          has_role_memberships: false,
        }],
      }),
    };

    await expect(assertRestrictedPostgresRole(pool)).resolves.toBeUndefined();
  });

  it.each([
    ['a superuser', { is_superuser: true, bypasses_rls: false, owns_application_objects: false, owns_database: false }],
    ['an RLS-bypassing role', { is_superuser: false, bypasses_rls: true, owns_application_objects: false, owns_database: false }],
    ['an application object owner', { is_superuser: false, bypasses_rls: false, owns_application_objects: true, owns_database: false }],
    ['the database owner', { is_superuser: false, bypasses_rls: false, owns_application_objects: false, owns_database: true }],
    ['a member of another role', { is_superuser: false, bypasses_rls: false, owns_application_objects: false, owns_database: false, has_role_memberships: true }],
  ])('rejects %s', async (_label, role) => {
    const pool = { query: async () => ({ rows: [role] }) };

    await expect(assertRestrictedPostgresRole(pool))
      .rejects.toThrow('DATABASE_URL must use a restricted PostgreSQL runtime role:');
  });
});

describe('PostgreSQL pool lifecycle', () => {
  it('waits for pending initialization before closing the pool', async () => {
    let resolveReadiness: (value: { rows: Record<string, unknown>[] }) => void = () => {};
    const readinessQuery = new Promise<{ rows: Record<string, unknown>[] }>(resolve => {
      resolveReadiness = resolve;
    });
    const pool = {
      query: vi.fn()
        .mockReturnValueOnce(readinessQuery)
        .mockResolvedValueOnce({
          rows: [{
            is_superuser: false,
            bypasses_rls: false,
            owns_application_objects: false,
            owns_database: false,
            has_role_memberships: false,
          }],
        }),
      on: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    };
    mockPoolConstructor.mockImplementation(function PoolMock() {
      return pool;
    });

    const initialization = initializePostgresPool({
      DATABASE_URL: 'postgres://app:password@example.com:5432/parish',
    });
    const shutdown = closePostgresPool();

    expect(pool.end).not.toHaveBeenCalled();
    resolveReadiness({ rows: [{ ready: 1 }] });
    await Promise.all([initialization, shutdown]);

    expect(pool.end).toHaveBeenCalledOnce();
  });
});
