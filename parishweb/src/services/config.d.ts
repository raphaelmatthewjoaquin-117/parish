export interface ServiceDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createServiceDatabaseConfig(
  env?: Record<string, string | undefined>,
): ServiceDatabaseConfig;
