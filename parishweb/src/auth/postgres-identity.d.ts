import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export interface StaffLoginRecord {
  userId: number;
  email: string;
  userName: string;
  passwordHash: string;
  mustChangePassword: boolean;
  roles: string[];
}

export interface StaffAuthorizationState {
  userId: number;
  userName: string;
  email: string;
  role: 'Admin' | 'ParishPriest' | 'Secretary' | 'Bookkeeper' | 'Staff';
  mustChangePassword: boolean;
  overrides: Record<string, { view: boolean; edit: boolean }>;
}

export function findStaffForLogin(pool: PostgresQueryClient, login: string): Promise<StaffLoginRecord | null>;
export function getStaffAuthorizationState(
  pool: PostgresQueryClient,
  userId: number,
): Promise<StaffAuthorizationState | null>;
