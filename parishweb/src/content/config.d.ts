export interface ContentDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createContentDatabaseConfig(
  env?: Record<string, string | undefined>,
): ContentDatabaseConfig;
