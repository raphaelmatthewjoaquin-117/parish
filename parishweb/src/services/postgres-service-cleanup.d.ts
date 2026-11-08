import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresServiceCleanupPool = Pick<PostgresPool, 'query' | 'connect'>;

export function cleanupPostgresServiceRequests(
  pool: PostgresServiceCleanupPool,
  now?: Date,
): Promise<{ noShows: number; expiredUnverified: number }>;
