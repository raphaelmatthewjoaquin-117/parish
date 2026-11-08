import { describe, expect, it } from 'vitest';
import { createCertificateDatabaseConfig } from './config.js';

describe('createCertificateDatabaseConfig', () => {
  it('keeps certificate requests on SQL Server by default', () => {
    expect(createCertificateDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.com/parish' }))
      .toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL URL when certificate requests are explicitly selected', () => {
    expect(() => createCertificateDatabaseConfig({ CERTIFICATE_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when CERTIFICATE_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled', () => {
    expect(createCertificateDatabaseConfig({
      CERTIFICATE_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown database providers', () => {
    expect(() => createCertificateDatabaseConfig({ CERTIFICATE_DATABASE: 'supabase' }))
      .toThrow('CERTIFICATE_DATABASE must be sqlserver or postgres.');
  });
});
