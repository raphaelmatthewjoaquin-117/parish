import { describe, expect, it } from 'vitest';
import { createEventsDatabaseConfig } from './config.js';

describe('createEventsDatabaseConfig', () => {
  it('keeps SQL Server as the default event database', () => {
    expect(createEventsDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.com/parish' }))
      .toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL connection string before selecting PostgreSQL events', () => {
    expect(() => createEventsDatabaseConfig({ EVENTS_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when EVENTS_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when it is explicitly enabled', () => {
    expect(createEventsDatabaseConfig({
      EVENTS_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown event database providers', () => {
    expect(() => createEventsDatabaseConfig({ EVENTS_DATABASE: 'supabase' }))
      .toThrow('EVENTS_DATABASE must be sqlserver or postgres.');
  });
});
