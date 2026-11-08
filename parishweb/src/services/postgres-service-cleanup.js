import { isNoShowEligible, isUnverifiedExpired } from '../../server-rules.js';

async function updateRequestAndDeleteDocuments(pool, requestId, status) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const noShow = status === 'VoidedNoShow';
    const result = await client.query(noShow ? `
      UPDATE "public"."ServiceRequest"
      SET "Status" = 'VoidedNoShow',
          "AttendanceStatus" = 'NoShow',
          "AttendanceMarkedAt" = timezone('UTC', now()),
          "VoidedAt" = timezone('UTC', now())
      WHERE "ServiceRequestId" = $1
        AND "Status" = 'Confirmed'
        AND ("AttendanceStatus" IS NULL OR "AttendanceStatus" = '')
      RETURNING "ServiceRequestId"
    ` : `
      UPDATE "public"."ServiceRequest"
      SET "Status" = 'Voided',
          "VoidedAt" = timezone('UTC', now())
      WHERE "ServiceRequestId" = $1
        AND "Status" = 'PendingVerification'
      RETURNING "ServiceRequestId"
    `, [requestId]);

    if (result.rowCount > 0) {
      await client.query(`
        DELETE FROM "public"."ServiceRequestDocument"
        WHERE "ServiceRequestId" = $1
      `, [requestId]);
    }

    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Service request cleanup and rollback failed.');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupPostgresServiceRequests(pool, now = new Date()) {
  const result = await pool.query(`
    SELECT "ServiceRequestId" AS id,
      "Status" AS status,
      "ScheduledDate" AS "scheduledDate",
      "ScheduledTime" AS "scheduledTime",
      "AttendanceStatus" AS "attendanceStatus",
      "CreatedAt" AS "createdAt"
    FROM "public"."ServiceRequest"
    WHERE "Status" IN ('Confirmed', 'PendingVerification')
  `);
  let noShows = 0;
  let expiredUnverified = 0;

  for (const request of result.rows) {
    if (isNoShowEligible(request, now)) {
      if (await updateRequestAndDeleteDocuments(pool, request.id, 'VoidedNoShow')) noShows += 1;
    } else if (isUnverifiedExpired(request, now)) {
      if (await updateRequestAndDeleteDocuments(pool, request.id, 'Voided')) expiredUnverified += 1;
    }
  }

  return { noShows, expiredUnverified };
}
