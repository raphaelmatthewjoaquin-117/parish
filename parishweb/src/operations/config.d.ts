export interface OperationsDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createOperationsDatabaseConfig(
  env?: Record<string, string | undefined>,
): OperationsDatabaseConfig;
