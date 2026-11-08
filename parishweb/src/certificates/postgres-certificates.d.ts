import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;
type PostgresTransactionalPool = Pick<PostgresPool, 'connect'>;

export function getPostgresCertificateSlots(pool: PostgresQueryClient): Promise<Array<{
  date: string;
  time: string | null;
}>>;

export function findPostgresCertificateBlock(
  pool: PostgresQueryClient,
  date: string,
  time: string,
): Promise<{ Reason: string | null } | null>;

export function createPostgresCertificateRequest(
  pool: PostgresQueryClient,
  request: {
    certificateType: string;
    preferredDate: string;
    preferredTime: string;
    notes: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    referenceCode: string;
  },
): Promise<number | undefined>;

export function getPostgresCertificateRequest(
  pool: PostgresQueryClient,
  email: string,
  referenceCode: string,
): Promise<Record<string, unknown> | null>;
export function getPostgresCertificateRequestForUpload(
  pool: PostgresQueryClient,
  requestId: number,
  referenceCode: string,
): Promise<{ requestId: number } | null>;

export function savePostgresCertificateUploads(
  pool: PostgresQueryClient,
  requestId: number,
  files: Array<{
    originalName: string;
    storedName: string;
    fileUrl: string;
    mimeType: string;
    size: number;
  }>,
): Promise<void>;

export function listPostgresCertificateRequests(pool: PostgresQueryClient): Promise<Record<string, unknown>[]>;
export function listPostgresCertificateUploads(pool: PostgresQueryClient, requestId: number): Promise<Record<string, unknown>[]>;
export function getPostgresCertificateDocument(
  pool: PostgresQueryClient,
  requestId: number,
  documentId: number,
): Promise<Record<string, string> | null>;
export function setPostgresCertificateRequestStatus(pool: PostgresQueryClient, requestId: number, status: string): Promise<boolean>;
export function deletePostgresCertificateRequest(pool: PostgresTransactionalPool, requestId: number): Promise<boolean>;
