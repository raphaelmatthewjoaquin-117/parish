import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;
type PostgresTransactionPool = Pick<PostgresPool, 'connect'>;

export function listPostgresAdminServiceRequests(pool: PostgresQueryClient): Promise<Array<Record<string, unknown>>>;
export function getPostgresServiceRequestDocument(
  pool: PostgresQueryClient,
  requestId: number,
  fieldKey: string,
): Promise<{ OriginalFileName: string; ContentType: string; FileData: Buffer } | null>;
export function updatePostgresAdminServiceRequest(
  pool: PostgresTransactionPool,
  requestId: number,
  status: string,
  adminNotes?: unknown,
): Promise<boolean>;
export function deletePostgresAdminServiceRequest(pool: PostgresTransactionPool, requestId: number): Promise<boolean>;
