import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface MassScheduleInput {
  title: string;
  date: string;
  time: string;
  location: string;
  priestUsername: string;
  notes: string | null;
  status: string;
}

export function listPostgresSchedules(pool: PostgresQueryClient): Promise<Array<Record<string, unknown>>>;
export function listPostgresScheduleSlots(
  pool: PostgresQueryClient,
  date: string,
  time: string,
): Promise<Array<Record<string, unknown>>>;
export function createPostgresSchedule(
  pool: PostgresQueryClient,
  schedule: MassScheduleInput,
): Promise<{ id: number }>;
export function updatePostgresSchedule(
  pool: PostgresQueryClient,
  id: number,
  schedule: MassScheduleInput,
): Promise<boolean>;
export function deletePostgresSchedule(pool: PostgresQueryClient, id: number): Promise<boolean>;
