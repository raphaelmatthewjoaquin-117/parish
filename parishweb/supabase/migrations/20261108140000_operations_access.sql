-- Server-only access for administrative Mass schedules, intentions, and finance entries.
BEGIN;

DO $operations_schedule_access_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply operations access migrations with an owner/admin connection, not the runtime role.';
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
$operations_schedule_access_preflight$;

ALTER TABLE "public"."MassSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MassIntentions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FinancialEntries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FinanceReportSnapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FinancialEntryAudit" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_operations_schedule_access" ON "public"."MassSchedule";
CREATE POLICY "parish_app_runtime_operations_schedule_access"
  ON "public"."MassSchedule"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_operations_intentions_access" ON "public"."MassIntentions";
CREATE POLICY "parish_app_runtime_operations_intentions_access"
  ON "public"."MassIntentions"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_operations_finance_access" ON "public"."FinancialEntries";
CREATE POLICY "parish_app_runtime_operations_finance_access"
  ON "public"."FinancialEntries"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_finance_reports_read" ON "public"."FinanceReportSnapshots";
CREATE POLICY "parish_app_runtime_finance_reports_read"
  ON "public"."FinanceReportSnapshots"
  FOR SELECT
  TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_finance_reports_write" ON "public"."FinanceReportSnapshots";
CREATE POLICY "parish_app_runtime_finance_reports_write"
  ON "public"."FinanceReportSnapshots"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_finance_audit_read" ON "public"."FinancialEntryAudit";
CREATE POLICY "parish_app_runtime_finance_audit_read"
  ON "public"."FinancialEntryAudit"
  FOR SELECT
  TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_finance_audit_insert" ON "public"."FinancialEntryAudit";
CREATE POLICY "parish_app_runtime_finance_audit_insert"
  ON "public"."FinancialEntryAudit"
  FOR INSERT
  TO parish_app_runtime
  WITH CHECK (true);

GRANT SELECT ON TABLE "public"."MassSchedule" TO parish_app_runtime;
GRANT INSERT ("Title", "MassDate", "MassTime", "Location", "PriestUsername", "Notes", "Status")
  ON TABLE "public"."MassSchedule" TO parish_app_runtime;
GRANT UPDATE ("Title", "MassDate", "MassTime", "Location", "PriestUsername", "Notes", "Status", "UpdatedAt")
  ON TABLE "public"."MassSchedule" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."MassSchedule" TO parish_app_runtime;

GRANT SELECT ON TABLE "public"."MassIntentions" TO parish_app_runtime;
GRANT INSERT ("IntentionDate", "IntentionTime", "Offering", "RequestedBy", "IntentionText", "CreatedBy")
  ON TABLE "public"."MassIntentions" TO parish_app_runtime;
GRANT UPDATE ("Status", "UpdatedAt") ON TABLE "public"."MassIntentions" TO parish_app_runtime;

GRANT SELECT ON TABLE "public"."FinancialEntries" TO parish_app_runtime;
GRANT INSERT ("EntryDate", "EntryType", "Description", "Amount", "EnteredBy")
  ON TABLE "public"."FinancialEntries" TO parish_app_runtime;
GRANT UPDATE (
  "EntryDate", "EntryType", "Description", "Amount", "Status", "UpdatedAt",
  "ApprovedBy", "ApprovedAt", "ReconciledBy", "ReconciledAt"
)
  ON TABLE "public"."FinancialEntries" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."FinancialEntries" TO parish_app_runtime;

GRANT SELECT ON TABLE "public"."FinanceReportSnapshots" TO parish_app_runtime;
GRANT INSERT (
  "ReportType", "PeriodStart", "PeriodEnd", "TotalIncome", "TotalExpenses",
  "NetTotal", "Details", "GeneratedBy"
) ON TABLE "public"."FinanceReportSnapshots" TO parish_app_runtime;
GRANT UPDATE (
  "TotalIncome", "TotalExpenses", "NetTotal", "Details", "GeneratedAt", "GeneratedBy"
) ON TABLE "public"."FinanceReportSnapshots" TO parish_app_runtime;
GRANT SELECT ON TABLE "public"."FinancialEntryAudit" TO parish_app_runtime;
GRANT INSERT ("FinancialEntryId", "ActionName", "ChangedBy")
  ON TABLE "public"."FinancialEntryAudit" TO parish_app_runtime;

DO $operations_schedule_sequence$
DECLARE
  sequence_name text;
BEGIN
  sequence_name := pg_get_serial_sequence('"public"."MassSchedule"', 'MassScheduleId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
  sequence_name := pg_get_serial_sequence('"public"."FinancialEntries"', 'FinancialEntryId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
  sequence_name := pg_get_serial_sequence('"public"."MassIntentions"', 'MassIntentionId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
  sequence_name := pg_get_serial_sequence('"public"."FinancialEntryAudit"', 'AuditId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
  sequence_name := pg_get_serial_sequence('"public"."FinanceReportSnapshots"', 'FinanceReportSnapshotId');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
  END IF;
END
$operations_schedule_sequence$;

COMMIT;
