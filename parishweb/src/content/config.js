export function createContentDatabaseConfig(env = process.env) {
  const provider = (env.CONTENT_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('CONTENT_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when CONTENT_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}
