DO $verify_sacramental_archive_access$
DECLARE
  sequence_name text;
BEGIN
  IF current_user <> 'parish_app_runtime' THEN
    RAISE EXCEPTION 'Run this verification using parish_app_runtime.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'SacramentalArchives'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'SacramentalArchives must exist with row-level security enabled.';
  END IF;

  IF NOT (
    has_table_privilege(current_user, 'public."SacramentalArchives"', 'SELECT')
    AND has_table_privilege(current_user, 'public."SacramentalArchives"', 'DELETE')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'SacramentType', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'BookNumber', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'PageNumber', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'FileUrl', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'Notes', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'RegistryNumber', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'UploadedBy', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'BookNumber', 'UPDATE')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'PageNumber', 'UPDATE')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'RegistryNumber', 'UPDATE')
    AND has_column_privilege(current_user, 'public."SacramentalArchives"', 'Notes', 'UPDATE')
  ) THEN
    RAISE EXCEPTION 'Runtime role is missing a required sacramental archive table or column privilege.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'SacramentalArchives'
      AND policyname = 'parish_app_runtime_sacramental_archive_access'
      AND 'parish_app_runtime' = ANY(roles)
  ) THEN
    RAISE EXCEPTION 'Sacramental archive runtime row-level security policy is missing.';
  END IF;

  sequence_name := pg_get_serial_sequence('"public"."SacramentalArchives"', 'ArchiveId');
  IF sequence_name IS NOT NULL AND NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
    RAISE EXCEPTION 'Runtime role is missing sacramental archive ID sequence access.';
  END IF;

  FOREACH sequence_name IN ARRAY ARRAY[
    pg_get_serial_sequence('"public"."BaptismRecords"', 'BaptismId'),
    pg_get_serial_sequence('"public"."ConfirmationRecords"', 'ConfirmationId'),
    pg_get_serial_sequence('"public"."MarriageRecords"', 'MarriageId'),
    pg_get_serial_sequence('"public"."DeathRecords"', 'DeathId'),
    pg_get_serial_sequence('"public"."SacramentalRecordAudit"', 'AuditId')
  ] LOOP
    IF sequence_name IS NOT NULL AND NOT has_sequence_privilege(current_user, sequence_name, 'USAGE') THEN
      RAISE EXCEPTION 'Runtime role is missing sacramental record or audit ID sequence access.';
    END IF;
  END LOOP;

  IF NOT (
    has_table_privilege(current_user, 'public."BaptismRecords"', 'SELECT')
    AND has_table_privilege(current_user, 'public."ConfirmationRecords"', 'SELECT')
    AND has_table_privilege(current_user, 'public."MarriageRecords"', 'SELECT')
    AND has_table_privilege(current_user, 'public."DeathRecords"', 'SELECT')
    AND has_table_privilege(current_user, 'public."SacramentalRecordAudit"', 'SELECT')
  ) THEN
    RAISE EXCEPTION 'Runtime role is missing read access to a sacramental register table.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY(ARRAY[
        'BaptismRecords',
        'ConfirmationRecords',
        'MarriageRecords',
        'DeathRecords',
        'SacramentalRecordAudit'
      ])
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Row-level security must be enabled on every sacramental register and audit table.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'BaptismRecords',
      'ConfirmationRecords',
      'MarriageRecords',
      'DeathRecords'
    ]) AS register_table(table_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = register_table.table_name
        AND policyname IN (
          'parish_app_runtime_sacramental_register_read',
          'parish_app_runtime_sacramental_register_access'
        )
        AND 'parish_app_runtime' = ANY(roles)
        AND cmd IN ('SELECT', 'ALL')
    )
  ) THEN
    RAISE EXCEPTION 'A sacramental register runtime read policy is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'SacramentalRecordAudit'
      AND policyname = 'parish_app_runtime_sacramental_audit_read'
      AND 'parish_app_runtime' = ANY(roles)
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Sacramental record audit read policy is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'SacramentalRecordAudit'
      AND policyname = 'parish_app_runtime_sacramental_audit_insert'
      AND 'parish_app_runtime' = ANY(roles)
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Sacramental record audit insert policy is missing.';
  END IF;

  IF NOT (
    has_table_privilege(current_user, 'public."BaptismRecords"', 'DELETE')
    AND has_table_privilege(current_user, 'public."ConfirmationRecords"', 'DELETE')
    AND has_table_privilege(current_user, 'public."MarriageRecords"', 'DELETE')
    AND has_table_privilege(current_user, 'public."DeathRecords"', 'DELETE')
    AND has_column_privilege(current_user, 'public."SacramentalRecordAudit"', 'RecordType', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalRecordAudit"', 'RecordId', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalRecordAudit"', 'ActionName', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalRecordAudit"', 'ChangedBy', 'INSERT')
    AND has_column_privilege(current_user, 'public."SacramentalRecordAudit"', 'Changes', 'INSERT')
  ) THEN
    RAISE EXCEPTION 'Runtime role is missing a required sacramental record delete or audit write privilege.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        (
          'BaptismRecords',
          ARRAY['RegistryNumber', 'ChildFirstName', 'ChildMiddleName', 'ChildLastName',
            'DateOfBirth', 'PlaceOfBirth', 'DateOfBaptism', 'FatherFullName',
            'MotherFullName', 'MinisterName', 'Sponsors', 'Remarks', 'CreatedBy'],
          ARRAY['RegistryNumber', 'ChildFirstName', 'ChildMiddleName', 'ChildLastName',
            'DateOfBirth', 'PlaceOfBirth', 'DateOfBaptism', 'FatherFullName',
            'MotherFullName', 'MinisterName', 'Sponsors', 'Remarks', 'UpdatedAt']
        ),
        (
          'ConfirmationRecords',
          ARRAY['RegistryNumber', 'CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName',
            'DateOfBirth', 'DateOfConfirmation', 'FatherFullName', 'MotherFullName',
            'SponsorName', 'BishopOrMinister', 'ParishOfBaptism', 'CreatedBy'],
          ARRAY['RegistryNumber', 'CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName',
            'DateOfBirth', 'DateOfConfirmation', 'FatherFullName', 'MotherFullName',
            'SponsorName', 'BishopOrMinister', 'ParishOfBaptism', 'UpdatedAt']
        ),
        (
          'MarriageRecords',
          ARRAY['RegistryNumber', 'GroomFirstName', 'GroomMiddleName', 'GroomLastName',
            'GroomAge', 'GroomParents', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName',
            'BrideAge', 'BrideParents', 'DateOfMarriage', 'Witnesses', 'SolemnizingPriest',
            'CreatedBy'],
          ARRAY['RegistryNumber', 'GroomFirstName', 'GroomMiddleName', 'GroomLastName',
            'GroomAge', 'GroomParents', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName',
            'BrideAge', 'BrideParents', 'DateOfMarriage', 'Witnesses', 'SolemnizingPriest',
            'UpdatedAt']
        ),
        (
          'DeathRecords',
          ARRAY['RegistryNumber', 'DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName',
            'Age', 'DateOfDeath', 'DateOfBurial', 'CauseOfDeath', 'PlaceOfBurial',
            'SacramentsReceived', 'OfficiatingPriest', 'CreatedBy'],
          ARRAY['RegistryNumber', 'DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName',
            'Age', 'DateOfDeath', 'DateOfBurial', 'CauseOfDeath', 'PlaceOfBurial',
            'SacramentsReceived', 'OfficiatingPriest', 'UpdatedAt']
        )
    ) AS register_access(table_name, insert_columns, update_columns)
    CROSS JOIN LATERAL unnest(register_access.insert_columns) AS insert_column(column_name)
    WHERE NOT has_column_privilege(
      current_user,
      format('public.%I', register_access.table_name),
      insert_column.column_name,
      'INSERT'
    )
  ) OR EXISTS (
    SELECT 1
    FROM (
      VALUES
        (
          'BaptismRecords',
          ARRAY['RegistryNumber', 'ChildFirstName', 'ChildMiddleName', 'ChildLastName',
            'DateOfBirth', 'PlaceOfBirth', 'DateOfBaptism', 'FatherFullName',
            'MotherFullName', 'MinisterName', 'Sponsors', 'Remarks', 'UpdatedAt']
        ),
        (
          'ConfirmationRecords',
          ARRAY['RegistryNumber', 'CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName',
            'DateOfBirth', 'DateOfConfirmation', 'FatherFullName', 'MotherFullName',
            'SponsorName', 'BishopOrMinister', 'ParishOfBaptism', 'UpdatedAt']
        ),
        (
          'MarriageRecords',
          ARRAY['RegistryNumber', 'GroomFirstName', 'GroomMiddleName', 'GroomLastName',
            'GroomAge', 'GroomParents', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName',
            'BrideAge', 'BrideParents', 'DateOfMarriage', 'Witnesses', 'SolemnizingPriest',
            'UpdatedAt']
        ),
        (
          'DeathRecords',
          ARRAY['RegistryNumber', 'DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName',
            'Age', 'DateOfDeath', 'DateOfBurial', 'CauseOfDeath', 'PlaceOfBurial',
            'SacramentsReceived', 'OfficiatingPriest', 'UpdatedAt']
        )
    ) AS register_access(table_name, update_columns)
    CROSS JOIN LATERAL unnest(register_access.update_columns) AS update_column(column_name)
    WHERE NOT has_column_privilege(
      current_user,
      format('public.%I', register_access.table_name),
      update_column.column_name,
      'UPDATE'
    )
  ) THEN
    RAISE EXCEPTION 'Runtime role is missing a sacramental record insert or update column privilege.';
  END IF;
END
$verify_sacramental_archive_access$;
