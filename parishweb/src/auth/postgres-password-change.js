export async function changePostgresStaffPassword(pool, userId, currentPassword, newPassword, {
  verifyPassword,
  hashPassword,
}) {
  const accountResult = await pool.query(`
    SELECT "UserName" AS username, "PasswordHash" AS password_hash
    FROM "public"."AspNetUsers"
    WHERE "UserId" = $1
  `, [userId]);
  const account = accountResult.rows[0];
  if (!account || !verifyPassword(currentPassword, account.password_hash)) {
    return { changed: false, auditError: null };
  }

  const updateResult = await pool.query(`
    UPDATE "public"."AspNetUsers"
    SET "PasswordHash" = $1, "MustChangePassword" = false
    WHERE "UserId" = $2
    RETURNING "UserId" AS "userId"
  `, [hashPassword(newPassword), userId]);
  if (!updateResult.rows.length) {
    throw new Error('Staff account disappeared during password change.');
  }

  let auditError = null;
  try {
    await pool.query(`
      INSERT INTO "public"."UserManagementAudit"
        ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "ChangedAt", "Details")
      VALUES ($1, $2, $3, $4, timezone('UTC', now()), NULL)
    `, ['ChangeOwnPassword', userId, account.username, account.username]);
  } catch (error) {
    auditError = error;
  }

  return { changed: true, auditError };
}
