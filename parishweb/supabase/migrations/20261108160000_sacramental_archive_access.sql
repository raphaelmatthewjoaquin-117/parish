-- Restricted server-only access for sacramental archive metadata.
BEGIN;

DO $sacramental_archive_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply sacramental archive access migrations with an owner/admin connection, not the runtime role.';
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
$sacramental_archive_access_preflight$;

ALTER TABLE "public"."SacramentalArchives" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_archive_access"
  ON "public"."SacramentalArchives";
CREATE POLICY "parish_app_runtime_sacramental_archive_access"
  ON "public"."SacramentalArchives"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT SELECT, DELETE ON TABLE "public"."SacramentalArchives" TO parish_app_runtime;
GRANT INSERT (
  "SacramentType", "BookNumber", "PageNumber", "FileUrl", "Notes",
  "RegistryNumber", "UploadedBy"
) ON TABLE "public"."SacramentalArchives" TO parish_app_runtime;
GRANT UPDATE ("BookNumber", "PageNumber", "RegistryNumber", "Notes")
  ON TABLE "public"."SacramentalArchives" TO parish_app_runtime;

DO $sacramental_archive_sequence$
DECLARE
  sequence_name text;
BEGIN
  sequence_name := pg_get_serial_sequence('"public"."SacramentalArchives"', 'ArchiveId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
END
$sacramental_archive_sequence$;

COMMIT;
