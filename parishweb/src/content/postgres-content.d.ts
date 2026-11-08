import type { PostgresPool } from '../db/postgres-pool.js';

type PostgresQueryClient = Pick<PostgresPool, 'query'>;

export function getPostgresSiteContent(pool: PostgresQueryClient, key: string): Promise<string | null>;

export function savePostgresSiteContent(
  pool: PostgresQueryClient,
  key: string,
  contentJson: string,
  updatedBy: string,
): Promise<void>;

export function createPostgresContactMessage(
  pool: PostgresQueryClient,
  message: { name: string; email: string; phone: string | null; message: string },
): Promise<void>;

export function listPostgresContactMessages(pool: PostgresQueryClient): Promise<Array<{
  id: number;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  isRead: boolean;
  createdAt: Date | string;
}>>;

export function setPostgresContactMessageRead(pool: PostgresQueryClient, id: number, isRead: boolean): Promise<void>;
export function deletePostgresContactMessage(pool: PostgresQueryClient, id: number): Promise<void>;
export function listPostgresPublicPrayers(pool: PostgresQueryClient): Promise<Array<{
  id: number;
  name: string;
  category: string | null;
  request: string | null;
  createdAt: Date | string | null;
}>>;

export function createPostgresPrayer(
  pool: PostgresQueryClient,
  prayer: {
    name: string;
    category: string;
    request: string;
    anonymous: boolean;
    shareWithCommunity: boolean;
  },
): Promise<number | undefined>;

export function approvePostgresPrayer(pool: PostgresQueryClient, prayerId: number): Promise<boolean>;
export function getPostgresAdminPrayers(pool: PostgresQueryClient): Promise<Array<{
  id: number;
  name: string | null;
  category: string | null;
  request: string | null;
  anonymous: boolean;
  shareWithCommunity: boolean;
  isApproved: boolean;
  createdAt: Date | string | null;
}>>;
export function deletePostgresPrayer(pool: PostgresQueryClient, prayerId: number): Promise<void>;
