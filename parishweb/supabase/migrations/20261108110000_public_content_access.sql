-- Apply manually with a Supabase owner/admin connection after reviewing the
-- migration. The application runtime role must never apply schema changes.
BEGIN;

DO $public_content_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply public content migrations with an owner/admin connection, not the runtime role.';
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
END
$public_content_preflight$;

ALTER TABLE "public"."SiteContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContactMessages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PrayerRequests" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_content_access" ON "public"."SiteContent";
CREATE POLICY "parish_app_runtime_content_access"
  ON "public"."SiteContent"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_content_access" ON "public"."ContactMessages";
CREATE POLICY "parish_app_runtime_content_access"
  ON "public"."ContactMessages"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_content_access" ON "public"."PrayerRequests";
CREATE POLICY "parish_app_runtime_content_access"
  ON "public"."PrayerRequests"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE "public"."SiteContent" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."ContactMessages" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."PrayerRequests" TO parish_app_runtime;

DO $public_content_sequence_grants$
DECLARE
  sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."ContactMessages"', 'ContactMessageId'),
    pg_get_serial_sequence('"public"."PrayerRequests"', 'PrayerId')
  ] LOOP
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
    END IF;
  END LOOP;
END
$public_content_sequence_grants$;

COMMIT;
