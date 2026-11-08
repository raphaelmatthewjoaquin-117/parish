-- Run manually with a Supabase owner/admin connection. This creates no
-- application-table grants and does not set or expose a password.
DO $create_runtime_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'parish_app_runtime'
  ) THEN
    CREATE ROLE parish_app_runtime
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$create_runtime_role$;

SELECT
  r.rolname,
  r.rolcanlogin AS can_login,
  r.rolsuper AS is_superuser,
  r.rolbypassrls AS bypasses_rls,
  r.rolinherit AS inherits_roles,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relowner = r.oid
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%'
  ) AS owns_application_objects,
  EXISTS (
    SELECT 1
    FROM pg_database d
    WHERE d.datname = current_database()
      AND d.datdba = r.oid
  ) AS owns_current_database,
  EXISTS (
    SELECT 1
    FROM pg_auth_members m
    WHERE m.member = r.oid
  ) AS has_role_memberships
FROM pg_roles r
WHERE r.rolname = 'parish_app_runtime';
