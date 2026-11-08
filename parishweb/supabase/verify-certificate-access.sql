DO $verify_certificate_access$
DECLARE
  table_name text;
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

  FOREACH table_name IN ARRAY ARRAY['BlockedSlots', 'CertificateRequests', 'CertificateRequestDocuments'] LOOP
    SELECT c.relrowsecurity
    INTO row_security_enabled
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = table_name;

    IF row_security_enabled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RLS is not enabled for public.%', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies AS p
      WHERE p.schemaname = 'public'
        AND p.tablename = table_name
        AND current_user = ANY (p.roles)
        AND (
          (table_name = 'BlockedSlots' AND p.cmd = 'SELECT')
          OR (table_name <> 'BlockedSlots' AND p.cmd = 'ALL')
        )
    ) THEN
      RAISE EXCEPTION 'The runtime role is missing the reviewed RLS policy for public.%', table_name;
    END IF;
  END LOOP;

  IF NOT has_table_privilege(current_user, '"public"."BlockedSlots"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequests"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequests"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequests"', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequests"', 'DELETE')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequestDocuments"', 'SELECT')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequestDocuments"', 'INSERT')
    OR NOT has_table_privilege(current_user, '"public"."CertificateRequestDocuments"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing a required certificate-table privilege.';
  END IF;

  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."CertificateRequests"', 'CertificateRequestId'),
    pg_get_serial_sequence('"public"."CertificateRequestDocuments"', 'CertificateRequestDocumentId')
  ] LOOP
    IF sequence_name IS NULL
      OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE')
    THEN
      RAISE EXCEPTION 'The runtime role is missing a required certificate identity-sequence privilege.';
    END IF;
  END LOOP;
END
$verify_certificate_access$;
