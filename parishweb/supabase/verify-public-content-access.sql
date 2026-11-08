DO $verify_public_content_access$
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

  FOREACH table_name IN ARRAY ARRAY['SiteContent', 'ContactMessages', 'PrayerRequests'] LOOP
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
        AND p.cmd = 'ALL'
    ) THEN
      RAISE EXCEPTION 'The runtime role is missing the reviewed RLS policy for public.%', table_name;
    END IF;

    IF NOT has_table_privilege(current_user, format('public.%I', table_name), 'SELECT')
      OR NOT has_table_privilege(current_user, format('public.%I', table_name), 'INSERT')
      OR NOT has_table_privilege(current_user, format('public.%I', table_name), 'UPDATE')
      OR (table_name <> 'SiteContent'
        AND NOT has_table_privilege(current_user, format('public.%I', table_name), 'DELETE'))
    THEN
      RAISE EXCEPTION 'The runtime role is missing a required table privilege for public.%', table_name;
    END IF;
  END LOOP;

  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."ContactMessages"', 'ContactMessageId'),
    pg_get_serial_sequence('"public"."PrayerRequests"', 'PrayerId')
  ] LOOP
    IF sequence_name IS NULL
      OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE')
    THEN
      RAISE EXCEPTION 'The runtime role is missing a required identity-sequence privilege.';
    END IF;
  END LOOP;
END
$verify_public_content_access$;
