const scheduleColumns = `
  "MassScheduleId" AS id, "Title" AS title, "MassDate" AS date, "MassTime" AS time,
  "Location" AS location, "PriestUsername" AS "priestUsername", "Notes" AS notes, "Status" AS status
`;

export async function listPostgresSchedules(pool) {
  const result = await pool.query(`
    SELECT ${scheduleColumns}
    FROM "public"."MassSchedule"
    ORDER BY "MassDate", "MassTime"
  `);
  return result.rows;
}

export async function listPostgresScheduleSlots(pool, date, time) {
  const result = await pool.query(`
    SELECT "MassScheduleId" AS id, "MassDate" AS date, "MassTime" AS time,
      "Location" AS location, "PriestUsername" AS "priestUsername", "Status" AS status
    FROM "public"."MassSchedule"
    WHERE "MassDate" = $1 AND "MassTime" = $2
  `, [date, time]);
  return result.rows;
}

export async function createPostgresSchedule(pool, schedule) {
  const result = await pool.query(`
    INSERT INTO "public"."MassSchedule"
      ("Title", "MassDate", "MassTime", "Location", "PriestUsername", "Notes", "Status")
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING "MassScheduleId" AS id
  `, [
    schedule.title,
    schedule.date,
    schedule.time,
    schedule.location,
    schedule.priestUsername,
    schedule.notes,
    schedule.status,
  ]);
  if (!result.rows[0]) throw new Error('PostgreSQL did not return the created schedule ID.');
  return result.rows[0];
}

export async function updatePostgresSchedule(pool, id, schedule) {
  const result = await pool.query(`
    UPDATE "public"."MassSchedule"
    SET "Title" = $2, "MassDate" = $3, "MassTime" = $4, "Location" = $5,
      "PriestUsername" = $6, "Notes" = $7, "Status" = $8, "UpdatedAt" = timezone('UTC', now())
    WHERE "MassScheduleId" = $1
  `, [
    id,
    schedule.title,
    schedule.date,
    schedule.time,
    schedule.location,
    schedule.priestUsername,
    schedule.notes,
    schedule.status,
  ]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deletePostgresSchedule(pool, id) {
  const result = await pool.query(`
    DELETE FROM "public"."MassSchedule"
    WHERE "MassScheduleId" = $1
  `, [id]);
  return result.rowCount !== null && result.rowCount > 0;
}
