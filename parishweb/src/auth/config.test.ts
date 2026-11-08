import { describe, expect, it } from 'vitest';
import { createAdminTokenSigningSecret, createIdentityDatabaseConfig } from './config.js';

describe('createIdentityDatabaseConfig', () => {
  it('keeps SQL Server as the default identity database', () => {
    expect(createIdentityDatabaseConfig({
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  describe('createAdminTokenSigningSecret', () => {
    it('requires a strong configured secret in production', () => {
      expect(() => createAdminTokenSigningSecret({ NODE_ENV: 'production' }))
        .toThrow('ADMIN_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
      expect(() => createAdminTokenSigningSecret({
        NODE_ENV: 'production',
        ADMIN_TOKEN_SIGNING_SECRET: 'short',
      })).toThrow('ADMIN_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
    });

    it('uses the configured secret when valid', () => {
      const secret = 'a'.repeat(32);
      expect(createAdminTokenSigningSecret({
        NODE_ENV: 'production',
        ADMIN_TOKEN_SIGNING_SECRET: secret,
      })).toBe(secret);
    });

    it('allows a generated development-only fallback', () => {
      const fallback = 'b'.repeat(32);
      expect(createAdminTokenSigningSecret({ NODE_ENV: 'development' }, fallback)).toBe(fallback);
    });
  });

  it('requires PostgreSQL configuration when explicitly selected', () => {
    expect(() => createIdentityDatabaseConfig({ IDENTITY_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when IDENTITY_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled and configured', () => {
    expect(createIdentityDatabaseConfig({
      IDENTITY_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown identity database providers', () => {
    expect(() => createIdentityDatabaseConfig({ IDENTITY_DATABASE: 'supabase' }))
      .toThrow('IDENTITY_DATABASE must be sqlserver or postgres.');
  });
});
