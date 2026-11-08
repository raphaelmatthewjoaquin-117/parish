-- Apply manually with a Supabase owner/admin connection after reviewing the
-- migration. The application runtime role must never apply schema changes.
BEGIN;

DO $identity_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply identity access migrations with an owner/admin connection, not the runtime role.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'parish_app_runtime'
      AND NOT rolsuper
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'The restricted parish_app_runtime role must exist before applying this migration.';
  END IF;

  IF EXISTS (
    SELECT lower("EmailAddress")
    FROM "public"."AspNetUsers"
    GROUP BY lower("EmailAddress")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate case-insensitive staff email addresses must be resolved before applying this migration.';
  END IF;

  IF EXISTS (
    SELECT lower("Name")
    FROM "public"."AspNetRoles"
    GROUP BY lower("Name")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate case-insensitive staff role names must be resolved before applying this migration.';
  END IF;
END
$identity_access_preflight$;

ALTER TABLE "public"."AspNetUsers"
  DROP CONSTRAINT IF EXISTS "UQ_AspNetUsers_Email";

CREATE UNIQUE INDEX IF NOT EXISTS "UX_AspNetUsers_EmailAddress_CaseInsensitive"
  ON "public"."AspNetUsers" (lower("EmailAddress"));

CREATE UNIQUE INDEX IF NOT EXISTS "UX_AspNetRoles_Name_CaseInsensitive"
  ON "public"."AspNetRoles" (lower("Name"));

UPDATE "public"."AspNetRoles" AS existing
SET "Name" = supported."Name",
    "NormalizedName" = supported."NormalizedName"
FROM (
  VALUES
    ('Admin', 'ADMIN'),
    ('ParishPriest', 'PARISHPRIEST'),
    ('Secretary', 'SECRETARY'),
    ('Bookkeeper', 'BOOKKEEPER'),
    ('Staff', 'STAFF')
) AS supported("Name", "NormalizedName")
WHERE lower(existing."Name") = lower(supported."Name")
  AND (
    existing."Name" <> supported."Name"
    OR existing."NormalizedName" IS DISTINCT FROM supported."NormalizedName"
  );

INSERT INTO "public"."AspNetRoles" ("Name", "NormalizedName")
SELECT supported."Name", supported."NormalizedName"
FROM (
  VALUES
    ('Admin', 'ADMIN'),
    ('ParishPriest', 'PARISHPRIEST'),
    ('Secretary', 'SECRETARY'),
    ('Bookkeeper', 'BOOKKEEPER'),
    ('Staff', 'STAFF')
) AS supported("Name", "NormalizedName")
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."AspNetRoles" AS existing
  WHERE lower(existing."Name") = lower(supported."Name")
);

ALTER TABLE "public"."AspNetRoles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AspNetUserRoles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AspNetUsers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PasswordResetTokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserManagementAudit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."UserModulePermissions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."AspNetRoles";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."AspNetRoles"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."AspNetUserRoles";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."AspNetUserRoles"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."AspNetUsers";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."AspNetUsers"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."PasswordResetTokens";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."PasswordResetTokens"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."UserManagementAudit";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."UserManagementAudit"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_identity_access" ON "public"."UserModulePermissions";
CREATE POLICY "parish_app_runtime_identity_access"
  ON "public"."UserModulePermissions"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO parish_app_runtime;
GRANT SELECT ON TABLE "public"."AspNetRoles" TO parish_app_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "public"."AspNetUserRoles" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."AspNetUsers" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."PasswordResetTokens" TO parish_app_runtime;
GRANT SELECT, INSERT ON TABLE "public"."UserManagementAudit" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."UserModulePermissions" TO parish_app_runtime;

DO $identity_access_sequence_grants$
DECLARE
  sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."AspNetUsers"', 'UserId'),
    pg_get_serial_sequence('"public"."PasswordResetTokens"', 'PasswordResetTokenId'),
    pg_get_serial_sequence('"public"."UserManagementAudit"', 'AuditId')
  ] LOOP
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
    END IF;
  END LOOP;
END
$identity_access_sequence_grants$;

COMMIT;
