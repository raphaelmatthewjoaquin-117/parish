import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface MassIntentionInput {
  date: string;
  time: string;
  offering: number;
  requestedBy: string;
  intentionText: string;
  createdBy: string;
}

export function listPostgresMassIntentions(pool: PostgresQueryClient): Promise<Array<Record<string, unknown>>>;
export function listPostgresIntentionSlots(
  pool: PostgresQueryClient,
  date: string,
  time: string,
): Promise<Array<Record<string, unknown>>>;
export function createPostgresMassIntention(
  pool: PostgresQueryClient,
  intention: MassIntentionInput,
): Promise<{ MassIntentionId: number }>;
export function updatePostgresMassIntentionStatus(
  pool: PostgresQueryClient,
  id: number,
  status: string,
): Promise<boolean>;
