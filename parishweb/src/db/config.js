const postgresProviders = [
  'IDENTITY_DATABASE',
  'EVENTS_DATABASE',
  'CONTENT_DATABASE',
  'CERTIFICATE_DATABASE',
  'SERVICE_DATABASE',
  'OPERATIONS_DATABASE',
  'SACRAMENTAL_DATABASE',
];

export function isPostgresOnlyMode(env = process.env) {
  return postgresProviders.every(setting => env[setting]?.trim().toLowerCase() === 'postgres');
}

export function createDatabaseConfig(env = process.env) {
  const certificateSetting = env.DB_TRUST_SERVER_CERTIFICATE?.trim().toLowerCase();
  if (certificateSetting && certificateSetting !== 'true' && certificateSetting !== 'false') {
    throw new Error('DB_TRUST_SERVER_CERTIFICATE must be true or false.');
  }

  const trustServerCertificate = certificateSetting
    ? certificateSetting === 'true'
    : env.NODE_ENV !== 'production';

  if (env.NODE_ENV === 'production' && trustServerCertificate) {
    throw new Error('DB_TRUST_SERVER_CERTIFICATE cannot be true in production.');
  }

  const authMode = (env.DB_AUTH || '').toLowerCase();
  if (env.NODE_ENV === 'production') {
    if (authMode !== 'sql') {
      throw new Error('DB_AUTH=sql must be configured in production.');
    }

    for (const setting of ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
      if (!env[setting]) {
        throw new Error(`${setting} must be configured in production.`);
      }
    }
  }

  const port = Number(env.DB_PORT || 1433);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  const config = {
    server: env.DB_SERVER || 'localhost',
    database: env.DB_NAME || 'ParishDB',
    options: {
      encrypt: true,
      trustServerCertificate,
    },
    port,
  };

  if (authMode === 'sql') {
    return {
      ...config,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    };
  }

  if (authMode === 'ntlm') {
    return {
      ...config,
      authentication: {
        type: 'ntlm',
        options: {
          domain: env.DB_DOMAIN || '',
          userName: env.DB_USER,
          password: env.DB_PASSWORD,
        },
      },
    };
  }

  return config;
}

export function assertProductionStorageConfiguration(
  env = process.env,
  azureConfigured,
  supabaseStorageConfigured = false,
) {
  if (env.NODE_ENV === 'production' && isPostgresOnlyMode(env) && !supabaseStorageConfigured) {
    throw new Error('Supabase Storage must be configured in PostgreSQL-only production mode.');
  }
  if (env.NODE_ENV === 'production' && !azureConfigured && !supabaseStorageConfigured) {
    throw new Error('Azure Blob Storage or Supabase Storage must be configured in production.');
  }
}
