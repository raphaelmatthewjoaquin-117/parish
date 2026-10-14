import sql from 'mssql';
import { logger } from '../utils/logger.js';

let pool: sql.ConnectionPool | null = null;

/**
 * Initialize the database connection pool.
 * Should be called once at server startup.
 * @param config - SQL Server configuration object
 * @returns The initialized connection pool
 */
export async function initializePool(config: sql.config): Promise<sql.ConnectionPool> {
  if (pool) {
    logger.info({ type: 'database', action: 'pool_reuse' }, 'Database pool already initialized; reusing connection pool');
    return pool;
  }

  pool = new sql.ConnectionPool(config);

  pool.on('error', (err: Error) => {
    logger.error({ type: 'database', action: 'pool_error', message: err.message, stack: err.stack }, 'Database pool error');
    pool = null;
  });

  try {
    await pool.connect();
    logger.info({ type: 'database', action: 'pool_initialized' }, 'Database connection pool initialized successfully');
    return pool;
  } catch (error) {
    pool = null;
    throw error;
  }
}

/**
 * Get the existing connection pool.
 * Must call initializePool first.
 * @returns The connection pool instance
 * @throws If pool is not initialized
 */
export function getPool(): sql.ConnectionPool {
  if (!pool) {
    throw new Error(
      'Database connection pool not initialized. Call initializePool() at server startup.'
    );
  }
  return pool;
}

/**
 * Close the connection pool.
 * Should be called during graceful server shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
      logger.info({ type: 'database', action: 'pool_closed' }, 'Database connection pool closed');
    } catch (error) {
      logger.error({ type: 'database', action: 'pool_close_failed', cause: error }, 'Error closing database pool');
    } finally {
      pool = null;
    }
  }
}

/**
 * Check if pool is initialized.
 * Useful for health checks.
 */
export function isPoolConnected(): boolean {
  return pool !== null && pool.connected === true;
}

