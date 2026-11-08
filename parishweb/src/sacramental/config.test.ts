import { describe, expect, it } from 'vitest';
import { createSacramentalDatabaseConfig } from './config.js';

describe('createSacramentalDatabaseConfig', () => {
  it('keeps sacramental routes on SQL Server by default', () => {
    expect(createSacramentalDatabaseConfig({
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL URL when PostgreSQL is selected', () => {
    expect(() => createSacramentalDatabaseConfig({ SACRAMENTAL_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when SACRAMENTAL_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled', () => {
    expect(createSacramentalDatabaseConfig({
      SACRAMENTAL_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown database providers', () => {
    expect(() => createSacramentalDatabaseConfig({ SACRAMENTAL_DATABASE: 'supabase' }))
      .toThrow('SACRAMENTAL_DATABASE must be sqlserver or postgres.');
  });

  it('does not make the sacramental PostgreSQL provider opt-out by default', () => {
    expect(createSacramentalDatabaseConfig({})).toEqual({
      provider: 'sqlserver',
      postgresConfigured: false,
    });
  });
});
