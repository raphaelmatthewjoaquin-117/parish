export async function getPostgresSiteContent(pool, key) {
  const result = await pool.query(`
    SELECT "ContentJson" AS "contentJson"
    FROM "public"."SiteContent"
    WHERE "ContentKey" = $1
  `, [key]);
  const contentJson = result.rows[0]?.contentJson;
  return contentJson == null ? null : JSON.parse(contentJson);
}

export async function savePostgresSiteContent(pool, key, contentJson, updatedBy) {
  await pool.query(`
    INSERT INTO "public"."SiteContent"
      ("ContentKey", "ContentJson", "UpdatedAt", "UpdatedBy")
    VALUES ($1, $2, timezone('UTC', now()), $3)
    ON CONFLICT ("ContentKey") DO UPDATE
    SET "ContentJson" = EXCLUDED."ContentJson",
        "UpdatedAt" = timezone('UTC', now()),
        "UpdatedBy" = EXCLUDED."UpdatedBy"
  `, [key, contentJson, updatedBy]);
}

export async function createPostgresContactMessage(pool, { name, email, phone, message }) {
  await pool.query(`
    INSERT INTO "public"."ContactMessages" ("Name", "Email", "Phone", "Message")
    VALUES ($1, $2, $3, $4)
  `, [name, email, phone, message]);
}

export async function listPostgresContactMessages(pool) {
  const result = await pool.query(`
    SELECT "ContactMessageId" AS "contactMessageId", "Name" AS name,
      "Email" AS email, "Phone" AS phone, "Message" AS message,
      "IsRead" AS "isRead", "CreatedAt" AS "createdAt"
    FROM "public"."ContactMessages"
    ORDER BY "CreatedAt" DESC
  `);
  return result.rows.map(row => ({
    id: row.contactMessageId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt,
  }));
}

export async function setPostgresContactMessageRead(pool, id, isRead) {
  await pool.query(`
    UPDATE "public"."ContactMessages"
    SET "IsRead" = $1
    WHERE "ContactMessageId" = $2
  `, [isRead, id]);
}

export async function deletePostgresContactMessage(pool, id) {
  await pool.query(`
    DELETE FROM "public"."ContactMessages"
    WHERE "ContactMessageId" = $1
  `, [id]);
}

export async function listPostgresPublicPrayers(pool) {
  const result = await pool.query(`
    SELECT "PrayerId" AS "prayerId", "Name" AS name, "Category" AS category,
      "Request" AS request, "Anonymous" AS anonymous, "CreatedAt" AS "createdAt"
    FROM "public"."PrayerRequests"
    WHERE "IsApproved" = true AND "ShareWithCommunity" = true
    ORDER BY "CreatedAt" DESC
  `);
  return result.rows.map(row => ({
    id: row.prayerId,
    name: row.anonymous ? 'Anonymous' : row.name,
    category: row.category,
    request: row.request,
    createdAt: row.createdAt,
  }));
}

export async function createPostgresPrayer(pool, {
  name,
  category,
  request,
  anonymous,
  shareWithCommunity,
}) {
  const result = await pool.query(`
    INSERT INTO "public"."PrayerRequests"
      ("Name", "Category", "Request", "Anonymous", "ShareWithCommunity", "IsApproved", "CreatedAt")
    VALUES ($1, $2, $3, $4, $5, false, timezone('UTC', now()))
    RETURNING "PrayerId" AS id
  `, [name, category, request, anonymous, shareWithCommunity]);
  return result.rows[0]?.id;
}

export async function approvePostgresPrayer(pool, prayerId) {
  const result = await pool.query(`
    UPDATE "public"."PrayerRequests"
    SET "IsApproved" = true
    WHERE "PrayerId" = $1
    RETURNING "PrayerId" AS id
  `, [prayerId]);
  return result.rows.length > 0;
}

export async function getPostgresAdminPrayers(pool) {
  const result = await pool.query(`
    SELECT "PrayerId" AS "prayerId", "Name" AS name, "Category" AS category,
      "Request" AS request, "Anonymous" AS anonymous,
      "ShareWithCommunity" AS "shareWithCommunity", "IsApproved" AS "isApproved",
      "CreatedAt" AS "createdAt"
    FROM "public"."PrayerRequests"
    ORDER BY "CreatedAt" DESC
  `);
  return result.rows.map(row => ({
    id: row.prayerId,
    name: row.name,
    category: row.category,
    request: row.request,
    anonymous: Boolean(row.anonymous),
    shareWithCommunity: Boolean(row.shareWithCommunity),
    isApproved: Boolean(row.isApproved),
    createdAt: row.createdAt,
  }));
}

export async function deletePostgresPrayer(pool, prayerId) {
  await pool.query(`
    DELETE FROM "public"."PrayerRequests"
    WHERE "PrayerId" = $1
  `, [prayerId]);
}
