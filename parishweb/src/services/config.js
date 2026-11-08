export function createServiceDatabaseConfig(env = process.env) {
  const provider = (env.SERVICE_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('SERVICE_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when SERVICE_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}
