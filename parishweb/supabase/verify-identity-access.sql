-- Run immediately after the identity migration, before later modules add
-- grants to other public tables. Connect with the restricted runtime URL.
DO $verify_identity_access$
DECLARE
  identity_tables text[] := ARRAY[
    'AspNetRoles',
    'AspNetUserRoles',
    'AspNetUsers',
    'PasswordResetTokens',
    'UserManagementAudit',
    'UserModulePermissions'
  ];
  v_table_name text;
  has_row_security boolean;
BEGIN
  IF current_user <> 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Connect as parish_app_runtime to verify identity access.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'The identity runtime role must not be a superuser or bypass RLS.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_auth_members
    WHERE member = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    RAISE EXCEPTION 'The identity runtime role must not inherit role memberships.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
  ) THEN
    RAISE EXCEPTION 'The identity runtime role must not own application objects.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = current_database()
      AND datdba = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    RAISE EXCEPTION 'The identity runtime role must not own the current database.';
  END IF;

  IF NOT has_schema_privilege(current_user, 'public', 'USAGE') THEN
    RAISE EXCEPTION 'The identity runtime role is missing public schema usage.';
  END IF;

  FOREACH v_table_name IN ARRAY identity_tables LOOP
    IF to_regclass(format('%I.%I', 'public', v_table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required identity table public.% is missing.', v_table_name;
    END IF;

    SELECT c.relrowsecurity
    INTO has_row_security
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table_name;

    IF NOT has_row_security THEN
      RAISE EXCEPTION 'RLS is not enabled for public.%.', v_table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table_name
        AND cmd = 'ALL'
        AND roles @> ARRAY['parish_app_runtime'::name]
        AND qual = 'true'
        AND with_check = 'true'
    ) THEN
      RAISE EXCEPTION 'The restricted runtime RLS policy is missing for public.%.', v_table_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege(current_user, '"public"."AspNetRoles"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUserRoles"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUserRoles"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUserRoles"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUsers"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUsers"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUsers"', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."AspNetUsers"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."PasswordResetTokens"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."PasswordResetTokens"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."PasswordResetTokens"', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."UserManagementAudit"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."UserManagementAudit"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."UserModulePermissions"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."UserModulePermissions"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."UserModulePermissions"', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."UserModulePermissions"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The restricted runtime role is missing a required identity-table privilege.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND NOT (c.relname = ANY(identity_tables))
      AND (
        has_table_privilege(current_user, c.oid, 'SELECT')
        OR has_table_privilege(current_user, c.oid, 'INSERT')
        OR has_table_privilege(current_user, c.oid, 'UPDATE')
        OR has_table_privilege(current_user, c.oid, 'DELETE')
        OR has_table_privilege(current_user, c.oid, 'TRUNCATE')
        OR has_table_privilege(current_user, c.oid, 'REFERENCES')
        OR has_table_privilege(current_user, c.oid, 'TRIGGER')
      )
  ) THEN
    RAISE EXCEPTION 'The restricted runtime role has effective access to non-identity public tables.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants AS g
    WHERE g.grantee = current_user
      AND g.table_schema = 'public'
      AND (
        (g.table_name = 'AspNetRoles' AND g.privilege_type <> 'SELECT')
        OR (
          g.table_name = 'AspNetUserRoles'
          AND g.privilege_type NOT IN ('SELECT', 'INSERT', 'DELETE')
        )
        OR (
          g.table_name = 'AspNetUsers'
          AND g.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        )
        OR (
          g.table_name = 'PasswordResetTokens'
          AND g.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE')
        )
        OR (
          g.table_name = 'UserManagementAudit'
          AND g.privilege_type NOT IN ('SELECT', 'INSERT')
        )
        OR (
          g.table_name = 'UserModulePermissions'
          AND g.privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        )
      )
  ) THEN
    RAISE EXCEPTION 'The restricted runtime role has excessive identity-table privileges.';
  END IF;

  IF COALESCE(
    has_sequence_privilege(
      current_user,
      pg_get_serial_sequence('"public"."AspNetUsers"', 'UserId'),
      'USAGE'
    ),
    false
  ) = false OR COALESCE(
    has_sequence_privilege(
      current_user,
      pg_get_serial_sequence('"public"."PasswordResetTokens"', 'PasswordResetTokenId'),
      'USAGE'
    ),
    false
  ) = false OR COALESCE(
    has_sequence_privilege(
      current_user,
      pg_get_serial_sequence('"public"."UserManagementAudit"', 'AuditId'),
      'USAGE'
    ),
    false
  ) = false
  THEN
    RAISE EXCEPTION 'The restricted runtime role is missing a required identity sequence privilege.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'AspNetUsers'
      AND c.column_name = 'EmailAddress'
      AND c.character_maximum_length = 255
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'UserManagementAudit'
      AND c.column_name = 'ChangedBy'
      AND c.character_maximum_length = 256
  ) THEN
    RAISE EXCEPTION 'Identity column lengths do not match the SQL Server baseline.';
  END IF;

  IF to_regclass('public."UX_AspNetUsers_EmailAddress_CaseInsensitive"') IS NULL
    OR to_regclass('public."UX_AspNetRoles_Name_CaseInsensitive"') IS NULL
  THEN
    RAISE EXCEPTION 'Identity case-insensitive uniqueness indexes are missing.';
  END IF;
END
$verify_identity_access$;
