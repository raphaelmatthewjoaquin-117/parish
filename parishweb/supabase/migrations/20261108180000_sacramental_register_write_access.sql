-- Restricted server-only access for sacramental record maintenance and audit writes.
BEGIN;

DO $sacramental_register_write_preflight$
BEGIN
  IF current_user = 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Apply sacramental register write migrations with an owner/admin connection, not the runtime role.';
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
$sacramental_register_write_preflight$;

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."BaptismRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_access"
  ON "public"."BaptismRecords"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."ConfirmationRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_access"
  ON "public"."ConfirmationRecords"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."MarriageRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_access"
  ON "public"."MarriageRecords"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_register_read"
  ON "public"."DeathRecords";
CREATE POLICY "parish_app_runtime_sacramental_register_access"
  ON "public"."DeathRecords"
  FOR ALL TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_sacramental_audit_insert"
  ON "public"."SacramentalRecordAudit";
CREATE POLICY "parish_app_runtime_sacramental_audit_insert"
  ON "public"."SacramentalRecordAudit"
  FOR INSERT TO parish_app_runtime
  WITH CHECK (true);

GRANT INSERT (
  "RegistryNumber", "ChildFirstName", "ChildMiddleName", "ChildLastName",
  "DateOfBirth", "PlaceOfBirth", "DateOfBaptism", "FatherFullName",
  "MotherFullName", "MinisterName", "Sponsors", "Remarks", "CreatedBy"
) ON TABLE "public"."BaptismRecords" TO parish_app_runtime;
GRANT UPDATE (
  "RegistryNumber", "ChildFirstName", "ChildMiddleName", "ChildLastName",
  "DateOfBirth", "PlaceOfBirth", "DateOfBaptism", "FatherFullName",
  "MotherFullName", "MinisterName", "Sponsors", "Remarks", "UpdatedAt"
) ON TABLE "public"."BaptismRecords" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."BaptismRecords" TO parish_app_runtime;

GRANT INSERT (
  "RegistryNumber", "CandidateFirstName", "CandidateMiddleName", "CandidateLastName",
  "DateOfBirth", "DateOfConfirmation", "FatherFullName", "MotherFullName",
  "SponsorName", "BishopOrMinister", "ParishOfBaptism", "CreatedBy"
) ON TABLE "public"."ConfirmationRecords" TO parish_app_runtime;
GRANT UPDATE (
  "RegistryNumber", "CandidateFirstName", "CandidateMiddleName", "CandidateLastName",
  "DateOfBirth", "DateOfConfirmation", "FatherFullName", "MotherFullName",
  "SponsorName", "BishopOrMinister", "ParishOfBaptism", "UpdatedAt"
) ON TABLE "public"."ConfirmationRecords" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."ConfirmationRecords" TO parish_app_runtime;

GRANT INSERT (
  "RegistryNumber", "GroomFirstName", "GroomMiddleName", "GroomLastName",
  "GroomAge", "GroomParents", "BrideFirstName", "BrideMiddleName", "BrideLastName",
  "BrideAge", "BrideParents", "DateOfMarriage", "Witnesses", "SolemnizingPriest",
  "CreatedBy"
) ON TABLE "public"."MarriageRecords" TO parish_app_runtime;
GRANT UPDATE (
  "RegistryNumber", "GroomFirstName", "GroomMiddleName", "GroomLastName",
  "GroomAge", "GroomParents", "BrideFirstName", "BrideMiddleName", "BrideLastName",
  "BrideAge", "BrideParents", "DateOfMarriage", "Witnesses", "SolemnizingPriest",
  "UpdatedAt"
) ON TABLE "public"."MarriageRecords" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."MarriageRecords" TO parish_app_runtime;

GRANT INSERT (
  "RegistryNumber", "DeceasedFirstName", "DeceasedMiddleName", "DeceasedLastName",
  "Age", "DateOfDeath", "DateOfBurial", "CauseOfDeath", "PlaceOfBurial",
  "SacramentsReceived", "OfficiatingPriest", "CreatedBy"
) ON TABLE "public"."DeathRecords" TO parish_app_runtime;
GRANT UPDATE (
  "RegistryNumber", "DeceasedFirstName", "DeceasedMiddleName", "DeceasedLastName",
  "Age", "DateOfDeath", "DateOfBurial", "CauseOfDeath", "PlaceOfBurial",
  "SacramentsReceived", "OfficiatingPriest", "UpdatedAt"
) ON TABLE "public"."DeathRecords" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."DeathRecords" TO parish_app_runtime;

GRANT INSERT ("RecordType", "RecordId", "ActionName", "ChangedBy", "Changes")
  ON TABLE "public"."SacramentalRecordAudit" TO parish_app_runtime;

DO $sacramental_register_sequences$
DECLARE
  sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."BaptismRecords"', 'BaptismId'),
    pg_get_serial_sequence('"public"."ConfirmationRecords"', 'ConfirmationId'),
    pg_get_serial_sequence('"public"."MarriageRecords"', 'MarriageId'),
    pg_get_serial_sequence('"public"."DeathRecords"', 'DeathId'),
    pg_get_serial_sequence('"public"."SacramentalRecordAudit"', 'AuditId')
  ] LOOP
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
    END IF;
  END LOOP;
END
$sacramental_register_sequences$;

COMMIT;
