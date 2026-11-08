import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface AuthenticatedPostgresStaff {
  userId: number;
  email: string;
  role: 'Admin' | 'ParishPriest' | 'Secretary' | 'Bookkeeper' | 'Staff';
  mustChangePassword: boolean;
}

export function authenticatePostgresStaff(
  pool: PostgresQueryClient,
  login: string,
  password: string,
  verifyPassword: (password: string, storedHash: string) => boolean,
): Promise<AuthenticatedPostgresStaff | null>;
