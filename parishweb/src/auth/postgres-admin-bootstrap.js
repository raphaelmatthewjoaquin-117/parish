export function validateInitialAdminInput({ userName, email, password, confirmation, operator }) {
  const normalizedUserName = typeof userName === 'string' ? userName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedOperator = typeof operator === 'string' ? operator.trim() : '';

  if (!normalizedUserName || normalizedUserName.length > 256) {
    throw new Error('Enter a username of 1 to 256 characters.');
  }
  if (normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address of at most 255 characters.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('The password must be 12 to 128 characters.');
  }
  if (password !== confirmation) throw new Error('The passwords do not match.');
  if (!normalizedOperator || normalizedOperator.length > 256) {
    throw new Error('Enter a setup operator name of 1 to 256 characters.');
  }

  return {
    userName: normalizedUserName,
    email: normalizedEmail,
    password,
    operator: normalizedOperator,
  };
}

export async function createInitialPostgresAdmin(pool, {
  userName,
  email,
  password,
  operator,
  hashPassword,
}) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['parish:bootstrap-first-admin']);

    const userCount = await client.query(`
      SELECT COUNT(*)::int AS "userCount"
      FROM "public"."AspNetUsers"
    `);
    if (Number(userCount.rows[0]?.userCount) !== 0) {
      throw new Error('Bootstrap is only allowed when no staff accounts exist.');
    }

    const roleResult = await client.query(`
      SELECT "RoleId" AS "roleId"
      FROM "public"."AspNetRoles"
      WHERE "Name" = 'Admin'
      LIMIT 1
    `);
    const roleId = roleResult.rows[0]?.roleId;
    if (!roleId) {
      throw new Error('Admin role is missing; apply the PostgreSQL identity access migration first.');
    }

    const userResult = await client.query(`
      INSERT INTO "public"."AspNetUsers"
        ("UserName", "EmailAddress", "EmailConfirmed", "PasswordHash", "MustChangePassword")
      VALUES ($1, $2, true, $3, true)
      RETURNING "UserId" AS "userId"
    `, [userName, email, hashPassword(password)]);
    const userId = userResult.rows[0]?.userId;
    if (!userId) throw new Error('Initial Admin insert returned no user ID.');

    await client.query(`
      INSERT INTO "public"."AspNetUserRoles" ("UserId", "RoleId")
      VALUES ($1, $2)
    `, [userId, roleId]);
    await client.query(`
      INSERT INTO "public"."UserManagementAudit"
        ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "Details")
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'BootstrapAdmin',
      userId,
      userName,
      operator,
      JSON.stringify({ role: 'Admin', email }),
    ]);

    await client.query('COMMIT');
    transactionStarted = false;
    return { userId };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Admin bootstrap transaction and rollback failed.');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
