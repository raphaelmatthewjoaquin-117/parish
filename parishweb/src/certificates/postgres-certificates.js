async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'PostgreSQL transaction and rollback failed.');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getPostgresCertificateSlots(pool) {
  const result = await pool.query(`
    SELECT to_char("BlockDate", 'YYYY-MM-DD') AS date, "BlockTime" AS time
    FROM "public"."BlockedSlots"
    WHERE "BlockDate" >= (timezone('UTC', now()))::date
      AND "Scope" IN ('All', 'Certificate')
  `);
  return result.rows;
}

export async function findPostgresCertificateBlock(pool, date, time) {
  const result = await pool.query(`
    SELECT "Reason"
    FROM "public"."BlockedSlots"
    WHERE "BlockDate" = $1
      AND ("BlockTime" IS NULL OR "BlockTime" = $2)
      AND ("Scope" = 'All' OR "Scope" = 'Certificate')
    LIMIT 1
  `, [date, String(time).slice(0, 5)]);
  return result.rows[0] || null;
}

export async function createPostgresCertificateRequest(pool, {
  certificateType,
  preferredDate,
  preferredTime,
  notes,
  firstName,
  lastName,
  email,
  phone,
  referenceCode,
}) {
  const result = await pool.query(`
    INSERT INTO "public"."CertificateRequests"
      ("CertificateType", "PreferredDate", "PreferredTime", "Notes",
       "FirstName", "LastName", "ContactEmail", "ContactPhone", "ReferenceCode")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING "CertificateRequestId" AS "requestId"
  `, [
    certificateType,
    preferredDate,
    preferredTime,
    notes,
    firstName,
    lastName,
    email,
    phone,
    referenceCode,
  ]);
  return result.rows[0]?.requestId;
}

export async function getPostgresCertificateRequest(pool, email, referenceCode) {
  const result = await pool.query(`
    SELECT "CertificateRequestId" AS "requestId", "CertificateType" AS "certificateType",
      "PreferredDate" AS "preferredDate", "PreferredTime" AS "preferredTime",
      "Status" AS status, "Notes" AS notes
    FROM "public"."CertificateRequests"
    WHERE "ContactEmail" = $1 AND "ReferenceCode" = $2
    LIMIT 1
  `, [email, referenceCode]);
  return result.rows[0] || null;
}

export async function getPostgresCertificateRequestForUpload(pool, requestId, referenceCode) {
  const result = await pool.query(`
    SELECT "CertificateRequestId" AS "requestId"
    FROM "public"."CertificateRequests"
    WHERE "CertificateRequestId" = $1 AND "ReferenceCode" = $2
    LIMIT 1
  `, [requestId, referenceCode]);
  return result.rows[0] || null;
}

export async function savePostgresCertificateUploads(pool, requestId, files) {
  for (const file of files) {
    await pool.query(`
      INSERT INTO "public"."CertificateRequestDocuments"
        ("CertificateRequestId", "OriginalFileName", "StoredFileName", "FileUrl", "MimeType", "FileSizeBytes")
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [requestId, file.originalName, file.storedName, file.fileUrl, file.mimeType, file.size]);
  }
}

export async function listPostgresCertificateRequests(pool) {
  const result = await pool.query(`
    SELECT request."CertificateRequestId", request."CertificateType",
      request."FirstName", request."LastName", request."ContactEmail" AS "EmailAddress",
      request."ContactPhone", request."ReferenceCode", request."PreferredDate",
      request."PreferredTime", request."Status", request."Notes", request."CreatedAt",
      request."UpdatedAt", COUNT(document."CertificateRequestDocumentId") AS "DocumentCount"
    FROM "public"."CertificateRequests" AS request
    LEFT JOIN "public"."CertificateRequestDocuments" AS document
      ON document."CertificateRequestId" = request."CertificateRequestId"
    GROUP BY request."CertificateRequestId"
    ORDER BY request."CreatedAt" DESC, request."CertificateRequestId" DESC
  `);
  return result.rows.map(row => ({
    ...row,
    DocumentCount: Number(row.DocumentCount),
  }));
}

export async function listPostgresCertificateUploads(pool, requestId) {
  const result = await pool.query(`
    SELECT "CertificateRequestDocumentId", "OriginalFileName", "MimeType",
      "FileSizeBytes", "UploadedAt"
    FROM "public"."CertificateRequestDocuments"
    WHERE "CertificateRequestId" = $1
    ORDER BY "UploadedAt" DESC, "CertificateRequestDocumentId" DESC
  `, [requestId]);
  return result.rows;
}

export async function getPostgresCertificateDocument(pool, requestId, documentId) {
  const result = await pool.query(`
    SELECT "StoredFileName", "OriginalFileName", "MimeType"
    FROM "public"."CertificateRequestDocuments"
    WHERE "CertificateRequestId" = $1 AND "CertificateRequestDocumentId" = $2
    LIMIT 1
  `, [requestId, documentId]);
  return result.rows[0] || null;
}

export async function setPostgresCertificateRequestStatus(pool, requestId, status) {
  const result = await pool.query(`
    UPDATE "public"."CertificateRequests"
    SET "Status" = $1, "UpdatedAt" = timezone('UTC', now())
    WHERE "CertificateRequestId" = $2
    RETURNING "CertificateRequestId" AS "requestId"
  `, [status, requestId]);
  return result.rows.length > 0;
}

export function deletePostgresCertificateRequest(pool, requestId) {
  return withTransaction(pool, async client => {
    await client.query(`
      DELETE FROM "public"."CertificateRequestDocuments"
      WHERE "CertificateRequestId" = $1
    `, [requestId]);
    const result = await client.query(`
      DELETE FROM "public"."CertificateRequests"
      WHERE "CertificateRequestId" = $1
      RETURNING "CertificateRequestId" AS "requestId"
    `, [requestId]);
    return result.rows.length > 0;
  });
}
