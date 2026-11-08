DO $verify_events_access$
DECLARE
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'Events'
      AND relation.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled for public.Events.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Events'
      AND current_user = ANY (roles)
      AND cmd = 'ALL'
  ) THEN
    RAISE EXCEPTION 'The runtime role is missing the Events access policy.';
  END IF;

  IF NOT has_column_privilege(current_user, '"public"."Events"', 'EventId', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Title', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'TitleTl', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Description', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'DescriptionTl', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Body', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'BodyTl', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventDate', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventTime', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Location', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'LocationTl', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'PhotoUrl', 'SELECT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Title', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'TitleTl', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Description', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'DescriptionTl', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Body', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'BodyTl', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventDate', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventTime', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Location', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'LocationTl', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'PhotoUrl', 'INSERT')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Title', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'TitleTl', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Description', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'DescriptionTl', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Body', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'BodyTl', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventDate', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'EventTime', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'Location', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'LocationTl', 'UPDATE')
    OR NOT has_column_privilege(current_user, '"public"."Events"', 'PhotoUrl', 'UPDATE')
    OR NOT has_table_privilege(current_user, '"public"."Events"', 'DELETE')
  THEN
    RAISE EXCEPTION 'The runtime role is missing required Events privileges.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."Events"', 'EventId');
  IF sequence_name IS NULL OR NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'The runtime role is missing the Events identity-sequence privilege.';
  END IF;
END
$verify_events_access$;
