import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface PasswordChangeResult {
  changed: boolean;
  auditError: Error | null;
}

export function changePostgresStaffPassword(
  pool: PostgresQueryClient,
  userId: number,
  currentPassword: string,
  newPassword: string,
  options: {
    verifyPassword: (password: string, storedHash: string) => boolean;
    hashPassword: (password: string) => string;
  },
): Promise<PasswordChangeResult>;
