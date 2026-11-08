import { describe, expect, it, vi } from 'vitest';
import { cleanupPostgresServiceRequests } from './postgres-service-cleanup.js';

describe('PostgreSQL service request cleanup', () => {
  it('expires stale unverified requests and marks eligible no-shows, deleting their documents', async () => {
    const requests = new Map([
      [1, {
        id: 1,
        status: 'Confirmed',
        scheduledDate: '2026-11-06',
        scheduledTime: '10:00:00',
        attendanceStatus: null,
        createdAt: '2026-11-05T00:00:00Z',
      }],
      [2, {
        id: 2,
        status: 'Confirmed',
        scheduledDate: '2026-11-08',
        scheduledTime: '11:00:00',
        attendanceStatus: null,
        createdAt: '2026-11-07T00:00:00Z',
      }],
      [3, {
        id: 3,
        status: 'PendingVerification',
        scheduledDate: '2026-11-15',
        scheduledTime: '10:00:00',
        attendanceStatus: null,
        createdAt: '2026-11-05T00:00:00Z',
      }],
      [4, {
        id: 4,
        status: 'PendingVerification',
        scheduledDate: '2026-11-15',
        scheduledTime: '10:00:00',
        attendanceStatus: null,
        createdAt: '2026-11-08T00:00:00Z',
      }],
      [5, {
        id: 5,
        status: 'PendingVerification',
        scheduledDate: '2026-11-15',
        scheduledTime: '10:00:00',
        attendanceStatus: null,
        createdAt: '2026-11-06T12:00:00Z',
      }],
      [6, {
        id: 6,
        status: 'Confirmed',
        scheduledDate: '2026-11-05',
        scheduledTime: '10:00:00',
        attendanceStatus: 'Present',
        createdAt: '2026-11-04T00:00:00Z',
      }],
    ]);
    const documents = new Set([1, 2, 3, 4, 5, 6]);
    const client = {
      query: vi.fn(async (statement: string, values?: unknown[]) => {
        if (statement.includes('UPDATE "public"."ServiceRequest"')) {
          const request = requests.get(Number(values?.[0]));
          const expectedStatus = statement.includes("'Confirmed'") ? 'Confirmed' : 'PendingVerification';
          if (request?.status === expectedStatus) {
            request.status = expectedStatus === 'Confirmed' ? 'VoidedNoShow' : 'Voided';
            return { rows: [{ ServiceRequestId: request.id }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }
        if (statement.includes('DELETE FROM "public"."ServiceRequestDocument"')) {
          documents.delete(Number(values?.[0]));
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [...requests.values()] }),
      connect: vi.fn().mockResolvedValue(client),
    };

    await expect(cleanupPostgresServiceRequests(pool, new Date('2026-11-08T12:00:00Z')))
      .resolves.toEqual({ noShows: 1, expiredUnverified: 2 });
    expect(requests.get(1)?.status).toBe('VoidedNoShow');
    expect(requests.get(3)?.status).toBe('Voided');
    expect(requests.get(2)?.status).toBe('Confirmed');
    expect(requests.get(4)?.status).toBe('PendingVerification');
    expect(requests.get(5)?.status).toBe('Voided');
    expect(requests.get(6)?.status).toBe('Confirmed');
    expect(documents).toEqual(new Set([2, 4, 6]));
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(3);
  });
});
