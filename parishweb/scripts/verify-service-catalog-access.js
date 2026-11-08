import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import {
  closePostgresPool,
  getPostgresPool,
  initializePostgresPool,
} from '../src/db/postgres-pool.js';

async function verifyServiceCatalogAccess() {
  dotenv.config({ quiet: true });

  try {
    await initializePostgresPool(process.env);
    const verificationSql = await readFile(
      new URL('../supabase/verify-service-catalog-access.sql', import.meta.url),
      'utf8',
    );
    await getPostgresPool().query(verificationSql);
    console.log('Restricted PostgreSQL service-catalog access checks passed.');
  } finally {
    await closePostgresPool();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyServiceCatalogAccess().catch(error => {
    console.error(`PostgreSQL service-catalog access verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
