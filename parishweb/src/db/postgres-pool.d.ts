export interface PostgresPool {
  query(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  connect(): Promise<{
    query(
      query: string,
      values?: unknown[],
    ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
    release(): void;
  }>;
  on(event: 'error', listener: (error: Error & { code?: string }) => void): this;
  end(): Promise<void>;
}

export function createPostgresPoolConfig(env?: Record<string, string | undefined>): {
  connectionString: string;
  ssl: { rejectUnauthorized: boolean; ca?: string };
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};
export function assertRestrictedPostgresRole(pool: {
  query(query: string): Promise<{ rows: Record<string, boolean>[] }>;
}): Promise<void>;
export function initializePostgresPool(env?: Record<string, string | undefined>): Promise<PostgresPool>;
export function getPostgresPool(): PostgresPool;
export function closePostgresPool(): Promise<void>;
