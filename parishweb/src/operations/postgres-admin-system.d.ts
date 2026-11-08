import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export function getPostgresAdminHealth(
  pool: PostgresQueryClient,
): Promise<Array<Record<string, unknown>>>;

export function getPostgresAdminStatus(
  pool: PostgresQueryClient,
): Promise<{
  PendingVerifications: number;
  ConfirmedRequests: number;
  VoidedRequests: number;
  TotalParishioners: number;
  ActiveStaff: number;
}>;

export function getPostgresAdminSystemInfo(
  pool: PostgresQueryClient,
  uptime: number,
): Promise<{ version: string; serverTime: string | Date; uptime: number }>;
