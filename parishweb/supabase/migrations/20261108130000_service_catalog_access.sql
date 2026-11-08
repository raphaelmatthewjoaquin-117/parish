-- Server-only access for service catalog management, availability, booking, and verification.
ALTER TABLE "public"."Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceFieldDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BlockedSlots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Parishioners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceRequestDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationTokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BaptismRequestDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MarriageRequestDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConfirmationRequestDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FuneralRequestDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."HouseBlessingRequestDetail" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parish_app_runtime_service_catalog_read" ON "public"."Service";
CREATE POLICY "parish_app_runtime_service_catalog_read"
  ON "public"."Service"
  FOR SELECT
  TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_service_catalog_read" ON "public"."ServiceFieldDefinition";
CREATE POLICY "parish_app_runtime_service_catalog_read"
  ON "public"."ServiceFieldDefinition"
  FOR SELECT
  TO parish_app_runtime
  USING (true);

DROP POLICY IF EXISTS "parish_app_runtime_service_field_admin_access" ON "public"."ServiceFieldDefinition";
CREATE POLICY "parish_app_runtime_service_field_admin_access"
  ON "public"."ServiceFieldDefinition"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "parish_app_runtime_service_availability_read" ON "public"."ServiceRequest";
CREATE POLICY "parish_app_runtime_service_availability_read"
  ON "public"."ServiceRequest"
  FOR SELECT
  TO parish_app_runtime
  USING (true);

DO $service_booking_policies$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'Parishioners',
    'ServiceRequest',
    'ServiceRequestDocument',
    'VerificationTokens',
    'BaptismRequestDetail',
    'MarriageRequestDetail',
    'ConfirmationRequestDetail',
    'FuneralRequestDetail',
    'HouseBlessingRequestDetail'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'parish_app_runtime_service_booking_access', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO parish_app_runtime USING (true) WITH CHECK (true)',
      'parish_app_runtime_service_booking_access',
      target_table
    );
  END LOOP;
END
$service_booking_policies$;

DROP POLICY IF EXISTS "parish_app_runtime_service_availability_read" ON "public"."BlockedSlots";
CREATE POLICY "parish_app_runtime_service_availability_read"
  ON "public"."BlockedSlots"
  FOR ALL
  TO parish_app_runtime
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON TABLE "public"."Service" TO parish_app_runtime;
GRANT SELECT ON TABLE "public"."ServiceFieldDefinition" TO parish_app_runtime;
GRANT INSERT ("ServiceId", "FieldKey", "Label", "FieldType", "OptionsJson", "IsRequired", "SortOrder", "IsActive")
  ON TABLE "public"."ServiceFieldDefinition" TO parish_app_runtime;
GRANT UPDATE ("Label", "FieldType", "OptionsJson", "IsRequired", "SortOrder", "IsActive")
  ON TABLE "public"."ServiceFieldDefinition" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."ServiceFieldDefinition" TO parish_app_runtime;
GRANT SELECT ("ServiceId", "ScheduledDate", "ScheduledTime", "Status")
  ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "ParishionerId", "ServiceId", "ScheduledDate", "ScheduledTime", "Status",
  "Notes", "VoidedAt", "CreatedAt", "ContactFirstName", "ContactLastName", "ContactEmail", "ContactMobile", "ContactAddress")
  ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT INSERT ("ParishionerId", "ServiceId", "RequestDate", "ScheduledDate", "ScheduledTime", "Venue", "Status", "Notes", "CreatedAt",
  "ContactFirstName", "ContactLastName", "ContactEmail", "ContactMobile", "ContactAddress")
  ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT SELECT ("ParishionerId", "FirstName", "LastName", "EmailAddress", "MobileNumber", "Address")
  ON TABLE "public"."Parishioners" TO parish_app_runtime;
GRANT INSERT ("FirstName", "LastName", "EmailAddress", "MobileNumber", "Address", "CreatedAt")
  ON TABLE "public"."Parishioners" TO parish_app_runtime;
GRANT UPDATE ("FirstName", "LastName", "Address", "EmailAddress", "MobileNumber")
  ON TABLE "public"."Parishioners" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "FieldKey", "Label", "OriginalFileName", "ContentType", "FileData")
  ON TABLE "public"."ServiceRequestDocument" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "FieldKey", "Label", "OriginalFileName", "ContentType", "FileData")
  ON TABLE "public"."ServiceRequestDocument" TO parish_app_runtime;
GRANT SELECT ("Token", "ServiceRequestId", "ExpiresAt", "Used")
  ON TABLE "public"."VerificationTokens" TO parish_app_runtime;
GRANT INSERT ("Token", "ServiceRequestId", "ExpiresAt", "Used", "CreatedAt")
  ON TABLE "public"."VerificationTokens" TO parish_app_runtime;
GRANT UPDATE ("Used", "UsedAt")
  ON TABLE "public"."VerificationTokens" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."VerificationTokens" TO parish_app_runtime;
GRANT UPDATE ("Status", "Notes", "VoidedAt") ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT SELECT ("Status") ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."ServiceRequest" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."ServiceRequestDocument" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."BaptismRequestDetail" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."MarriageRequestDetail" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."ConfirmationRequestDetail" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."FuneralRequestDetail" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."HouseBlessingRequestDetail" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "ChildFirstName", "ChildMiddleName", "ChildLastName", "ChildDateOfBirth", "PlaceOfBirth",
  "FatherFullName", "MotherFullName", "GodfatherName", "GodmotherName", "ExtraFieldsJson")
  ON TABLE "public"."BaptismRequestDetail" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "ChildFirstName", "ChildMiddleName", "ChildLastName", "ChildDateOfBirth", "PlaceOfBirth",
  "FatherFullName", "MotherFullName", "GodfatherName", "GodmotherName", "ExtraFieldsJson")
  ON TABLE "public"."BaptismRequestDetail" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "GroomFirstName", "GroomMiddleName", "GroomLastName", "GroomAge", "BrideFirstName",
  "BrideMiddleName", "BrideLastName", "BrideAge", "CenomarNumber", "Witnesses", "ExtraFieldsJson")
  ON TABLE "public"."MarriageRequestDetail" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "GroomFirstName", "GroomMiddleName", "GroomLastName", "GroomAge", "BrideFirstName",
  "BrideMiddleName", "BrideLastName", "BrideAge", "CenomarNumber", "Witnesses", "ExtraFieldsJson")
  ON TABLE "public"."MarriageRequestDetail" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "CandidateFirstName", "CandidateMiddleName", "CandidateLastName", "CandidateDateOfBirth",
  "SponsorName", "ParishOfBaptism", "ExtraFieldsJson")
  ON TABLE "public"."ConfirmationRequestDetail" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "CandidateFirstName", "CandidateMiddleName", "CandidateLastName", "CandidateDateOfBirth",
  "SponsorName", "ParishOfBaptism", "ExtraFieldsJson")
  ON TABLE "public"."ConfirmationRequestDetail" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "DeceasedFirstName", "DeceasedMiddleName", "DeceasedLastName", "DateOfDeath",
  "RelationshipToDeceased", "PlaceOfWake", "ExtraFieldsJson")
  ON TABLE "public"."FuneralRequestDetail" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "DeceasedFirstName", "DeceasedMiddleName", "DeceasedLastName", "DateOfDeath",
  "RelationshipToDeceased", "PlaceOfWake", "ExtraFieldsJson")
  ON TABLE "public"."FuneralRequestDetail" TO parish_app_runtime;
GRANT INSERT ("ServiceRequestId", "FullAddress", "Landmark", "PreferredContactPerson", "ExtraFieldsJson")
  ON TABLE "public"."HouseBlessingRequestDetail" TO parish_app_runtime;
GRANT SELECT ("ServiceRequestId", "FullAddress", "Landmark", "PreferredContactPerson", "ExtraFieldsJson")
  ON TABLE "public"."HouseBlessingRequestDetail" TO parish_app_runtime;
GRANT SELECT ("BlockDate", "BlockTime", "Scope", "ServiceId", "Reason")
  ON TABLE "public"."BlockedSlots" TO parish_app_runtime;
GRANT SELECT ("BlockedSlotId") ON TABLE "public"."BlockedSlots" TO parish_app_runtime;
GRANT INSERT ("BlockDate", "BlockTime", "Scope", "ServiceId", "Reason", "CreatedAt")
  ON TABLE "public"."BlockedSlots" TO parish_app_runtime;
GRANT DELETE ON TABLE "public"."BlockedSlots" TO parish_app_runtime;
GRANT USAGE ON SEQUENCE "public"."BlockedSlots_BlockedSlotId_seq" TO parish_app_runtime;

DO $service_booking_sequences$
DECLARE
  sequence_name text;
BEGIN
  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."Parishioners"', 'ParishionerId'),
    pg_get_serial_sequence('"public"."ServiceFieldDefinition"', 'FieldDefinitionId'),
    pg_get_serial_sequence('"public"."ServiceRequest"', 'ServiceRequestId'),
    pg_get_serial_sequence('"public"."VerificationTokens"', 'TokenId'),
    pg_get_serial_sequence('"public"."ServiceRequestDocument"', 'DocumentId')
  ] LOOP
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO parish_app_runtime', sequence_name);
    END IF;
  END LOOP;
END
$service_booking_sequences$;
