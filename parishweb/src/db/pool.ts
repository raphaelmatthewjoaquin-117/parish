import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

/**
 * Initialize the database connection pool.
 * Should be called once at server startup.
 * @param config - SQL Server configuration object
 * @returns The initialized connection pool
 */
export async function initializePool(config: sql.config): Promise<sql.ConnectionPool> {
  if (pool) {
    console.log('Database pool already initialized, reusing existing pool');
    return pool;
  }

  pool = new sql.ConnectionPool(config);

  // Handle pool errors
  pool.on('error', (err: Error) => {
    console.error('Database pool error:', err);
    pool = null; // Reset on error to allow reconnection
  });

  try {
    await pool.connect();
    console.log('Database connection pool initialized successfully');
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
      console.log('Database connection pool closed');
    } catch (error) {
      console.error('Error closing database pool:', error);
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

