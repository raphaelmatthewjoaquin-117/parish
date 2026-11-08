export async function getPostgresServiceAvailability(pool, serviceId) {
  const serviceResult = await pool.query(`
    SELECT "Name" AS name
    FROM "public"."Service"
    WHERE "ServiceId" = $1
  `, [serviceId]);
  const bookingResult = await pool.query(`
    SELECT to_char("ScheduledDate", 'YYYY-MM-DD') AS date,
      to_char("ScheduledTime", 'HH24:MI') AS time,
      COUNT(*) OVER (PARTITION BY "ScheduledDate") AS total
    FROM "public"."ServiceRequest"
    WHERE "ServiceId" = $1
      AND "ScheduledDate" IS NOT NULL
      AND "ScheduledTime" IS NOT NULL
      AND "Status" IN ('PendingVerification', 'PendingReview', 'Confirmed')
  `, [serviceId]);
  const blockResult = await pool.query(`
    SELECT to_char("BlockDate", 'YYYY-MM-DD') AS "blockDate",
      "BlockTime", "Reason"
    FROM "public"."BlockedSlots"
    WHERE "BlockDate" >= timezone('Asia/Manila', now())::date
      AND ("Scope" = 'All' OR ("Scope" = 'Service' AND "ServiceId" = $1))
  `, [serviceId]);

  return {
    name: serviceResult.rows[0]?.name || '',
    bookings: bookingResult.rows.map(row => ({ ...row, total: Number(row.total) })),
    blocks: blockResult.rows,
  };
}
