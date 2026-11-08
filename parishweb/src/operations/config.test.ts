import { describe, expect, it } from 'vitest';
import { createOperationsDatabaseConfig } from './config.js';

describe('createOperationsDatabaseConfig', () => {
  it('keeps operations on SQL Server by default', () => {
    expect(createOperationsDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.com/parish' }))
      .toEqual({ provider: 'sqlserver', postgresConfigured: true });
  });

  it('requires a PostgreSQL URL when PostgreSQL is selected', () => {
    expect(() => createOperationsDatabaseConfig({ OPERATIONS_DATABASE: 'postgres' }))
      .toThrow('DATABASE_URL must be configured when OPERATIONS_DATABASE=postgres.');
  });

  it('selects PostgreSQL only when explicitly enabled', () => {
    expect(createOperationsDatabaseConfig({
      OPERATIONS_DATABASE: 'postgres',
      DATABASE_URL: 'postgresql://db.example.com/parish',
    })).toEqual({ provider: 'postgres', postgresConfigured: true });
  });

  it('rejects unknown database providers', () => {
    expect(() => createOperationsDatabaseConfig({ OPERATIONS_DATABASE: 'supabase' }))
      .toThrow('OPERATIONS_DATABASE must be sqlserver or postgres.');
  });
});
