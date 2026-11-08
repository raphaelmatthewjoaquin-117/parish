-- Server-only access for public event reads and authorized event management.
BEGIN;

DO $events_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply event access migrations with an owner/admin connection, not the runtime role.';
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
$events_access_preflight$;

ALTER TABLE "public"."Events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_events_access" ON "public"."Events";
CREATE POLICY "parish_app_runtime_events_access"
  ON "public"."Events"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT SELECT (
  "EventId", "Title", "TitleTl", "Description", "DescriptionTl",
  "Body", "BodyTl", "EventDate", "EventTime", "Location",
  "LocationTl", "PhotoUrl"
) ON TABLE "public"."Events" TO parish_app_runtime;
GRANT INSERT (
  "Title", "TitleTl", "Description", "DescriptionTl",
  "Body", "BodyTl", "EventDate", "EventTime", "Location",
  "LocationTl", "PhotoUrl"
) ON TABLE "public"."Events" TO parish_app_runtime;
GRANT UPDATE (
  "Title", "TitleTl", "Description", "DescriptionTl",
  "Body", "BodyTl", "EventDate", "EventTime", "Location",
  "LocationTl", "PhotoUrl"
) ON TABLE "public"."Events" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."Events" TO parish_app_runtime;

DO $events_sequence_grant$
DECLARE
  sequence_name text;
BEGIN
  sequence_name := pg_get_serial_sequence('"public"."Events"', 'EventId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
END
$events_sequence_grant$;

COMMIT;
