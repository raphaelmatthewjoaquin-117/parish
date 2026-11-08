import { describe, expect, it } from 'vitest';
import { createServiceDatabaseConfig } from './config.js';

describe('createServiceDatabaseConfig', () => {
  it('keeps service requests on SQL Server by default', () => {
    expect(createServiceDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.com/parish' }))
      .toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL URL when PostgreSQL is explicitly selected', () => {
    expect(() => createServiceDatabaseConfig({ SERVICE_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when SERVICE_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled', () => {
    expect(createServiceDatabaseConfig({
      SERVICE_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown database providers', () => {
    expect(() => createServiceDatabaseConfig({ SERVICE_DATABASE: 'supabase' }))
      .toThrow('SERVICE_DATABASE must be sqlserver or postgres.');
  });
});
