import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export function getPostgresServiceAvailability(
  pool: PostgresQueryClient,
  serviceId: number,
): Promise<{
  name: string;
  bookings: Array<{ date: string; time: string; total: number }>;
  blocks: Array<{ blockDate: string; BlockTime: string | null; Reason: string | null }>;
}>;
