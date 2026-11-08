import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;
type PostgresTransactionalPool = Pick<PostgresPool, 'connect'>;

export interface StaffModulePermission {
  view: boolean;
  edit: boolean;
}

export function getPostgresStaffUsers(
  pool: PostgresQueryClient,
  includeDetails: boolean,
): Promise<Array<{
  userId: number;
  userName: string;
  email: string | null;
  emailConfirmed: boolean;
  lockoutEnabled: false;
  accessFailedCount: 0;
  roles: string[];
}>>;

export function listPostgresUserManagementAudit(
  pool: PostgresQueryClient,
  limit: number,
): Promise<Record<string, unknown>[]>;

export function createPostgresStaffUser(
  pool: PostgresTransactionalPool,
  input: {
    userName: string;
    email: string;
    role: string;
    password: string;
    changedBy: string;
    hashPassword: (password: string) => string;
  },
): Promise<{ userId: number } | { duplicate: true } | { roleMissing: true }>;

export function updatePostgresStaffUser(
  pool: PostgresTransactionalPool,
  input: {
    userId: number;
    email?: string;
    hasEmail: boolean;
    password?: string;
    resetToDefault: boolean;
    requestedRoles: string[] | null;
    changedBy: string;
    hashPassword: (password: string) => string;
    allowAdminTarget: boolean;
  },
): Promise<
  | { updated: true }
  | { duplicate: true }
  | { roleMissing: true; role: string | undefined }
  | { missing: true }
  | { targetIsAdmin: true }
>;

export function deletePostgresStaffUser(
  pool: PostgresTransactionalPool,
  userId: number,
  changedBy: string,
): Promise<boolean>;

export function updatePostgresStaffProfile(
  pool: PostgresQueryClient,
  userId: number,
  userName: string,
  email: string,
): Promise<{ updated: boolean; duplicate: boolean }>;

export function getPostgresUserPermissions(
  pool: PostgresQueryClient,
  userId: number,
): Promise<Record<string, StaffModulePermission>>;

export function updatePostgresUserPermissions(
  pool: PostgresTransactionalPool,
  userId: number,
  overrides: Record<string, StaffModulePermission>,
  changedBy: string,
): Promise<boolean>;
