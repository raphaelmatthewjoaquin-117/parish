/* Sacramental Records Digital Ledger & Archives. Run once against ParishDB. */

-- ============================================================
-- BAPTISM RECORDS
-- ============================================================
IF OBJECT_ID(N'dbo.BaptismRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BaptismRecords (
        BaptismId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_BaptismRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(50) NOT NULL,
        ChildFirstName NVARCHAR(100) NOT NULL,
        ChildMiddleName NVARCHAR(100) NULL,
        ChildLastName NVARCHAR(100) NOT NULL,
        DateOfBirth DATE NOT NULL,
        PlaceOfBirth NVARCHAR(200) NULL,
        DateOfBaptism DATE NOT NULL,
        FatherFullName NVARCHAR(200) NULL,
        MotherFullName NVARCHAR(200) NULL,
        MinisterName NVARCHAR(200) NOT NULL,
        Sponsors NVARCHAR(MAX) NULL,
        Remarks NVARCHAR(MAX) NULL,
        ScannedDocumentUrl NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BaptismRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_BaptismRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(256) NOT NULL
    );

    CREATE UNIQUE INDEX IX_BaptismRecords_RegistryNumber
        ON dbo.BaptismRecords (RegistryNumber);

    CREATE INDEX IX_BaptismRecords_DateOfBaptism
        ON dbo.BaptismRecords (DateOfBaptism);

    CREATE INDEX IX_BaptismRecords_ChildName
        ON dbo.BaptismRecords (ChildLastName, ChildFirstName);
END;

-- ============================================================
-- CONFIRMATION RECORDS
-- ============================================================
IF OBJECT_ID(N'dbo.ConfirmationRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConfirmationRecords (
        ConfirmationId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ConfirmationRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(50) NOT NULL,
        CandidateFirstName NVARCHAR(100) NOT NULL,
        CandidateMiddleName NVARCHAR(100) NULL,
        CandidateLastName NVARCHAR(100) NOT NULL,
        DateOfBirth DATE NOT NULL,
        DateOfConfirmation DATE NOT NULL,
        FatherFullName NVARCHAR(200) NULL,
        MotherFullName NVARCHAR(200) NULL,
        SponsorName NVARCHAR(200) NULL,
        BishopOrMinister NVARCHAR(200) NOT NULL,
        ParishOfBaptism NVARCHAR(200) NULL,
        ScannedDocumentUrl NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ConfirmationRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ConfirmationRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(256) NOT NULL
    );

    CREATE UNIQUE INDEX IX_ConfirmationRecords_RegistryNumber
        ON dbo.ConfirmationRecords (RegistryNumber);

    CREATE INDEX IX_ConfirmationRecords_DateOfConfirmation
        ON dbo.ConfirmationRecords (DateOfConfirmation);

    CREATE INDEX IX_ConfirmationRecords_CandidateName
        ON dbo.ConfirmationRecords (CandidateLastName, CandidateFirstName);
END;

-- ============================================================
-- MARRIAGE RECORDS
-- ============================================================
IF OBJECT_ID(N'dbo.MarriageRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MarriageRecords (
        MarriageId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MarriageRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(50) NOT NULL,
        GroomFirstName NVARCHAR(100) NOT NULL,
        GroomMiddleName NVARCHAR(100) NULL,
        GroomLastName NVARCHAR(100) NOT NULL,
        GroomAge INT NULL,
        GroomParents NVARCHAR(200) NULL,
        BrideFirstName NVARCHAR(100) NOT NULL,
        BrideMiddleName NVARCHAR(100) NULL,
        BrideLastName NVARCHAR(100) NOT NULL,
        BrideAge INT NULL,
        BrideParents NVARCHAR(200) NULL,
        DateOfMarriage DATE NOT NULL,
        Witnesses NVARCHAR(MAX) NULL,
        SolemnizingPriest NVARCHAR(200) NOT NULL,
        ScannedDocumentUrl NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MarriageRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MarriageRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(256) NOT NULL
    );

    CREATE UNIQUE INDEX IX_MarriageRecords_RegistryNumber
        ON dbo.MarriageRecords (RegistryNumber);

    CREATE INDEX IX_MarriageRecords_DateOfMarriage
        ON dbo.MarriageRecords (DateOfMarriage);

    CREATE INDEX IX_MarriageRecords_GroomBrideName
        ON dbo.MarriageRecords (GroomLastName, BrideLastName);
END;

-- ============================================================
-- DEATH RECORDS
-- ============================================================
IF OBJECT_ID(N'dbo.DeathRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DeathRecords (
        DeathId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeathRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(50) NOT NULL,
        DeceasedFirstName NVARCHAR(100) NOT NULL,
        DeceasedMiddleName NVARCHAR(100) NULL,
        DeceasedLastName NVARCHAR(100) NOT NULL,
        Age INT NULL,
        DateOfDeath DATE NOT NULL,
        DateOfBurial DATE NULL,
        CauseOfDeath NVARCHAR(200) NULL,
        PlaceOfBurial NVARCHAR(200) NULL,
        SacramentsReceived NVARCHAR(500) NULL,
        OfficiatingPriest NVARCHAR(200) NOT NULL,
        ScannedDocumentUrl NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DeathRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DeathRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(256) NOT NULL
    );

    CREATE UNIQUE INDEX IX_DeathRecords_RegistryNumber
        ON dbo.DeathRecords (RegistryNumber);

    CREATE INDEX IX_DeathRecords_DateOfDeath
        ON dbo.DeathRecords (DateOfDeath);

    CREATE INDEX IX_DeathRecords_DeceasedName
        ON dbo.DeathRecords (DeceasedLastName, DeceasedFirstName);
END;

-- ============================================================
-- SACRAMENTAL ARCHIVES (Scanned Ledger Pages / Documents)
-- ============================================================
IF OBJECT_ID(N'dbo.SacramentalArchives', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SacramentalArchives (
        ArchiveId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SacramentalArchives PRIMARY KEY,
        SacramentType VARCHAR(30) NOT NULL,
        BookNumber INT NOT NULL,
        PageNumber INT NOT NULL,
        FileUrl NVARCHAR(1000) NOT NULL,
        Notes NVARCHAR(MAX) NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_SacramentalArchives_UploadedAt DEFAULT (SYSUTCDATETIME()),
        UploadedBy NVARCHAR(256) NOT NULL
    );

    CREATE INDEX IX_SacramentalArchives_SacramentType
        ON dbo.SacramentalArchives (SacramentType);

    CREATE INDEX IX_SacramentalArchives_BookPage
        ON dbo.SacramentalArchives (SacramentType, BookNumber, PageNumber);
END;

-- ============================================================
-- UPDATE TRIGGERS FOR UpdatedAt TIMESTAMPS
-- ============================================================

-- BaptismRecords
IF OBJECT_ID(N'trg_BaptismRecords_UpdatedAt', N'TR') IS NOT NULL
    DROP TRIGGER trg_BaptismRecords_UpdatedAt;
GO

CREATE TRIGGER trg_BaptismRecords_UpdatedAt
ON dbo.BaptismRecords
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE br
    SET br.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.BaptismRecords br
    INNER JOIN inserted i ON br.BaptismId = i.BaptismId;
END;
GO

-- ConfirmationRecords
IF OBJECT_ID(N'trg_ConfirmationRecords_UpdatedAt', N'TR') IS NOT NULL
    DROP TRIGGER trg_ConfirmationRecords_UpdatedAt;
GO

CREATE TRIGGER trg_ConfirmationRecords_UpdatedAt
ON dbo.ConfirmationRecords
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE cr
    SET cr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.ConfirmationRecords cr
    INNER JOIN inserted i ON cr.ConfirmationId = i.ConfirmationId;
END;
GO

-- MarriageRecords
IF OBJECT_ID(N'trg_MarriageRecords_UpdatedAt', N'TR') IS NOT NULL
    DROP TRIGGER trg_MarriageRecords_UpdatedAt;
GO

CREATE TRIGGER trg_MarriageRecords_UpdatedAt
ON dbo.MarriageRecords
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE mr
    SET mr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.MarriageRecords mr
    INNER JOIN inserted i ON mr.MarriageId = i.MarriageId;
END;
GO

-- DeathRecords
IF OBJECT_ID(N'trg_DeathRecords_UpdatedAt', N'TR') IS NOT NULL
    DROP TRIGGER trg_DeathRecords_UpdatedAt;
GO

CREATE TRIGGER trg_DeathRecords_UpdatedAt
ON dbo.DeathRecords
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dr
    SET dr.UpdatedAt = SYSUTCDATETIME()
    FROM dbo.DeathRecords dr
    INNER JOIN inserted i ON dr.DeathId = i.DeathId;
END;
GO

PRINT 'Sacramental Records migration completed successfully.';