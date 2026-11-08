import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface PostgresTransactionClient {
  query(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release(): void;
}

type PostgresTransactionalPool = {
  connect(): Promise<PostgresTransactionClient>;
};

export interface PostgresStaffPasswordReset {
  userId: number;
  email: string;
  userName: string;
}

export function findPostgresStaffForPasswordReset(
  pool: PostgresQueryClient,
  email: string,
): Promise<PostgresStaffPasswordReset | null>;

export function createPostgresPasswordReset(
  pool: PostgresTransactionalPool,
  userId: number,
  tokenHash: string,
): Promise<void>;

export function invalidatePostgresPasswordReset(pool: PostgresQueryClient, tokenHash: string): Promise<void>;

export function resetPostgresStaffPassword(
  pool: PostgresTransactionalPool,
  tokenHash: string,
  passwordHash: string,
): Promise<boolean>;
