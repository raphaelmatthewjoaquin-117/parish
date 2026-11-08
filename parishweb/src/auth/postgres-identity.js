const staffRolePriority = ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper', 'Staff'];

export async function findStaffForLogin(pool, login) {
  const result = await pool.query(`
    WITH matched_user AS (
      SELECT u."UserId", u."EmailAddress", u."UserName", u."PasswordHash",
        u."MustChangePassword"
      FROM "public"."AspNetUsers" AS u
      WHERE lower(u."EmailAddress") = lower($1)
        OR lower(u."UserName") = lower($1)
      ORDER BY CASE WHEN lower(u."EmailAddress") = lower($1) THEN 0 ELSE 1 END,
        u."UserId"
      LIMIT 1
    )
    SELECT u."UserId" AS "userId",
      u."EmailAddress" AS "email",
      u."UserName" AS "userName",
      u."PasswordHash" AS "passwordHash",
      u."MustChangePassword" AS "mustChangePassword",
      COALESCE(
        array_agg(DISTINCT r."Name") FILTER (WHERE r."Name" IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS "roles"
    FROM matched_user AS u
    LEFT JOIN "public"."AspNetUserRoles" AS ur ON ur."UserId" = u."UserId"
    LEFT JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
    GROUP BY u."UserId", u."EmailAddress", u."UserName",
      u."PasswordHash", u."MustChangePassword"
  `, [login]);

  return result.rows[0] || null;
}

export async function getStaffAuthorizationState(pool, userId) {
  const result = await pool.query(`
    SELECT u."UserId" AS "userId",
      u."UserName" AS "userName",
      u."EmailAddress" AS "email",
      u."MustChangePassword" AS "mustChangePassword",
      r."Name" AS "roleName",
      p."ModuleName" AS "moduleName",
      p."CanView" AS "canView",
      p."CanEdit" AS "canEdit"
    FROM "public"."AspNetUsers" AS u
    LEFT JOIN "public"."AspNetUserRoles" AS ur ON ur."UserId" = u."UserId"
    LEFT JOIN "public"."AspNetRoles" AS r ON r."RoleId" = ur."RoleId"
    LEFT JOIN "public"."UserModulePermissions" AS p ON p."UserId" = u."UserId"
    WHERE u."UserId" = $1
  `, [userId]);

  const rows = result.rows;
  if (!rows.length) return null;

  const roles = new Set(rows.map(row => row.roleName).filter(Boolean));
  const role = staffRolePriority.find(name => roles.has(name));
  if (!role) return null;

  const overrides = {};
  for (const row of rows) {
    if (row.moduleName) {
      overrides[row.moduleName] = {
        view: Boolean(row.canView),
        edit: Boolean(row.canEdit),
      };
    }
  }

  const [staff] = rows;
  return {
    userId: staff.userId,
    userName: staff.userName,
    email: staff.email,
    role,
    mustChangePassword: Boolean(staff.mustChangePassword),
    overrides,
  };
}
