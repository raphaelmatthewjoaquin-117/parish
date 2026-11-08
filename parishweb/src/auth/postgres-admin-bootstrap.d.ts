type PostgresTransactionClient = {
  query(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
  release(): void;
};

type PostgresTransactionalPool = {
  connect(): Promise<PostgresTransactionClient>;
};

export function validateInitialAdminInput(input: {
  userName: unknown;
  email: unknown;
  password: unknown;
  confirmation: unknown;
  operator: unknown;
}): {
  userName: string;
  email: string;
  password: string;
  operator: string;
};

export function createInitialPostgresAdmin(
  pool: PostgresTransactionalPool,
  input: {
    userName: string;
    email: string;
    password: string;
    operator: string;
    hashPassword: (password: string) => string;
  },
): Promise<{ userId: number }>;
