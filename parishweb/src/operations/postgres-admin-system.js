export async function getPostgresAdminHealth(pool) {
  const result = await pool.query('SELECT 1 AS "HealthCheck"');
  return result.rows;
}

export async function getPostgresAdminStatus(pool) {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE "Status" IN ('PendingVerification', 'PendingReview')
      ) AS "PendingVerifications",
      COUNT(*) FILTER (WHERE "Status" = 'Confirmed') AS "ConfirmedRequests",
      COUNT(*) FILTER (
        WHERE "Status" IN ('Voided', 'VoidedNoShow')
      ) AS "VoidedRequests",
      (SELECT COUNT("ParishionerId") FROM "public"."Parishioners") AS "TotalParishioners",
      (
        SELECT COUNT(DISTINCT user_role."UserId")
        FROM "public"."AspNetUserRoles" AS user_role
        INNER JOIN "public"."AspNetRoles" AS role ON role."RoleId" = user_role."RoleId"
        WHERE role."Name" IN ('Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff')
      ) AS "ActiveStaff"
    FROM "public"."ServiceRequest"
  `);
  const row = result.rows[0];
  if (!row) throw new Error('PostgreSQL admin status query returned no result.');

  const keys = [
    'PendingVerifications',
    'ConfirmedRequests',
    'VoidedRequests',
    'TotalParishioners',
    'ActiveStaff',
  ];
  return Object.fromEntries(keys.map(key => {
    const count = Number(row[key]);
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`PostgreSQL admin status returned an invalid ${key} count.`);
    }
    return [key, count];
  }));
}

export async function getPostgresAdminSystemInfo(pool, uptime) {
  const result = await pool.query(`
    SELECT version() AS version, now() AS "serverTime"
  `);
  const row = result.rows[0];
  if (!row) throw new Error('PostgreSQL system information query returned no result.');

  return {
    version: row.version,
    serverTime: row.serverTime,
    uptime,
  };
}
