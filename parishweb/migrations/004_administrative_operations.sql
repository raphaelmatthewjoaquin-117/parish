/* Administrative and financial operations. Run after the existing migrations. */

IF OBJECT_ID(N'dbo.MassIntentions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MassIntentions (
        MassIntentionId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MassIntentions PRIMARY KEY,
        IntentionDate DATE NOT NULL,
        IntentionTime VARCHAR(10) NOT NULL,
        Offering DECIMAL(12,2) NOT NULL CONSTRAINT DF_MassIntentions_Offering DEFAULT (0),
        RequestedBy NVARCHAR(200) NOT NULL,
        IntentionText NVARCHAR(1000) NOT NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_MassIntentions_Status DEFAULT ('Scheduled'),
        CreatedBy NVARCHAR(256) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassIntentions_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassIntentions_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_MassIntentions_DateTime ON dbo.MassIntentions (IntentionDate, IntentionTime);
END;

IF OBJECT_ID(N'dbo.FinancialEntries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinancialEntries (
        FinancialEntryId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FinancialEntries PRIMARY KEY,
        EntryDate DATE NOT NULL,
        EntryType VARCHAR(30) NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        Amount DECIMAL(12,2) NOT NULL,
        ReferenceType VARCHAR(30) NULL,
        ReferenceId INT NULL,
        EnteredBy NVARCHAR(256) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntries_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntries_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );
    CREATE INDEX IX_FinancialEntries_DateType ON dbo.FinancialEntries (EntryDate, EntryType);
END;

IF OBJECT_ID(N'dbo.ApplicationEditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApplicationEditLog (
        ApplicationEditLogId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ApplicationEditLog PRIMARY KEY,
        ServiceRequestId INT NOT NULL,
        ChangedBy NVARCHAR(256) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_ApplicationEditLog_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Changes NVARCHAR(MAX) NOT NULL
    );
    CREATE INDEX IX_ApplicationEditLog_Request ON dbo.ApplicationEditLog (ServiceRequestId, ChangedAt DESC);
END;

IF COL_LENGTH(N'dbo.ServiceRequest', N'AttendanceStatus') IS NULL
    ALTER TABLE dbo.ServiceRequest ADD AttendanceStatus VARCHAR(30) NULL;

IF COL_LENGTH(N'dbo.ServiceRequest', N'AttendanceMarkedAt') IS NULL
    ALTER TABLE dbo.ServiceRequest ADD AttendanceMarkedAt DATETIME2 NULL;

IF COL_LENGTH(N'dbo.ServiceRequest', N'VoidedAt') IS NULL
    ALTER TABLE dbo.ServiceRequest ADD VoidedAt DATETIME2 NULL;

/* Use a stored key rather than a persisted computed column. SQL Server treats
   some date/time-to-string conversions as non-deterministic in computed columns. */
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ServiceRequest')
      AND name = N'ActiveSlotKey'
      AND is_computed = 1
)
    ALTER TABLE dbo.ServiceRequest DROP COLUMN ActiveSlotKey;

IF COL_LENGTH(N'dbo.ServiceRequest', N'ActiveSlotKey') IS NULL
    ALTER TABLE dbo.ServiceRequest ADD ActiveSlotKey NVARCHAR(100) NULL;

EXEC sys.sp_executesql N'
    UPDATE dbo.ServiceRequest
    SET ActiveSlotKey = CASE WHEN Status IN (''PendingVerification'', ''Confirmed'')
        THEN CONVERT(NVARCHAR(20), ServiceId) + N''|'' + CONVERT(NVARCHAR(10), ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), ScheduledTime, 108)
        ELSE NULL END;';

IF OBJECT_ID(N'dbo.trg_ServiceRequest_ActiveSlotKey', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_ServiceRequest_ActiveSlotKey;

EXEC sys.sp_executesql N'
    CREATE TRIGGER dbo.trg_ServiceRequest_ActiveSlotKey
    ON dbo.ServiceRequest
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE sr
        SET ActiveSlotKey = CASE WHEN sr.Status IN (''PendingVerification'', ''Confirmed'')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N''|'' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END
        FROM dbo.ServiceRequest sr
        INNER JOIN inserted i ON i.ServiceRequestId = sr.ServiceRequestId
        WHERE ISNULL(sr.ActiveSlotKey, N'''') <> ISNULL(CASE WHEN sr.Status IN (''PendingVerification'', ''Confirmed'')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N''|'' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END, N'''');
    END;';

/* Preserve the first request in any already-overbooked slot and void later
   duplicates before the unique index is created. Applicant records remain
   available for review through their ConflictVoided status. */
EXEC sys.sp_executesql N'
    ;WITH DuplicateSlots AS (
        SELECT ServiceRequestId,
               ROW_NUMBER() OVER (PARTITION BY ActiveSlotKey ORDER BY CreatedAt, ServiceRequestId) AS SlotOrder
        FROM dbo.ServiceRequest
        WHERE ActiveSlotKey IS NOT NULL
    )
    UPDATE sr
    SET Status = ''ConflictVoided'',
        VoidedAt = SYSUTCDATETIME()
    FROM dbo.ServiceRequest sr
    INNER JOIN DuplicateSlots d ON d.ServiceRequestId = sr.ServiceRequestId
    WHERE d.SlotOrder > 1;';

IF COL_LENGTH(N'dbo.ServiceRequest', N'ActiveSlotKey') IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_ServiceRequest_ActiveSlot' AND object_id = OBJECT_ID(N'dbo.ServiceRequest'))
BEGIN
    EXEC sys.sp_executesql N'
        CREATE UNIQUE INDEX UX_ServiceRequest_ActiveSlot
            ON dbo.ServiceRequest (ActiveSlotKey)
            WHERE ActiveSlotKey IS NOT NULL;';
END;

PRINT 'Administrative operations migration completed successfully.';