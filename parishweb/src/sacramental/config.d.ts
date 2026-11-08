export interface SacramentalDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createSacramentalDatabaseConfig(
  env?: Record<string, string | undefined>,
): SacramentalDatabaseConfig;
