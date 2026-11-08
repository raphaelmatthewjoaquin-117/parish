export interface CertificateDatabaseConfig {
  provider: 'sqlserver' | 'postgres';
  postgresConfigured: boolean;
}

export function createCertificateDatabaseConfig(
  env?: Record<string, string | undefined>,
): CertificateDatabaseConfig;
