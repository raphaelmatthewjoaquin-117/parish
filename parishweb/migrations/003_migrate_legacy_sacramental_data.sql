/*
 * Migration: Migrate Legacy Sacramental Data to New Schema
 *
 * This script migrates data from the old detail tables to the new
 * normalized sacramental records tables.
 *
 * Old tables:
 * - BaptismDetail
 * - ConfirmationDetail
 * - FuneralMassDetail
 * - HouseBlessingDetail
 * - MarriageDetail
 *
 * New tables:
 * - BaptismRecords
 * - ConfirmationRecords
 * - MarriageRecords
 * - DeathRecords
 * - SacramentalArchives (new, empty initially)
 *
 * Run AFTER 002_sacramental_records.sql has created the new tables.
 */

-- ============================================================
-- BAPTISM RECORDS MIGRATION
-- ============================================================
-- Map: BaptismDetail → BaptismRecords
-- ChildName → split into ChildFirstName/ChildLastName
-- DateOfBirth → DateOfBirth
-- ServiceRequestId → used to fetch additional info if needed
-- Generate RegistryNumber as 'BAP-{Year}-{Sequence}'

IF OBJECT_ID(N'dbo.BaptismRecords', N'U') IS NOT NULL
BEGIN
    -- First, let's see what we have in the old table
    PRINT 'Migrating BaptismDetail to BaptismRecords...';

    -- We'll insert with generated registry numbers
    ;WITH NumberedBaptisms AS (
        SELECT
            bd.BaptismDetailId,
            bd.ServiceRequestId,
            bd.ChildName,
            bd.DateOfBirth,
            ROW_NUMBER() OVER (ORDER BY bd.BaptismDetailId) as SeqNum,
            YEAR(bd.DateOfBirth) as BirthYear
        FROM dbo.BaptismDetail bd
    ),
    SplitNames AS (
        SELECT
            BaptismDetailId,
            ServiceRequestId,
            DateOfBirth,
            -- Split ChildName into first and last (simple space split)
            CASE
                WHEN CHARINDEX(' ', ChildName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(ChildName, 1, CHARINDEX(' ', ChildName) - 1)))
                ELSE ChildName
            END as ChildFirstName,
            CASE
                WHEN CHARINDEX(' ', ChildName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(ChildName, CHARINDEX(' ', ChildName) + 1, LEN(ChildName))))
                ELSE ''
            END as ChildLastName,
            'BAP-' + CAST(BirthYear AS NVARCHAR(4)) + '-' + RIGHT('0000' + CAST(SeqNum AS NVARCHAR(4)), 4) as RegistryNumber
        FROM NumberedBaptisms
    )
    INSERT INTO dbo.BaptismRecords (
        RegistryNumber,
        ChildFirstName,
        ChildMiddleName,
        ChildLastName,
        DateOfBirth,
        PlaceOfBirth,
        DateOfBaptism,
        FatherFullName,
        MotherFullName,
        MinisterName,
        Sponsors,
        Remarks,
        ScannedDocumentUrl,
        CreatedAt,
        UpdatedAt,
        CreatedBy
    )
    SELECT
        RegistryNumber,
        ChildFirstName,
        NULL as ChildMiddleName,
        CASE WHEN ChildLastName = '' THEN 'Unknown' ELSE ChildLastName END as ChildLastName,
        DateOfBirth,
        NULL as PlaceOfBirth,
        DateOfBirth as DateOfBaptism,  -- Default to date of birth if no baptism date
        NULL as FatherFullName,
        NULL as MotherFullName,
        'Legacy Import' as MinisterName,
        NULL as Sponsors,
        'Migrated from legacy BaptismDetail table' as Remarks,
        NULL as ScannedDocumentUrl,
        SYSUTCDATETIME() as CreatedAt,
        SYSUTCDATETIME() as UpdatedAt,
        'MigrationScript' as CreatedBy
    FROM SplitNames
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.BaptismRecords br WHERE br.RegistryNumber = SplitNames.RegistryNumber
    );

    PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Baptism records migrated.';
END;

-- ============================================================
-- CONFIRMATION RECORDS MIGRATION
-- ============================================================
-- Map: ConfirmationDetail → ConfirmationRecords
-- ConfirmationDate → DateOfConfirmation
-- Sponsor → SponsorName
-- Generate RegistryNumber as 'CON-{Year}-{Sequence}'

IF OBJECT_ID(N'dbo.ConfirmationRecords', N'U') IS NOT NULL
BEGIN
    PRINT 'Migrating ConfirmationDetail to ConfirmationRecords...';

    ;WITH NumberedConfirmations AS (
        SELECT
            cd.ConfirmationDetailId,
            cd.ServiceRequestId,
            cd.ConfirmationDate,
            cd.Sponsor,
            ROW_NUMBER() OVER (ORDER BY cd.ConfirmationDetailId) as SeqNum,
            YEAR(cd.ConfirmationDate) as ConfYear
        FROM dbo.ConfirmationDetail cd
    ),
    SplitNames AS (
        SELECT
            ConfirmationDetailId,
            ServiceRequestId,
            ConfirmationDate,
            Sponsor,
            'CON-' + CAST(ConfYear AS NVARCHAR(4)) + '-' + RIGHT('0000' + CAST(SeqNum AS NVARCHAR(4)), 4) as RegistryNumber,
            -- We don't have candidate name in old table, use placeholder
            'Candidate' as CandidateFirstName,
            'Unknown' as CandidateLastName
        FROM NumberedConfirmations
    )
    INSERT INTO dbo.ConfirmationRecords (
        RegistryNumber,
        CandidateFirstName,
        CandidateMiddleName,
        CandidateLastName,
        DateOfBirth,
        DateOfConfirmation,
        FatherFullName,
        MotherFullName,
        SponsorName,
        BishopOrMinister,
        ParishOfBaptism,
        ScannedDocumentUrl,
        CreatedAt,
        UpdatedAt,
        CreatedBy
    )
    SELECT
        RegistryNumber,
        CandidateFirstName,
        NULL as CandidateMiddleName,
        CandidateLastName,
        DATEADD(year, -14, ConfirmationDate) as DateOfBirth,  -- Estimate: ~14 years before confirmation
        ConfirmationDate,
        NULL as FatherFullName,
        NULL as MotherFullName,
        ISNULL(Sponsor, 'Unknown') as SponsorName,
        'Legacy Import' as BishopOrMinister,
        NULL as ParishOfBaptism,
        NULL as ScannedDocumentUrl,
        SYSUTCDATETIME() as CreatedAt,
        SYSUTCDATETIME() as UpdatedAt,
        'MigrationScript' as CreatedBy
    FROM SplitNames
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.ConfirmationRecords cr WHERE cr.RegistryNumber = SplitNames.RegistryNumber
    );

    PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Confirmation records migrated.';
END;

-- ============================================================
-- MARRIAGE RECORDS MIGRATION
-- ============================================================
-- Map: MarriageDetail → MarriageRecords
-- GroomName → GroomFirstName/GroomLastName
-- BrideName → BrideFirstName/BrideLastName
-- Generate RegistryNumber as 'MAR-{Year}-{Sequence}'
-- Note: No date in old table, will need to get from ServiceRequest

IF OBJECT_ID(N'dbo.MarriageRecords', N'U') IS NOT NULL
BEGIN
    PRINT 'Migrating MarriageDetail to MarriageRecords...';

    ;WITH NumberedMarriages AS (
        SELECT
            md.MarriageDetailId,
            md.ServiceRequestId,
            md.GroomName,
            md.BrideName,
            ROW_NUMBER() OVER (ORDER BY md.MarriageDetailId) as SeqNum,
            -- Get marriage date from ServiceRequest
            sr.ScheduledDate as MarriageDate
        FROM dbo.MarriageDetail md
        LEFT JOIN dbo.ServiceRequest sr ON sr.ServiceRequestId = md.ServiceRequestId
    ),
    SplitNames AS (
        SELECT
            MarriageDetailId,
            ServiceRequestId,
            MarriageDate,
            -- Split GroomName
            CASE
                WHEN CHARINDEX(' ', GroomName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(GroomName, 1, CHARINDEX(' ', GroomName) - 1)))
                ELSE GroomName
            END as GroomFirstName,
            CASE
                WHEN CHARINDEX(' ', GroomName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(GroomName, CHARINDEX(' ', GroomName) + 1, LEN(GroomName))))
                ELSE ''
            END as GroomLastName,
            -- Split BrideName
            CASE
                WHEN CHARINDEX(' ', BrideName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(BrideName, 1, CHARINDEX(' ', BrideName) - 1)))
                ELSE BrideName
            END as BrideFirstName,
            CASE
                WHEN CHARINDEX(' ', BrideName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(BrideName, CHARINDEX(' ', BrideName) + 1, LEN(BrideName))))
                ELSE ''
            END as BrideLastName,
            'MAR-' + CAST(YEAR(ISNULL(MarriageDate, GETDATE())) AS NVARCHAR(4)) + '-' + RIGHT('0000' + CAST(SeqNum AS NVARCHAR(4)), 4) as RegistryNumber
        FROM NumberedMarriages
    )
    INSERT INTO dbo.MarriageRecords (
        RegistryNumber,
        GroomFirstName,
        GroomMiddleName,
        GroomLastName,
        GroomAge,
        GroomParents,
        BrideFirstName,
        BrideMiddleName,
        BrideLastName,
        BrideAge,
        BrideParents,
        DateOfMarriage,
        Witnesses,
        SolemnizingPriest,
        ScannedDocumentUrl,
        CreatedAt,
        UpdatedAt,
        CreatedBy
    )
    SELECT
        RegistryNumber,
        GroomFirstName,
        NULL as GroomMiddleName,
        CASE WHEN GroomLastName = '' THEN 'Unknown' ELSE GroomLastName END as GroomLastName,
        NULL as GroomAge,
        NULL as GroomParents,
        BrideFirstName,
        NULL as BrideMiddleName,
        CASE WHEN BrideLastName = '' THEN 'Unknown' ELSE BrideLastName END as BrideLastName,
        NULL as BrideAge,
        NULL as BrideParents,
        ISNULL(MarriageDate, GETDATE()) as DateOfMarriage,
        NULL as Witnesses,
        'Legacy Import' as SolemnizingPriest,
        NULL as ScannedDocumentUrl,
        SYSUTCDATETIME() as CreatedAt,
        SYSUTCDATETIME() as UpdatedAt,
        'MigrationScript' as CreatedBy
    FROM SplitNames
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.MarriageRecords mr WHERE mr.RegistryNumber = SplitNames.RegistryNumber
    );

    PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Marriage records migrated.';
END;

-- ============================================================
-- DEATH/FUNERAL RECORDS MIGRATION
-- ============================================================
-- Map: FuneralMassDetail → DeathRecords
-- DeceasedName → DeceasedFirstName/DeceasedLastName
-- DateOfDeath → DateOfDeath
-- FuneralDate → DateOfBurial
-- Generate RegistryNumber as 'DTH-{Year}-{Sequence}'

IF OBJECT_ID(N'dbo.DeathRecords', N'U') IS NOT NULL
BEGIN
    PRINT 'Migrating FuneralMassDetail to DeathRecords...';

    ;WITH NumberedFunerals AS (
        SELECT
            fd.FuneralMassDetailId,
            fd.ServiceRequestId,
            fd.DeceasedName,
            fd.DateOfDeath,
            fd.FuneralDate,
            ROW_NUMBER() OVER (ORDER BY fd.FuneralMassDetailId) as SeqNum,
            YEAR(fd.DateOfDeath) as DeathYear
        FROM dbo.FuneralMassDetail fd
    ),
    SplitNames AS (
        SELECT
            FuneralMassDetailId,
            ServiceRequestId,
            DateOfDeath,
            FuneralDate,
            DeceasedName,
            'DTH-' + CAST(DeathYear AS NVARCHAR(4)) + '-' + RIGHT('0000' + CAST(SeqNum AS NVARCHAR(4)), 4) as RegistryNumber,
            -- Split DeceasedName
            CASE
                WHEN CHARINDEX(' ', DeceasedName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(DeceasedName, 1, CHARINDEX(' ', DeceasedName) - 1)))
                ELSE DeceasedName
            END as DeceasedFirstName,
            CASE
                WHEN CHARINDEX(' ', DeceasedName) > 0
                THEN LTRIM(RTRIM(SUBSTRING(DeceasedName, CHARINDEX(' ', DeceasedName) + 1, LEN(DeceasedName))))
                ELSE ''
            END as DeceasedLastName
        FROM NumberedFunerals
    )
    INSERT INTO dbo.DeathRecords (
        RegistryNumber,
        DeceasedFirstName,
        DeceasedMiddleName,
        DeceasedLastName,
        Age,
        DateOfDeath,
        DateOfBurial,
        CauseOfDeath,
        PlaceOfBurial,
        SacramentsReceived,
        OfficiatingPriest,
        ScannedDocumentUrl,
        CreatedAt,
        UpdatedAt,
        CreatedBy
    )
    SELECT
        RegistryNumber,
        DeceasedFirstName,
        NULL as DeceasedMiddleName,
        CASE WHEN DeceasedLastName = '' THEN 'Unknown' ELSE DeceasedLastName END as DeceasedLastName,
        NULL as Age,
        DateOfDeath,
        FuneralDate as DateOfBurial,
        NULL as CauseOfDeath,
        NULL as PlaceOfBurial,
        NULL as SacramentsReceived,
        'Legacy Import' as OfficiatingPriest,
        NULL as ScannedDocumentUrl,
        SYSUTCDATETIME() as CreatedAt,
        SYSUTCDATETIME() as UpdatedAt,
        'MigrationScript' as CreatedBy
    FROM SplitNames
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.DeathRecords dr WHERE dr.RegistryNumber = SplitNames.RegistryNumber
    );

    PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' Death records migrated.';
END;

-- ============================================================
-- HOUSE BLESSING - Not a sacrament, but we can archive it
-- ============================================================
-- HouseBlessingDetail doesn't map to a sacramental record
-- We'll create archive entries for reference

IF OBJECT_ID(N'dbo.SacramentalArchives', N'U') IS NOT NULL
BEGIN
    PRINT 'Creating archive entries for House Blessings...';

    ;WITH NumberedBlessings AS (
        SELECT
            hbd.HouseBlessingDetailId,
            hbd.ServiceRequestId,
            hbd.Address,
            ROW_NUMBER() OVER (ORDER BY hbd.HouseBlessingDetailId) as SeqNum,
            YEAR(ISNULL(sr.ScheduledDate, GETDATE())) as BlessYear
        FROM dbo.HouseBlessingDetail hbd
        LEFT JOIN dbo.ServiceRequest sr ON sr.ServiceRequestId = hbd.ServiceRequestId
    )
    INSERT INTO dbo.SacramentalArchives (
        SacramentType,
        BookNumber,
        PageNumber,
        FileUrl,
        Notes,
        UploadedAt,
        UploadedBy
    )
    SELECT
        'HouseBlessing' as SacramentType,
        1 as BookNumber,
        SeqNum as PageNumber,
        '' as FileUrl,
        'House Blessing at: ' + ISNULL(Address, 'Unknown Address') + ' (Migrated from legacy HouseBlessingDetail)' as Notes,
        SYSUTCDATETIME() as UploadedAt,
        'MigrationScript' as UploadedBy
    FROM NumberedBlessings
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.SacramentalArchives sa
        WHERE sa.SacramentType = 'HouseBlessing' AND sa.PageNumber = NumberedBlessings.SeqNum
    );

    PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' House Blessing archive entries created.';
END;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
PRINT '';
PRINT '=== MIGRATION SUMMARY ===';

SELECT 'BaptismRecords' as TableName, COUNT(*) as RecordCount FROM dbo.BaptismRecords
UNION ALL
SELECT 'ConfirmationRecords', COUNT(*) FROM dbo.ConfirmationRecords
UNION ALL
SELECT 'MarriageRecords', COUNT(*) FROM dbo.MarriageRecords
UNION ALL
SELECT 'DeathRecords', COUNT(*) FROM dbo.DeathRecords
UNION ALL
SELECT 'SacramentalArchives', COUNT(*) FROM dbo.SacramentalArchives;

PRINT 'Migration completed successfully.';