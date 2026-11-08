import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import {
  closePostgresPool,
  getPostgresPool,
  initializePostgresPool,
} from '../src/db/postgres-pool.js';

async function verifySacramentalAccess() {
  dotenv.config({ quiet: true });

  try {
    await initializePostgresPool(process.env);
    const verificationSql = await readFile(
      new URL('../supabase/verify-sacramental-access.sql', import.meta.url),
      'utf8',
    );
    await getPostgresPool().query(verificationSql);
    console.log('Restricted PostgreSQL sacramental archive access checks passed.');
  } finally {
    await closePostgresPool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySacramentalAccess().catch(error => {
    console.error(`PostgreSQL sacramental access verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
