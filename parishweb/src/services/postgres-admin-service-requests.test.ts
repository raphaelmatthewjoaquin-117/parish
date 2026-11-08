import { describe, expect, it, vi } from 'vitest';
import {
  deletePostgresAdminServiceRequest,
  getPostgresServiceRequestDocument,
  listPostgresAdminServiceRequests,
  updatePostgresAdminServiceRequest,
} from './postgres-admin-service-requests.js';

describe('PostgreSQL admin service requests repository', () => {
  it('returns request contact snapshots, sacramental details, and upload metadata', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [{
            ServiceRequestId: 27,
            ParishionerId: 11,
            ServiceId: 3,
            FirstName: 'Test',
            LastName: 'Parishioner',
            EmailAddress: 'test@example.com',
            MobileNumber: '09123456789',
            Address: 'Parish address',
            ServiceName: 'Baptism',
            ScheduledDate: '2026-11-15',
            ScheduledTime: '10:00:00',
            Status: 'PendingReview',
            Notes: null,
            CreatedAt: '2026-11-08T10:00:00',
            ChildFirstName: 'Sample',
            BaptismExtraFields: '{"other":"value"}',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            ServiceRequestId: 27,
            FieldKey: 'birthCertificate',
            Label: 'Birth certificate',
            OriginalFileName: 'birth.pdf',
          }],
        }),
    };

    await expect(listPostgresAdminServiceRequests(pool)).resolves.toEqual([{
      id: 27,
      parishionerId: 11,
      serviceId: 3,
      firstName: 'Test',
      lastName: 'Parishioner',
      email: 'test@example.com',
      mobileNumber: '09123456789',
      address: 'Parish address',
      serviceName: 'Baptism',
      scheduledDate: '2026-11-15',
      scheduledTime: '10:00:00',
      status: 'PendingReview',
      notes: null,
      createdAt: '2026-11-08T10:00:00',
      details: {
        childFirstName: 'Sample',
        other: 'value',
        birthCertificate: {
          fieldKey: 'birthCertificate',
          label: 'Birth certificate',
          fileName: 'birth.pdf',
        },
      },
    }]);
  });

  it('loads one uploaded file by request ID and field key', async () => {
    const file = Buffer.from('file');
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ OriginalFileName: 'birth.pdf', ContentType: 'application/pdf', FileData: file }],
      }),
    };

    await expect(getPostgresServiceRequestDocument(pool, 27, 'birthCertificate')).resolves.toEqual({
      OriginalFileName: 'birth.pdf',
      ContentType: 'application/pdf',
      FileData: file,
    });
  });

  it('updates status, appends an admin note, and removes terminal-request documents atomically', async () => {
    const client = {
      query: vi.fn(async (...args: [statement: string, values?: unknown[]]) => ({
        rows: args[0].includes('UPDATE "public"."ServiceRequest"') ? [{ id: 27 }] : [],
        rowCount: args[0].includes('UPDATE "public"."ServiceRequest"') ? 1 : 0,
      })),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(updatePostgresAdminServiceRequest(pool, 27, 'Rejected', 'Missing papers'))
      .resolves.toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "public"."ServiceRequestDocument"'),
      [27],
    );
    const updateCall = client.query.mock.calls.find(([statement]) =>
      statement.includes('UPDATE "public"."ServiceRequest"'));
    expect(updateCall?.[0]).toContain('concat(COALESCE("Notes", \'\'), $3::text)');
    expect(updateCall?.[1]).toEqual([
      27,
      'Rejected',
      expect.stringContaining('[ADMIN NOTE]'),
    ]);
    expect(updateCall?.[1]?.[2]).toContain('Missing papers');
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('deletes request documents, details, tokens, and request in one transaction', async () => {
    const client = {
      query: vi.fn(async (...args: [statement: string, values?: unknown[]]) => ({
        rows: args[0].includes('DELETE FROM "public"."ServiceRequest"') ? [{ id: 27 }] : [],
        rowCount: 1,
      })),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(deletePostgresAdminServiceRequest(pool, 27)).resolves.toBe(true);
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "public"."VerificationTokens"'),
      [27],
    );
    expect(client.query).toHaveBeenCalledTimes(10);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });
});
