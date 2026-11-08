export async function checkDatabaseReadiness(pool) {
  await pool.request().query('SELECT 1 AS ready');
}

export async function checkPostgresReadiness(pool) {
  const result = await pool.query(
    `SELECT to_regclass('"public"."Events"') AS events_table`,
  );
  if (!result.rows[0]?.events_table) {
    throw new Error('PostgreSQL readiness check failed: required Events table is missing.');
  }
}
