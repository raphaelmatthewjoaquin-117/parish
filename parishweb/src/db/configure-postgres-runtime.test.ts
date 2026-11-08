import { describe, expect, it } from 'vitest';
import {
  createRuntimeDatabaseUrl,
  updateDatabaseUrlInEnv,
} from '../../scripts/configure-postgres-runtime.js';

describe('createRuntimeDatabaseUrl', () => {
  it('switches only the login credentials and preserves connection settings', () => {
    const result = createRuntimeDatabaseUrl(
      'postgres://owner:owner-password@db.example.com:5432/parish?sslmode=require&application_name=parish-api',
      'runtime/secret?value',
    );
    const url = new URL(result);

    expect(url.username).toBe('parish_app_runtime');
    expect(decodeURIComponent(url.password)).toBe('runtime/secret?value');
    expect(url.hostname).toBe('db.example.com');
    expect(url.port).toBe('5432');
    expect(url.pathname).toBe('/parish');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('application_name')).toBe('parish-api');
  });

  it('preserves a Supabase pooler project suffix on the login name', () => {
    const result = createRuntimeDatabaseUrl(
      'postgres://postgres.abcdefghijk@pooler.example.com:6543/parish',
      'a-long-runtime-password',
    );

    expect(new URL(result).username).toBe('parish_app_runtime.abcdefghijk');
  });

  it('rejects invalid URLs and empty passwords', () => {
    expect(() => createRuntimeDatabaseUrl('not-a-url', 'password'))
      .toThrow('DATABASE_URL must be a valid PostgreSQL connection URL.');
    expect(() => createRuntimeDatabaseUrl('postgres://owner@db.example.com/parish', ''))
      .toThrow('A non-empty runtime password is required.');
  });
});

describe('updateDatabaseUrlInEnv', () => {
  it('replaces only the DATABASE_URL value and preserves other settings', () => {
    const source = [
      'NODE_ENV=development',
      'DATABASE_URL=postgres://owner:secret@db.example.com/parish',
      'DATABASE_SSL_CA_PATH=C:\\certs\\supabase.crt',
      '',
    ].join('\r\n');

    const result = updateDatabaseUrlInEnv(source, 'postgres://parish_app_runtime:new@db.example.com/parish');

    expect(result).toBe([
      'NODE_ENV=development',
      'DATABASE_URL=postgres://parish_app_runtime:new@db.example.com/parish',
      'DATABASE_SSL_CA_PATH=C:\\certs\\supabase.crt',
      '',
    ].join('\r\n'));
  });

  it('requires exactly one DATABASE_URL setting', () => {
    expect(() => updateDatabaseUrlInEnv('NODE_ENV=development\n', 'postgres://new'))
      .toThrow('The .env file must contain exactly one DATABASE_URL setting.');
    expect(() => updateDatabaseUrlInEnv(
      'DATABASE_URL=one\nDATABASE_URL=two\n',
      'postgres://new',
    )).toThrow('The .env file must contain exactly one DATABASE_URL setting.');
  });
});
