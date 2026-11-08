const eventColumns = `
  "EventId", "Title", "TitleTl", "Description", "DescriptionTl",
  "Body", "BodyTl", "EventDate", "EventTime", "Location",
  "LocationTl", "PhotoUrl"
`;

function mapEvent(row) {
  const date = row.EventDate instanceof Date
    ? row.EventDate.toISOString().slice(0, 10)
    : String(row.EventDate ?? '').slice(0, 10);

  return {
    id: String(row.EventId),
    title: String(row.Title ?? ''),
    titleTl: String(row.TitleTl ?? ''),
    description: String(row.Description ?? ''),
    descriptionTl: String(row.DescriptionTl ?? ''),
    detail: String(row.Body ?? ''),
    detailTl: String(row.BodyTl ?? ''),
    date,
    time: String(row.EventTime ?? '').slice(0, 8),
    location: String(row.Location ?? ''),
    locationTl: String(row.LocationTl ?? ''),
    photoUrl: String(row.PhotoUrl ?? ''),
  };
}

function valuesForEvent(event) {
  return [
    event.title,
    event.titleTl || '',
    event.description || '',
    event.descriptionTl || '',
    event.detail || '',
    event.detailTl || '',
    event.date,
    event.time || null,
    event.location || null,
    event.locationTl || '',
    event.photoUrl || '',
  ];
}

export async function listPostgresEvents(pool) {
  const result = await pool.query(`
    SELECT ${eventColumns}
    FROM "public"."Events"
    WHERE "EventDate" IS NOT NULL
    ORDER BY "EventDate", "EventId"
  `);

  return result.rows.map(mapEvent);
}

export async function createPostgresEvent(pool, event) {
  const result = await pool.query(`
    INSERT INTO "public"."Events" (
      "Title", "TitleTl", "Description", "DescriptionTl",
      "Body", "BodyTl", "EventDate", "EventTime", "Location",
      "LocationTl", "PhotoUrl"
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING ${eventColumns}
  `, valuesForEvent(event));

  return mapEvent(result.rows[0]);
}

export async function updatePostgresEvent(pool, eventId, event) {
  const result = await pool.query(`
    UPDATE "public"."Events"
    SET "Title" = $1, "TitleTl" = $2, "Description" = $3,
        "DescriptionTl" = $4, "Body" = $5, "BodyTl" = $6,
        "EventDate" = $7, "EventTime" = $8, "Location" = $9,
        "LocationTl" = $10, "PhotoUrl" = $11
    WHERE "EventId" = $12
    RETURNING ${eventColumns}
  `, [...valuesForEvent(event), eventId]);

  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

export async function deletePostgresEvent(pool, eventId) {
  const result = await pool.query(
    'DELETE FROM "public"."Events" WHERE "EventId" = $1',
    [eventId],
  );

  return result.rowCount > 0;
}
