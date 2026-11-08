export function createSacramentalDatabaseConfig(env = process.env) {
  const provider = (env.SACRAMENTAL_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('SACRAMENTAL_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when SACRAMENTAL_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}
