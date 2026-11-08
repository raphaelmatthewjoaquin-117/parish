const supportedStaffRoles = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];

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

export async function findPostgresStaffForPasswordReset(pool, email) {
  const result = await pool.query(`
    SELECT u."UserId" AS "userId",
      u."EmailAddress" AS email,
      u."UserName" AS "userName"
    FROM "public"."AspNetUsers" AS u
    WHERE lower(u."EmailAddress") = lower($1)
      AND EXISTS (
        SELECT 1
        FROM "public"."AspNetUserRoles" AS ur
        INNER JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
        WHERE ur."UserId" = u."UserId"
          AND r."Name" = ANY($2)
      )
    ORDER BY u."UserId"
    LIMIT 1
  `, [email, supportedStaffRoles]);

  return result.rows[0] || null;
}

export function createPostgresPasswordReset(pool, userId, tokenHash) {
  return withTransaction(pool, async client => {
    await client.query(`
      UPDATE "public"."PasswordResetTokens"
      SET "UsedAt" = timezone('UTC', now())
      WHERE "UserId" = $1 AND "UsedAt" IS NULL
    `, [userId]);
    await client.query(`
      INSERT INTO "public"."PasswordResetTokens" ("UserId", "TokenHash", "ExpiresAt")
      VALUES ($1, $2, timezone('UTC', now()) + INTERVAL '30 minutes')
    `, [userId, tokenHash]);
  });
}

export async function invalidatePostgresPasswordReset(pool, tokenHash) {
  await pool.query(`
    UPDATE "public"."PasswordResetTokens"
    SET "UsedAt" = timezone('UTC', now())
    WHERE "TokenHash" = $1 AND "UsedAt" IS NULL
  `, [tokenHash]);
}

export function resetPostgresStaffPassword(pool, tokenHash, passwordHash) {
  return withTransaction(pool, async client => {
    const tokenResult = await client.query(`
      UPDATE "public"."PasswordResetTokens" AS resetToken
      SET "UsedAt" = timezone('UTC', now())
      WHERE resetToken."TokenHash" = $1
        AND resetToken."UsedAt" IS NULL
        AND resetToken."ExpiresAt" > timezone('UTC', now())
        AND EXISTS (
          SELECT 1
          FROM "public"."AspNetUserRoles" AS ur
          INNER JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
          WHERE ur."UserId" = resetToken."UserId"
            AND r."Name" = ANY($2)
        )
      RETURNING resetToken."UserId" AS "userId"
    `, [tokenHash, supportedStaffRoles]);
    const userId = tokenResult.rows[0]?.userId;
    if (!userId) return false;

    const updateResult = await client.query(`
      UPDATE "public"."AspNetUsers"
      SET "PasswordHash" = $1, "MustChangePassword" = false
      WHERE "UserId" = $2
      RETURNING "UserId" AS "userId"
    `, [passwordHash, userId]);
    if (!updateResult.rows.length) {
      throw new Error('Staff account disappeared during password reset.');
    }

    await client.query(`
      UPDATE "public"."PasswordResetTokens"
      SET "UsedAt" = timezone('UTC', now())
      WHERE "UserId" = $1 AND "UsedAt" IS NULL
    `, [userId]);
    return true;
  });
}
