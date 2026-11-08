-- Apply manually with a Supabase owner/admin connection after reviewing the
-- migration. The application runtime role must never apply schema changes.
BEGIN;

DO $certificate_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply certificate access migrations with an owner/admin connection, not the runtime role.';
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
$certificate_access_preflight$;

ALTER TABLE "public"."BlockedSlots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CertificateRequests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CertificateRequestDocuments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_certificate_access" ON "public"."BlockedSlots";
CREATE POLICY "parish_app_runtime_certificate_access"
  ON "public"."BlockedSlots"
  FOR SELECT TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_certificate_access" ON "public"."CertificateRequests";
CREATE POLICY "parish_app_runtime_certificate_access"
  ON "public"."CertificateRequests"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_certificate_access" ON "public"."CertificateRequestDocuments";
CREATE POLICY "parish_app_runtime_certificate_access"
  ON "public"."CertificateRequestDocuments"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON TABLE "public"."BlockedSlots" TO parish_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."CertificateRequests" TO parish_app_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE "public"."CertificateRequestDocuments" TO parish_app_runtime;

DO $certificate_access_sequence_grants$
DECLARE
  sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."CertificateRequests"', 'CertificateRequestId'),
    pg_get_serial_sequence('"public"."CertificateRequestDocuments"', 'CertificateRequestDocumentId')
  ] LOOP
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
    END IF;
  END LOOP;
END
$certificate_access_sequence_grants$;

COMMIT;
