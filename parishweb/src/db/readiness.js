export async function checkDatabaseReadiness(pool) {
  await pool.request().query('SELECT 1 AS ready');
}
