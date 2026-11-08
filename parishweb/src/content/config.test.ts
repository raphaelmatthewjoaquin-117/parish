import { describe, expect, it } from 'vitest';
import { createContentDatabaseConfig } from './config.js';

describe('createContentDatabaseConfig', () => {
  it('keeps content on SQL Server by default', () => {
    expect(createContentDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.com/parish' }))
      .toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL URL when content is explicitly selected', () => {
    expect(() => createContentDatabaseConfig({ CONTENT_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when CONTENT_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled', () => {
    expect(createContentDatabaseConfig({
      CONTENT_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown database providers', () => {
    expect(() => createContentDatabaseConfig({ CONTENT_DATABASE: 'supabase' }))
      .toThrow('CONTENT_DATABASE must be sqlserver or postgres.');
  });
});
