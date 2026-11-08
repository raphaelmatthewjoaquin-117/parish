export interface EventsDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createEventsDatabaseConfig(env?: Record<string, string | undefined>): EventsDatabaseConfig;
