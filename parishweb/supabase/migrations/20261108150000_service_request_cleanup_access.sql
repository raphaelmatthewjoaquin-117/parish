-- Additional least-privilege access required by the PostgreSQL service-request cleanup job.
BEGIN;

DO $service_request_cleanup_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply service cleanup access migrations with an owner/admin connection, not the runtime role.';
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
$service_request_cleanup_access_preflight$;

GRANT SELECT ("AttendanceStatus")
  ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT UPDATE ("AttendanceStatus", "AttendanceMarkedAt")
  ON TABLE "public"."ServiceRequest" TO parish_app_runtime;

COMMIT;
