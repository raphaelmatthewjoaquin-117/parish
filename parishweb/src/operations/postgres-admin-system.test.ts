import { describe, expect, it, vi } from 'vitest';
import {
  getPostgresAdminHealth,
  getPostgresAdminStatus,
  getPostgresAdminSystemInfo,
} from './postgres-admin-system.js';

describe('PostgreSQL admin status', () => {
  it('returns the admin status counts using the existing response keys', async () => {
    const query = vi.fn(async () => ({
      rows: [{
        PendingVerifications: '2',
        ConfirmedRequests: '3',
        VoidedRequests: '4',
        TotalParishioners: '5',
        ActiveStaff: '6',
      }],
      rowCount: 1,
    }));

    await expect(getPostgresAdminStatus({ query })).resolves.toEqual({
      PendingVerifications: 2,
      ConfirmedRequests: 3,
      VoidedRequests: 4,
      TotalParishioners: 5,
      ActiveStaff: 6,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM "public"."ServiceRequest"'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM "public"."AspNetUserRoles"'));
  });

  it('throws if PostgreSQL returns no status row', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));

    await expect(getPostgresAdminStatus({ query })).rejects.toThrow(
      'PostgreSQL admin status query returned no result.',
    );
  });
});

describe('PostgreSQL admin system information', () => {
  it('returns the database health check in the existing result shape', async () => {
    const query = vi.fn(async () => ({
      rows: [{ HealthCheck: 1 }],
      rowCount: 1,
    }));

    await expect(getPostgresAdminHealth({ query })).resolves.toEqual([{ HealthCheck: 1 }]);
    expect(query).toHaveBeenCalledWith('SELECT 1 AS "HealthCheck"');
  });

  it('returns PostgreSQL version, server time, and process uptime', async () => {
    const query = vi.fn(async () => ({
      rows: [{ version: 'PostgreSQL 17', serverTime: '2026-11-08T14:00:00.000Z' }],
      rowCount: 1,
    }));

    await expect(getPostgresAdminSystemInfo({ query }, 123)).resolves.toEqual({
      version: 'PostgreSQL 17',
      serverTime: '2026-11-08T14:00:00.000Z',
      uptime: 123,
    });
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/version\(\).*now\(\)/s));
  });

  it('surfaces database errors instead of returning healthy-shaped fallback data', async () => {
    const query = vi.fn(async () => {
      throw new Error('database unavailable');
    });

    await expect(getPostgresAdminHealth({ query })).rejects.toThrow('database unavailable');
  });
});
