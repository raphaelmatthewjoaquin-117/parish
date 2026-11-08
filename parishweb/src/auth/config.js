export function createIdentityDatabaseConfig(env = process.env) {
  const provider = (env.IDENTITY_DATABASE || 'sqlserver').trim().toLowerCase();
  if (!['sqlserver', 'postgres'].includes(provider)) {
    throw new Error('IDENTITY_DATABASE must be sqlserver or postgres.');
  }

  const postgresConfigured = Boolean(env.DATABASE_URL?.trim());
  if (provider === 'postgres' && !postgresConfigured) {
    throw new Error('DATABASE_URL must be configured when IDENTITY_DATABASE=postgres.');
  }

  return { provider, postgresConfigured };
}

export function createAdminTokenSigningSecret(env = process.env, developmentFallback = '') {
  const secret = env.ADMIN_TOKEN_SIGNING_SECRET ||
    (env.NODE_ENV === 'production' ? '' : developmentFallback);
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('ADMIN_TOKEN_SIGNING_SECRET must contain at least 32 characters.');
  }
  return secret;
}
