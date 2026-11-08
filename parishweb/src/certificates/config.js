export function createCertificateDatabaseConfig(env = process.env) {
  const provider = (env.CERTIFICATE_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('CERTIFICATE_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when CERTIFICATE_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}
