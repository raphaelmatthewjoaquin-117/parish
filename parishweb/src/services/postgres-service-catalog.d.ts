import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export function listPostgresServices(pool: PostgresQueryClient): Promise<Array<{
  id: number;
  name: string;
  description: string | null;
}>>;

export function listPostgresServiceFields(
  pool: PostgresQueryClient,
  serviceId: number,
): Promise<{ fields: Array<{
  key: string;
  label: string;
  type: string;
  options?: unknown;
  required: boolean;
}> }>;

interface PostgresServiceFieldInput {
  serviceId?: number;
  key?: string;
  label: string;
  type: string;
  optionsJson: string | null;
  required: boolean;
  sortOrder: number;
  active: boolean;
}

export function listPostgresAdminServiceFields(
  pool: PostgresQueryClient,
): Promise<Array<{
  id: number;
  serviceId: number;
  serviceName: string;
  key: string;
  label: string;
  type: string;
  options?: unknown;
  required: boolean;
  sortOrder: number;
  active: boolean;
}>>;

export function createPostgresServiceField(
  pool: PostgresQueryClient,
  field: PostgresServiceFieldInput & { serviceId: number; key: string },
): Promise<number>;

export function updatePostgresServiceField(
  pool: PostgresQueryClient,
  id: number,
  field: PostgresServiceFieldInput,
): Promise<boolean>;

export function deletePostgresServiceField(pool: PostgresQueryClient, id: number): Promise<boolean>;
