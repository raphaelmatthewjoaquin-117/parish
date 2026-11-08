import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresCertificateRequest,
  deletePostgresCertificateRequest,
  getPostgresCertificateDocument,
  getPostgresCertificateRequest,
  getPostgresCertificateRequestForUpload,
  getPostgresCertificateSlots,
  listPostgresCertificateRequests,
  listPostgresCertificateUploads,
  savePostgresCertificateUploads,
  setPostgresCertificateRequestStatus,
} from './postgres-certificates.js';

function createPool(results: Array<{ rows: Record<string, unknown>[] }> = []) {
  const query = vi.fn(async () => {
    const result = results.shift() || { rows: [] };
    return { ...result, rowCount: result.rows.length };
  });
  return {
    query,
    connect: vi.fn(async () => {
      const client = {
        query: vi.fn(async () => {
          const result = results.shift() || { rows: [] };
          return { ...result, rowCount: result.rows.length };
        }),
        release: vi.fn(),
      };
      return client;
    }),
  };
}

describe('PostgreSQL certificate request repository', () => {
  it('lists certificate appointment blocks within the available date window', async () => {
    const pool = createPool([{ rows: [{ date: '2026-11-09', time: '10:00' }] }]);

    await expect(getPostgresCertificateSlots(pool)).resolves.toEqual([{ date: '2026-11-09', time: '10:00' }]);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('"Scope" IN (\'All\', \'Certificate\')'),
    );
  });

  it('creates certificate requests with parameterized contact details', async () => {
    const pool = createPool([{ rows: [{ requestId: 7 }] }]);
    const values = {
      certificateType: 'Baptism',
      preferredDate: '2026-11-09',
      preferredTime: '10:00',
      notes: null,
      firstName: 'Test',
      lastName: 'Parishioner',
      email: 'test@example.com',
      phone: '09123456789',
      referenceCode: 'ABC123',
    };

    await expect(createPostgresCertificateRequest(pool, values)).resolves.toBe(7);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('RETURNING "CertificateRequestId" AS "requestId"'),
      Object.values(values),
    );
  });

  it('looks up guest requests by both normalized email and reference code', async () => {
    const pool = createPool([{ rows: [{ certificateType: 'Baptism' }] }]);

    await expect(getPostgresCertificateRequest(pool, 'test@example.com', 'ABC123'))
      .resolves.toEqual({ certificateType: 'Baptism' });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('"ReferenceCode" = $2'),
      ['test@example.com', 'ABC123'],
    );
  });

  it('matches upload ownership by both request ID and reference code', async () => {
    const pool = createPool([{ rows: [{ requestId: 7 }] }]);

    await expect(getPostgresCertificateRequestForUpload(pool, 7, 'ABC123'))
      .resolves.toEqual({ requestId: 7 });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('"CertificateRequestId" = $1 AND "ReferenceCode" = $2'),
      [7, 'ABC123'],
    );
  });

  it('saves uploaded file metadata with parameterized values', async () => {
    const pool = createPool([
      { rows: [] },
    ]);

    await savePostgresCertificateUploads(pool, 7, [{
      originalName: 'birth-certificate.pdf',
      storedName: 'stored-file.pdf',
      fileUrl: '/uploads/stored-file.pdf',
      mimeType: 'application/pdf',
      size: 123,
    }]);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('"CertificateRequestId"'), [
      7, 'birth-certificate.pdf', 'stored-file.pdf', '/uploads/stored-file.pdf', 'application/pdf', 123,
    ]);
  });

  it('lists requests and documents without returning private document paths', async () => {
    const pool = createPool([
      { rows: [{ CertificateRequestId: 7, DocumentCount: '2' }] },
      { rows: [{ CertificateRequestDocumentId: 1, OriginalFileName: 'birth.pdf' }] },
      { rows: [{ StoredFileName: 'stored.pdf', OriginalFileName: 'birth.pdf', MimeType: 'application/pdf' }] },
    ]);

    await expect(listPostgresCertificateRequests(pool)).resolves.toEqual([
      { CertificateRequestId: 7, DocumentCount: 2 },
    ]);
    await expect(listPostgresCertificateUploads(pool, 7)).resolves.toEqual([
      { CertificateRequestDocumentId: 1, OriginalFileName: 'birth.pdf' },
    ]);
    await expect(getPostgresCertificateDocument(pool, 7, 1)).resolves.toEqual({
      StoredFileName: 'stored.pdf',
      OriginalFileName: 'birth.pdf',
      MimeType: 'application/pdf',
    });
  });

  it('updates request status and returns false when the request is missing', async () => {
    const pool = createPool([{ rows: [{ requestId: 7 }] }, { rows: [] }]);

    await expect(setPostgresCertificateRequestStatus(pool, 7, 'Confirmed')).resolves.toBe(true);
    await expect(setPostgresCertificateRequestStatus(pool, 8, 'Confirmed')).resolves.toBe(false);
  });

  it('deletes request documents and request atomically', async () => {
    const client = {
      query: vi.fn(async (statement: string) => ({
        rows: statement.includes('DELETE FROM "public"."CertificateRequests"')
          ? [{ requestId: 7 }]
          : [],
        rowCount: statement.includes('DELETE FROM "public"."CertificateRequests"') ? 1 : 0,
      })),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(deletePostgresCertificateRequest(pool, 7)).resolves.toBe(true);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM "public"."CertificateRequestDocuments"'), [7]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
