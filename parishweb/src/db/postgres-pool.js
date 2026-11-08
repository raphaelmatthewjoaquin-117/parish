import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

let pool = null;
let initialization = null;

export function createPostgresPoolConfig(env = process.env) {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL must be configured.');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
  if (sslMode && !['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
    throw new Error('DATABASE_URL must require TLS.');
  }
  url.searchParams.delete('sslmode');

  const certificatePath = env.DATABASE_SSL_CA_PATH?.trim();
  const certificateAuthority = certificatePath
    ? readFileSync(certificatePath, 'utf8').trim()
    : env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim();
  const ssl = { rejectUnauthorized: true };
  if (certificateAuthority) ssl.ca = certificateAuthority;

  return {
    connectionString: url.toString(),
    ssl,
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  };
}

export async function assertRestrictedPostgresRole(pool) {
  const result = await pool.query(`
    SELECT
      r.rolsuper AS is_superuser,
      r.rolbypassrls AS bypasses_rls,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relowner = r.oid
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
      ) AS owns_application_objects,
      EXISTS (
        SELECT 1
        FROM pg_database d
        WHERE d.datname = current_database()
          AND d.datdba = r.oid
      ) AS owns_database,
      EXISTS (
        SELECT 1
        FROM pg_auth_members m
        WHERE m.member = r.oid
      ) AS has_role_memberships
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  const role = result.rows[0];
  if (
    !role ||
    role.is_superuser ||
    role.bypasses_rls ||
    role.owns_application_objects ||
    role.owns_database ||
    role.has_role_memberships
  ) {
    throw new Error(
      'DATABASE_URL must use a restricted PostgreSQL runtime role: non-superuser, NOBYPASSRLS, no role memberships, and not an application object or database owner.',
    );
  }
}

export async function initializePostgresPool(env = process.env) {
  if (pool) return pool;
  if (initialization) return initialization;

  initialization = (async () => {
    const candidate = new Pool(createPostgresPoolConfig(env));
    candidate.on('error', error => {
      console.error('[DATABASE] PostgreSQL pool error:', error.code || error.name);
    });

    try {
      await candidate.query('SELECT 1 AS ready');
      await assertRestrictedPostgresRole(candidate);
      pool = candidate;
      console.info('[DATABASE] PostgreSQL pool initialized');
      return pool;
    } catch (error) {
      try {
        await candidate.end();
      } catch (closeError) {
        console.error(
          '[DATABASE] Failed to close PostgreSQL pool after initialization failure:',
          closeError.code || closeError.name,
        );
      }
      throw error;
    }
  })();

  try {
    return await initialization;
  } finally {
    initialization = null;
  }
}

export function getPostgresPool() {
  if (!pool) {
    throw new Error('PostgreSQL connection pool is not initialized.');
  }
  return pool;
}

export async function closePostgresPool() {
  if (initialization) await initialization;
  if (!pool) return;

  const currentPool = pool;
  pool = null;
  await currentPool.end();
  console.info('[DATABASE] PostgreSQL pool closed');
}
