export async function listPostgresMassIntentions(pool) {
  const result = await pool.query(`
    SELECT *
    FROM "public"."MassIntentions"
    ORDER BY "IntentionDate", "IntentionTime"
  `);
  return result.rows.map(row => ({ ...row, Offering: Number(row.Offering) }));
}

export async function listPostgresIntentionSlots(pool, date, time) {
  const result = await pool.query(`
    SELECT "MassIntentionId" AS id, "IntentionDate" AS date, "IntentionTime" AS time, "Status" AS status
    FROM "public"."MassIntentions"
    WHERE "IntentionDate" = $1 AND "IntentionTime" = $2
  `, [date, time]);
  return result.rows;
}

export async function createPostgresMassIntention(pool, intention) {
  const result = await pool.query(`
    INSERT INTO "public"."MassIntentions"
      ("IntentionDate", "IntentionTime", "Offering", "RequestedBy", "IntentionText", "CreatedBy")
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING "MassIntentionId"
  `, [
    intention.date,
    intention.time,
    intention.offering,
    intention.requestedBy,
    intention.intentionText,
    intention.createdBy,
  ]);
  if (!result.rows[0]) throw new Error('PostgreSQL did not return the created Mass intention ID.');
  return result.rows[0];
}

export async function updatePostgresMassIntentionStatus(pool, id, status) {
  const result = await pool.query(`
    UPDATE "public"."MassIntentions"
    SET "Status" = $2, "UpdatedAt" = timezone('UTC', now())
    WHERE "MassIntentionId" = $1
  `, [id, status]);
  return result.rowCount !== null && result.rowCount > 0;
}
