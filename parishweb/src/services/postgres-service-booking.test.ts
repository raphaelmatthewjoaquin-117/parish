import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresServiceBooking,
  createPostgresServiceVerificationToken,
  savePostgresSacramentDetails,
  verifyPostgresServiceBookingToken,
} from './postgres-service-booking.js';

function createPool() {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      statements.push({ sql, values });
      if (sql.includes('FROM "public"."Parishioners"')) return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO "public"."Parishioners"')) return { rows: [{ id: 11 }], rowCount: 1 };
      if (sql.includes('INSERT INTO "public"."ServiceRequest"')) return { rows: [{ id: 27 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    statements.push({ sql, values });
    return { rows: [], rowCount: 0 };
  });
  return {
    statements,
    client,
    pool: { connect: vi.fn().mockResolvedValue(client), query },
  };
}

describe('PostgreSQL service booking repository', () => {
  it('creates the booking, documents, and verification token atomically', async () => {
    const { pool, client, statements } = createPool();

    await expect(createPostgresServiceBooking(pool, {
      serviceId: 3,
      scheduledDate: '2026-11-15',
      scheduledTime: '10:00',
      notes: null,
      firstName: 'Test',
      lastName: 'Parishioner',
      email: 'test@example.com',
      mobileNumber: '09123456789',
      address: 'Test address',
      documents: [{
        key: 'birthCertificate',
        label: 'Birth certificate',
        fileName: 'birth.pdf',
        file: {
          mimetype: 'application/pdf',
          buffer: Buffer.from('file'),
        },
      }],
      verificationToken: 'secure-token',
    })).resolves.toBe(27);

    await savePostgresSacramentDetails(pool, 'Baptism', 27, {
      childFirstName: 'Sample',
      unknownField: 'kept',
    });

    expect(statements.some(({ sql, values }) =>
      sql.includes('INSERT INTO "public"."ServiceRequestDocument"')
      && values?.some(value => Buffer.isBuffer(value) && value.equals(Buffer.from('file'))))).toBe(true);
    expect(statements.some(({ sql, values }) =>
      sql.includes('INSERT INTO "public"."BaptismRequestDetail"')
      && values?.includes('Sample')
      && values?.includes(JSON.stringify({ unknownField: 'kept' })))).toBe(true);
    expect(statements.some(({ sql, values }) =>
      sql.includes('INSERT INTO "public"."VerificationTokens"')
      && values?.includes('secure-token'))).toBe(true);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back all booking writes when the request insert fails', async () => {
    const { pool, client } = createPool();
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "public"."Parishioners"')) return { rows: [{ id: 11 }], rowCount: 1 };
      if (sql.includes('INSERT INTO "public"."ServiceRequest"')) throw new Error('slot conflict');
      return { rows: [], rowCount: 0 };
    });

    await expect(createPostgresServiceBooking(pool, {
      serviceId: 3,
      scheduledDate: '2026-11-15',
      scheduledTime: '10:00',
      notes: null,
      firstName: 'Test',
      lastName: 'Parishioner',
      email: 'test@example.com',
      mobileNumber: null,
      address: null,
      documents: [],
      verificationToken: 'secure-token',
    })).rejects.toThrow('slot conflict');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('consumes an unexpired verification token once and returns its request ID', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [{ requestId: 27 }], rowCount: 1 }),
    };

    await expect(verifyPostgresServiceBookingToken(pool, 'secure-token')).resolves.toBe(27);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('"Used" = false'),
      ['secure-token'],
    );
  });

  it('creates verification tokens in PostgreSQL with the existing 24-hour lifetime', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };

    await expect(createPostgresServiceVerificationToken(pool, 27, 'secure-token')).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining(`INTERVAL '24 hours'`),
      ['secure-token', 27],
    );
  });

  it('returns null for invalid or expired verification tokens', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };

    await expect(verifyPostgresServiceBookingToken(pool, 'expired-token')).resolves.toBeNull();
  });
});
