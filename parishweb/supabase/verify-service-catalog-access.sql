DO $verify_service_catalog_access$
DECLARE
  target_table text;
  sequence_name text;
  row_security_enabled boolean;
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

  FOREACH target_table IN ARRAY ARRAY[
    'Service',
    'ServiceFieldDefinition',
    'ServiceRequest',
    'BlockedSlots',
    'Parishioners',
    'ServiceRequestDocument',
    'VerificationTokens',
    'BaptismRequestDetail',
    'MarriageRequestDetail',
    'ConfirmationRequestDetail',
    'FuneralRequestDetail',
    'HouseBlessingRequestDetail'
  ] LOOP
    SELECT c.relrowsecurity
    INTO row_security_enabled
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = target_table;

    IF row_security_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS is not enabled for public.%', target_table;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = target_table
        AND current_user = ANY (p.roles)
        AND (
          (target_table IN (
            'BlockedSlots',
            'Parishioners',
            'ServiceRequestDocument',
            'VerificationTokens',
            'BaptismRequestDetail',
            'MarriageRequestDetail',
            'ConfirmationRequestDetail',
            'FuneralRequestDetail',
            'HouseBlessingRequestDetail'
          ) AND p.cmd = 'ALL')
          OR (target_table IN ('Service', 'ServiceFieldDefinition', 'ServiceRequest') AND p.cmd = 'SELECT')
        )
    ) THEN
      RAISE EXCEPTION 'The runtime role is missing the reviewed service policy for public.%', target_table;
    END IF;

  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies AS p
    WHERE p.schemaname = 'public'
      AND p.tablename = 'ServiceFieldDefinition'
      AND current_user = ANY (p.roles)
      AND p.cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'The runtime role is missing the service-field administration policy.';
  END IF;

  IF NOT has_table_privilege(current_user, '"public"."Service"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."ServiceFieldDefinition"', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'ServiceId', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'FieldKey', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'Label', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'FieldType', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'OptionsJson', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'IsRequired', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'SortOrder', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'IsActive', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'Label', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'FieldType', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'OptionsJson', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'IsRequired', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'SortOrder', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceFieldDefinition"', 'IsActive', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."ServiceFieldDefinition"', 'DELETE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'ServiceId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'VoidedAt', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'ScheduledDate', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'ScheduledTime', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'AttendanceStatus', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'Status', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'BlockDate', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'BlockTime', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'Scope', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'ServiceId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'Reason', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'BlockedSlotId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'BlockDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'BlockTime', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'Scope', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'ServiceId', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'Reason', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."BlockedSlots"', 'CreatedAt', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."BlockedSlots"', 'DELETE')
    OR NOT has_sequence_privilege(
      current_user,
      pg_get_serial_sequence('"public"."BlockedSlots"', 'BlockedSlotId'),
      'USAGE'
    )
    OR NOT has_column_privilege(current_user, '"public"."Parishioners"', 'ParishionerId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Parishioners"', 'EmailAddress', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Parishioners"', 'MobileNumber', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Parishioners"', 'FirstName', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Parishioners"', 'EmailAddress', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'ServiceRequestId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'RequestDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'Status', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'Notes', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'VoidedAt', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'AttendanceStatus', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequest"', 'AttendanceMarkedAt', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."ServiceRequest"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."ServiceRequestDocument"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."BaptismRequestDetail"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."MarriageRequestDetail"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."ConfirmationRequestDetail"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."FuneralRequestDetail"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."HouseBlessingRequestDetail"', 'DELETE')
    OR NOT has_column_privilege(current_user, '"public"."ServiceRequestDocument"', 'FileData', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."VerificationTokens"', 'Token', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."VerificationTokens"', 'UsedAt', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."VerificationTokens"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing a required service privilege.';
  END IF;

  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."BlockedSlots"', 'BlockedSlotId'),
    pg_get_serial_sequence('"public"."Parishioners"', 'ParishionerId'),
    pg_get_serial_sequence('"public"."ServiceFieldDefinition"', 'FieldDefinitionId'),
    pg_get_serial_sequence('"public"."ServiceRequest"', 'ServiceRequestId'),
    pg_get_serial_sequence('"public"."VerificationTokens"', 'TokenId'),
    pg_get_serial_sequence('"public"."ServiceRequestDocument"', 'DocumentId')
  ] LOOP
    IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
      RAISE EXCEPTION 'The runtime role is missing a required service identity-sequence privilege.';
    END IF;
  END LOOP;
END
$verify_service_catalog_access$;
