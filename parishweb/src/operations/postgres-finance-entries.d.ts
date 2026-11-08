import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface FinanceEntryInput {
  date: string;
  entryType: string;
  description: string;
  amount: number;
  status?: string;
  enteredBy?: string;
}

export function listPostgresFinanceEntries(pool: PostgresQueryClient): Promise<Array<Record<string, unknown>>>;
export function createPostgresFinanceEntry(
  pool: PostgresQueryClient,
  entry: FinanceEntryInput & { enteredBy: string },
): Promise<{ FinancialEntryId: number }>;
export function updatePostgresFinanceEntry(
  pool: PostgresQueryClient,
  id: number,
  entry: FinanceEntryInput & { status: string },
): Promise<boolean>;
export function deletePostgresFinanceEntry(pool: PostgresQueryClient, id: number): Promise<boolean>;
export function transitionPostgresFinanceEntry(
  pool: Pick<PostgresPool, 'connect'>,
  id: number,
  action: string,
  changedBy: string,
): Promise<
  | { kind: 'updated'; status: string }
  | { kind: 'invalid-transition'; currentStatus: string }
  | { kind: 'not-found' }
>;
