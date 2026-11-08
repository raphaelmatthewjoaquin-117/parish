export interface IdentityDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createIdentityDatabaseConfig(
  env?: Record<string, string | undefined>,
): IdentityDatabaseConfig;

export function createAdminTokenSigningSecret(
  env?: Record<string, string | undefined>,
  developmentFallback?: string,
): string;
