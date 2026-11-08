import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import { hashAspNetPassword } from '../password-hash.js';
import { closePostgresPool, getPostgresPool, initializePostgresPool } from '../src/db/postgres-pool.js';
import {
  createInitialPostgresAdmin,
  validateInitialAdminInput,
} from '../src/auth/postgres-admin-bootstrap.js';

dotenv.config({ quiet: true });

function ask(prompt) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => readline.question(prompt, answer => {
    readline.close();
    resolve(answer);
  }));
}

async function bootstrapPostgresAdmin() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('Set DATABASE_URL in parishweb/.env before running this command.');
  let databaseName;
  try {
    databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, '')) || 'postgres';
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }

  const userName = await ask('First Admin username: ');
  const email = await ask('First Admin email: ');
  const password = await ask('New password (12+ characters): ');
  const confirmation = await ask('Confirm password: ');
  const operator = await ask('Setup performed by (name): ');
  const account = validateInitialAdminInput({ userName, email, password, confirmation, operator });

  const confirmationText = `CREATE FIRST ADMIN IN ${databaseName}`;
  const typedConfirmation = await ask(
    `This creates the first Admin in PostgreSQL database "${databaseName}". Type "${confirmationText}" to continue: `,
  );
  if (typedConfirmation !== confirmationText) {
    throw new Error('Confirmation did not match; no account was created.');
  }

  await initializePostgresPool();
  try {
    const { userId } = await createInitialPostgresAdmin(getPostgresPool(), {
      ...account,
      hashPassword: hashAspNetPassword,
    });
    console.log(`First Admin account created for ${account.email}. Sign in and change the password when prompted.`);
    return userId;
  } finally {
    await closePostgresPool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bootstrapPostgresAdmin().catch(error => {
    console.error(`PostgreSQL Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export { bootstrapPostgresAdmin };
