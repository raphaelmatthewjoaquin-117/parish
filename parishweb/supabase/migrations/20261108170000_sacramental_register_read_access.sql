-- Read-only restricted server access for sacramental register search.
BEGIN;

DO $sacramental_register_read_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply sacramental register access migrations with an owner/admin connection, not the runtime role.';
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
$sacramental_register_read_preflight$;

ALTER TABLE "public"."BaptismRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConfirmationRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MarriageRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DeathRecords" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SacramentalRecordAudit" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."BaptismRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_read"
  ON "public"."BaptismRecords"
  FOR SELECT TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."ConfirmationRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_read"
  ON "public"."ConfirmationRecords"
  FOR SELECT TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."MarriageRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_read"
  ON "public"."MarriageRecords"
  FOR SELECT TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."DeathRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_read"
  ON "public"."DeathRecords"
  FOR SELECT TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_audit_read"
  ON "public"."SacramentalRecordAudit";
CREATE POLICY "parish_app_runtime_sacramental_audit_read"
  ON "public"."SacramentalRecordAudit"
  FOR SELECT TO parish_app_runtime
  USING (true);

GRANT SELECT ON TABLE
  "public"."BaptismRecords",
  "public"."ConfirmationRecords",
  "public"."MarriageRecords",
  "public"."DeathRecords",
  "public"."SacramentalRecordAudit"
TO parish_app_runtime;

COMMIT;
