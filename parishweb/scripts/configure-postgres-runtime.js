import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  assertRestrictedPostgresRole,
  createPostgresPoolConfig,
} from '../src/db/postgres-pool.js';

const runtimeRole = 'parish_app_runtime';

export function createRuntimeDatabaseUrl(databaseUrl, password) {
  if (!password) throw new Error('A non-empty runtime password is required.');

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const currentUsername = decodeURIComponent(url.username);
  const poolerProjectSuffix = currentUsername.startsWith('postgres.')
    ? currentUsername.slice('postgres'.length)
    : '';
  url.username = `${runtimeRole}${poolerProjectSuffix}`;
  url.password = password;
  return url.toString();
}

export function updateDatabaseUrlInEnv(contents, databaseUrl) {
  const lines = contents.split(/(?<=\n)/);
  const settingLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*(?:export\s+)?DATABASE_URL\s*=/.test(line));

  if (settingLines.length !== 1) {
    throw new Error('The .env file must contain exactly one DATABASE_URL setting.');
  }

  const { line, index } = settingLines[0];
  const assignment = line.match(/^(\s*(?:export\s+)?DATABASE_URL\s*=\s*)/);
  lines[index] = `${assignment[1]}${databaseUrl}${line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : ''}`;
  return lines.join('');
}

function promptHidden(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const decoder = new StringDecoder('utf8');
    const finish = error => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = chunk => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003' || character === '\u0004') {
          finish(new Error('Password entry cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = [...value].slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
        } else if (character >= ' ') {
          value += character;
          process.stdout.write('*');
        }
      }
    };

    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function promptForPassword() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const password = await promptHidden('New runtime password (24+ characters; hidden): ');
    const confirmation = await promptHidden('Confirm runtime password: ');
    if (password.length >= 24 && password === confirmation) return password;
    console.log(password.length < 24
      ? 'Use at least 24 characters.'
      : 'The passwords did not match.');
  }
  throw new Error('Password was not changed; start again and use matching passwords of at least 24 characters.');
}

function assertEnvIsIgnored() {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '.env'], { stdio: 'ignore' });
  } catch {
    throw new Error('The local .env file is not confirmed as ignored; no changes were made.');
  }
}

async function configureRuntimeRole() {
  const envPath = path.resolve('.env');
  assertEnvIsIgnored();

  const envContents = readFileSync(envPath, 'utf8');
  const fileEnv = dotenv.parse(envContents);
  const currentDatabaseUrl = fileEnv.DATABASE_URL?.trim();
  if (!currentDatabaseUrl) {
    throw new Error('Set the current owner/admin DATABASE_URL in the ignored .env first.');
  }
  if (decodeURIComponent(new URL(currentDatabaseUrl).username).startsWith(runtimeRole)) {
    throw new Error('DATABASE_URL already uses the runtime role; restore the private owner/admin URL before running this setup.');
  }

  const password = await promptForPassword();
  const runtimeDatabaseUrl = createRuntimeDatabaseUrl(currentDatabaseUrl, password);
  const updatedEnv = updateDatabaseUrlInEnv(envContents, runtimeDatabaseUrl);
  const temporaryPath = `${envPath}.${randomBytes(8).toString('hex')}.tmp`;
  const envMode = statSync(envPath).mode & 0o777;
  const poolConfig = createPostgresPoolConfig(fileEnv);
  writeFileSync(temporaryPath, updatedEnv, { mode: envMode });

  let pool;
  let passwordChanged = false;
  let envUpdated = false;
  try {
    pool = new Pool(poolConfig);
    const result = await pool.query(`
      SELECT
        r_current.rolsuper AS is_superuser,
        r_current.rolcreaterole AS can_create_roles,
        r_runtime.oid IS NOT NULL AS runtime_role_exists,
        r_runtime.rolsuper AS runtime_is_superuser,
        r_runtime.rolbypassrls AS runtime_bypasses_rls,
        r_runtime.rolinherit AS runtime_inherits_roles,
        r_runtime.rolcanlogin AS runtime_can_login,
        EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relowner = r_runtime.oid
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND n.nspname NOT LIKE 'pg_toast%'
        ) AS runtime_owns_application_objects,
        EXISTS (
          SELECT 1
          FROM pg_database d
          WHERE d.datname = current_database()
            AND d.datdba = r_runtime.oid
        ) AS runtime_owns_database,
        EXISTS (
          SELECT 1
          FROM pg_auth_members m
          WHERE m.member = r_runtime.oid
        ) AS runtime_has_role_memberships
      FROM pg_roles r_current
      LEFT JOIN pg_roles r_runtime ON r_runtime.rolname = $1
      WHERE r_current.rolname = current_user
    `, [runtimeRole]);

    const status = result.rows[0];
    if (!status || (!status.is_superuser && !status.can_create_roles)) {
      throw new Error('The configured database role cannot set the runtime role password.');
    }
    if (
      !status.runtime_role_exists ||
      !status.runtime_can_login ||
      status.runtime_is_superuser ||
      status.runtime_bypasses_rls ||
      status.runtime_inherits_roles ||
      status.runtime_owns_application_objects ||
      status.runtime_owns_database ||
      status.runtime_has_role_memberships
    ) {
      throw new Error('The Supabase runtime role is missing or does not meet the restricted-role requirements.');
    }

    const statement = await pool.query(
      'SELECT format(\'ALTER ROLE %I PASSWORD %L\', $1::text, $2::text) AS statement',
      [runtimeRole, password],
    );
    await pool.query(statement.rows[0].statement);
    passwordChanged = true;

    const runtimePool = new Pool(createPostgresPoolConfig({
      ...fileEnv,
      DATABASE_URL: runtimeDatabaseUrl,
    }));
    try {
      await runtimePool.query('SELECT 1 AS ready');
      await assertRestrictedPostgresRole(runtimePool);
    } finally {
      await runtimePool.end();
    }

    renameSync(temporaryPath, envPath);
    envUpdated = true;
  } catch (error) {
    if (passwordChanged) {
      throw new Error(envUpdated
        ? 'The runtime password and local .env were updated, but setup verification did not finish.'
        : 'The runtime password was changed, but its connection was not verified and the local .env was left unchanged. Rerun this setup after checking Supabase connectivity.');
    }
    throw error;
  } finally {
    if (pool) await pool.end();
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  console.log('Restricted runtime connection verified and ignored .env updated. Credentials were not displayed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  configureRuntimeRole().catch(error => {
    console.error('Supabase runtime setup failed:', error.message);
    process.exitCode = 1;
  });
}
