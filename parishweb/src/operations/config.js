export function createOperationsDatabaseConfig(env = process.env) {
  const provider = (env.OPERATIONS_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('OPERATIONS_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when OPERATIONS_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}
