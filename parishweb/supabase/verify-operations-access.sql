DO $verify_operations_access$
DECLARE
  row_security_enabled boolean;
  sequence_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = current_user
      AND NOT rolsuper
      AND NOT rolbypassrls
  ) THEN
    RAISE EXCEPTION 'Run this verifier as the restricted non-superuser runtime role.';
  END IF;

  SELECT c.relrowsecurity
  INTO row_security_enabled
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'MassSchedule';

  IF row_security_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS is not enabled for public.MassSchedule.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'MassSchedule'
      AND current_user = ANY (p.roles)
      AND p.cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'The runtime role is missing the MassSchedule access policy.';
  END IF;

  IF NOT has_table_privilege(current_user, '"public"."MassSchedule"', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Title', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'MassDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'MassTime', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Location', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'PriestUsername', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Notes', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Status', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Title', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'MassDate', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'MassTime', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Location', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'PriestUsername', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Notes', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'Status', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassSchedule"', 'UpdatedAt', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."MassSchedule"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing a required MassSchedule privilege.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."MassSchedule"', 'MassScheduleId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the MassSchedule identity-sequence privilege.';
  END IF;

  SELECT c.relrowsecurity
  INTO row_security_enabled
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'MassIntentions';

  IF row_security_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS is not enabled for public.MassIntentions.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'MassIntentions'
      AND current_user = ANY (p.roles)
      AND p.cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'The runtime role is missing the MassIntentions access policy.';
  END IF;

  IF NOT has_table_privilege(current_user, '"public"."MassIntentions"', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'IntentionDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'IntentionTime', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'Offering', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'RequestedBy', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'IntentionText', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'CreatedBy', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'Status', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."MassIntentions"', 'UpdatedAt', 'UPDATE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing a required MassIntentions privilege.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."MassIntentions"', 'MassIntentionId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the MassIntentions identity-sequence privilege.';
  END IF;

  SELECT c.relrowsecurity
  INTO row_security_enabled
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'FinancialEntries';

  IF row_security_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RLS is not enabled for public.FinancialEntries.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'FinancialEntries'
      AND current_user = ANY (p.roles)
      AND p.cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'The runtime role is missing the FinancialEntries access policy.';
  END IF;

  IF NOT has_table_privilege(current_user, '"public"."FinancialEntries"', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'EntryDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'EntryType', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'Description', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'Amount', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'EnteredBy', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'EntryDate', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'EntryType', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'Description', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'Amount', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'Status', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'UpdatedAt', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'ApprovedBy', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'ApprovedAt', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'ReconciledBy', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntries"', 'ReconciledAt', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."FinancialEntries"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing a required FinancialEntries privilege.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."FinancialEntries"', 'FinancialEntryId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the FinancialEntries identity-sequence privilege.';
  END IF;

  SELECT c.relrowsecurity
  INTO row_security_enabled
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'FinanceReportSnapshots';

  IF row_security_enabled IS DISTINCT FROM true
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'FinanceReportSnapshots'
        AND current_user = ANY (p.roles)
        AND p.cmd = 'ALL'
    )
    OR NOT has_table_privilege(current_user, '"public"."FinanceReportSnapshots"', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'ReportType', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'PeriodStart', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'PeriodEnd', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'TotalIncome', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'TotalExpenses', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'NetTotal', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'Details', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'GeneratedBy', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'TotalIncome', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'TotalExpenses', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'NetTotal', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'Details', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'GeneratedAt', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."FinanceReportSnapshots"', 'GeneratedBy', 'UPDATE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing scoped finance snapshot access.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."FinanceReportSnapshots"', 'FinanceReportSnapshotId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the finance snapshot identity-sequence privilege.';
  END IF;

  SELECT c.relrowsecurity
  INTO row_security_enabled
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'FinancialEntryAudit';

  IF row_security_enabled IS DISTINCT FROM true
    OR NOT EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'FinancialEntryAudit'
        AND current_user = ANY (p.roles)
        AND p.cmd = 'SELECT'
    )
    OR NOT has_table_privilege(current_user, '"public"."FinancialEntryAudit"', 'SELECT')
  THEN
    RAISE EXCEPTION 'The runtime role is missing scoped finance audit read access.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'FinancialEntryAudit'
      AND current_user = ANY (p.roles)
      AND p.cmd = 'INSERT'
  )
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntryAudit"', 'FinancialEntryId', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntryAudit"', 'ActionName', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."FinancialEntryAudit"', 'ChangedBy', 'INSERT')
  THEN
    RAISE EXCEPTION 'The runtime role is missing scoped finance audit insert access.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."FinancialEntryAudit"', 'AuditId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the finance audit identity-sequence privilege.';
  END IF;
END
$verify_operations_access$;
