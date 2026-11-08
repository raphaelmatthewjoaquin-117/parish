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

export async function updatePostgresStaffProfile(pool, userId, userName, email) {
  const duplicate = await pool.query(`
    SELECT 1
    FROM "public"."AspNetUsers"
    WHERE lower("EmailAddress") = lower($1) AND "UserId" <> $2
    LIMIT 1
  `, [email, userId]);
  if (duplicate.rows.length) return { updated: false, duplicate: true };

  try {
    const result = await pool.query(`
      UPDATE "public"."AspNetUsers"
      SET "UserName" = $1, "EmailAddress" = $2
      WHERE "UserId" = $3
      RETURNING "UserName" AS "userName", "EmailAddress" AS email
    `, [userName, email, userId]);
    return { updated: result.rows.length > 0, duplicate: false };
  } catch (error) {
    if (error?.code === '23505') return { updated: false, duplicate: true };
    throw error;
  }
}

export async function getPostgresUserPermissions(pool, userId) {
  const result = await pool.query(`
    SELECT "ModuleName" AS "moduleName", "CanView" AS "canView", "CanEdit" AS "canEdit"
    FROM "public"."UserModulePermissions"
    WHERE "UserId" = $1
  `, [userId]);

  return Object.fromEntries(result.rows.map(row => [row.moduleName, {
    view: Boolean(row.canView),
    edit: Boolean(row.canEdit),
  }]));
}

export async function getPostgresStaffUsers(pool, includeDetails) {
  const result = await pool.query(`
    SELECT u."UserId" AS "userId",
      u."UserName" AS "userName",
      CASE WHEN $1 THEN u."EmailAddress" ELSE NULL END AS email,
      u."EmailConfirmed" AS "emailConfirmed",
      COALESCE(
        array_agg(DISTINCT r."Name") FILTER (WHERE r."Name" IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS roles
    FROM "public"."AspNetUsers" AS u
    LEFT JOIN "public"."AspNetUserRoles" AS ur ON ur."UserId" = u."UserId"
    LEFT JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
    GROUP BY u."UserId", u."UserName", u."EmailAddress", u."EmailConfirmed"
    ORDER BY u."UserName"
  `, [includeDetails]);

  return result.rows.map(user => ({
    userId: user.userId,
    userName: user.userName,
    email: user.email,
    emailConfirmed: Boolean(user.emailConfirmed),
    lockoutEnabled: false,
    accessFailedCount: 0,
    roles: user.roles.length ? user.roles : ['Staff'],
  }));
}

export async function listPostgresUserManagementAudit(pool, limit) {
  const result = await pool.query(`
    SELECT "AuditId", "ActionName", "TargetUserId", "TargetUserName",
      "ChangedBy", "ChangedAt", "Details"
    FROM "public"."UserManagementAudit"
    ORDER BY "ChangedAt" DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

export async function createPostgresStaffUser(pool, {
  userName,
  email,
  role,
  password,
  changedBy,
  hashPassword,
}) {
  try {
    return await withTransaction(pool, async client => {
      const duplicate = await client.query(`
        SELECT 1
        FROM "public"."AspNetUsers"
        WHERE lower("EmailAddress") = lower($1)
        LIMIT 1
      `, [email]);
      if (duplicate.rows.length) return { duplicate: true };

      const roleResult = await client.query(`
        SELECT "RoleId" AS "roleId"
        FROM "public"."AspNetRoles"
        WHERE "Name" = $1
        LIMIT 1
      `, [role]);
      const roleId = roleResult.rows[0]?.roleId;
      if (!roleId) return { roleMissing: true };

      const userResult = await client.query(`
        INSERT INTO "public"."AspNetUsers"
          ("UserName", "EmailAddress", "EmailConfirmed", "PasswordHash", "MustChangePassword")
        VALUES ($1, $2, true, $3, true)
        RETURNING "UserId" AS "userId"
      `, [userName, email, hashPassword(password)]);
      const userId = userResult.rows[0]?.userId;
      if (!userId) throw new Error('Staff account insert returned no user ID.');

      await client.query(`
        INSERT INTO "public"."AspNetUserRoles" ("UserId", "RoleId")
        VALUES ($1, $2)
      `, [userId, roleId]);
      await client.query(`
        INSERT INTO "public"."UserManagementAudit"
          ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "Details")
        VALUES ($1, $2, $3, $4, $5)
      `, ['CreateUser', userId, userName, changedBy, JSON.stringify({ role, email })]);
      return { userId };
    });
  } catch (error) {
    if (error?.code === '23505') return { duplicate: true };
    throw error;
  }
}

export async function updatePostgresStaffUser(pool, {
  userId,
  email,
  hasEmail,
  password,
  resetToDefault,
  requestedRoles,
  changedBy,
  hashPassword,
  allowAdminTarget,
}) {
  try {
    return await withTransaction(pool, async client => {
      const roleNames = requestedRoles ? [...new Set(requestedRoles)] : null;
      let roleIds = [];
      if (roleNames) {
        const roleResult = await client.query(`
          SELECT "RoleId" AS "roleId", "Name" AS name
          FROM "public"."AspNetRoles"
          WHERE "Name" = ANY($1)
        `, [roleNames]);
        if (roleResult.rows.length !== roleNames.length) {
          const configuredRoles = new Set(roleResult.rows.map(row => row.name));
          return { roleMissing: true, role: roleNames.find(name => !configuredRoles.has(name)) };
        }
        roleIds = roleResult.rows.map(row => row.roleId);
      }

      const targetResult = await client.query(`
        SELECT u."UserName" AS "userName",
          u."EmailAddress" AS email,
          EXISTS (
            SELECT 1
            FROM "public"."AspNetUserRoles" AS ur
            INNER JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
            WHERE ur."UserId" = u."UserId" AND r."Name" = 'Admin'
          ) AS "isAdmin"
        FROM "public"."AspNetUsers" AS u
        WHERE u."UserId" = $1
        FOR UPDATE
      `, [userId]);
      const target = targetResult.rows[0];
      if (!target) return { missing: true };
      if (target.isAdmin && !allowAdminTarget) return { targetIsAdmin: true };

      if (hasEmail) {
        const duplicate = await client.query(`
          SELECT 1
          FROM "public"."AspNetUsers"
          WHERE lower("EmailAddress") = lower($1) AND "UserId" <> $2
          LIMIT 1
        `, [email, userId]);
        if (duplicate.rows.length) return { duplicate: true };
        await client.query(`
          UPDATE "public"."AspNetUsers"
          SET "EmailAddress" = $1
          WHERE "UserId" = $2
        `, [email, userId]);
      }

      const hasPassword = typeof password === 'string' && password.length > 0;
      if (hasPassword) {
        await client.query(`
          UPDATE "public"."AspNetUsers"
          SET "PasswordHash" = $1, "MustChangePassword" = true
          WHERE "UserId" = $2
        `, [hashPassword(password), userId]);
      }
      if (roleNames) {
        await client.query(`
          DELETE FROM "public"."AspNetUserRoles"
          WHERE "UserId" = $1
        `, [userId]);
        for (const roleId of roleIds) {
          await client.query(`
            INSERT INTO "public"."AspNetUserRoles" ("UserId", "RoleId")
            VALUES ($1, $2)
          `, [userId, roleId]);
        }
      }

      const details = {};
      if (hasEmail) details.email = email;
      if (hasPassword) details.passwordChanged = true;
      if (resetToDefault) details.passwordResetToDefault = true;
      if (roleNames) details.roles = roleNames;
      await client.query(`
        INSERT INTO "public"."UserManagementAudit"
          ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "Details")
        VALUES ($1, $2, $3, $4, $5)
      `, ['UpdateUser', userId, target.userName, changedBy, JSON.stringify(details)]);
      return { updated: true };
    });
  } catch (error) {
    if (error?.code === '23505') return { duplicate: true };
    throw error;
  }
}

export function deletePostgresStaffUser(pool, userId, changedBy) {
  return withTransaction(pool, async client => {
    const targetResult = await client.query(`
      SELECT "UserName" AS "userName", "EmailAddress" AS email
      FROM "public"."AspNetUsers"
      WHERE "UserId" = $1
      FOR UPDATE
    `, [userId]);
    const target = targetResult.rows[0];
    if (!target) return false;

    await client.query(`
      DELETE FROM "public"."AspNetUserRoles"
      WHERE "UserId" = $1
    `, [userId]);
    await client.query(`
      DELETE FROM "public"."AspNetUsers"
      WHERE "UserId" = $1
    `, [userId]);
    await client.query(`
      INSERT INTO "public"."UserManagementAudit"
        ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "Details")
      VALUES ($1, $2, $3, $4, $5)
    `, ['DeleteUser', userId, target.userName, changedBy, JSON.stringify({ email: target.email })]);
    return true;
  });
}

export function updatePostgresUserPermissions(pool, userId, overrides, changedBy) {
  return withTransaction(pool, async client => {
    const target = await client.query(`
      SELECT "UserName" AS "userName"
      FROM "public"."AspNetUsers"
      WHERE "UserId" = $1
      FOR UPDATE
    `, [userId]);
    const userName = target.rows[0]?.userName;
    if (!userName) return false;

    await client.query(`
      DELETE FROM "public"."UserModulePermissions"
      WHERE "UserId" = $1
    `, [userId]);

    for (const [moduleName, permission] of Object.entries(overrides)) {
      await client.query(`
        INSERT INTO "public"."UserModulePermissions"
          ("UserId", "ModuleName", "CanView", "CanEdit", "UpdatedAt", "UpdatedBy")
        VALUES ($1, $2, $3, $4, timezone('UTC', now()), $5)
      `, [userId, moduleName, permission.view || permission.edit, permission.edit, changedBy]);
    }

    await client.query(`
      INSERT INTO "public"."UserManagementAudit"
        ("ActionName", "TargetUserId", "TargetUserName", "ChangedBy", "ChangedAt", "Details")
      VALUES ($1, $2, $3, $4, timezone('UTC', now()), $5)
    `, ['UpdatePermissions', userId, userName, changedBy, JSON.stringify(overrides)]);
    return true;
  });
}
