/*
  Current database baseline snapshot for the parish application.

  This file is intentionally a restartable, schema-first baseline derived from the
  current database definition observed in the project. It is meant to be used as a
  clean rebuild starting point, not as a replacement for the historical migration
  sequence already kept in this folder.

  Use carefully: on an existing database, it should be run only against a fresh or
  intentionally empty database. Existing data will be affected.
*/

SET NOCOUNT ON;

-- ============================================
-- Core account and identity tables
-- ============================================
IF OBJECT_ID(N'dbo.AspNetRoles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AspNetRoles (
        RoleId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_AspNetRoles PRIMARY KEY,
        Name NVARCHAR(510) NOT NULL,
        NormalizedName NVARCHAR(900) NULL
    );
END;

IF OBJECT_ID(N'dbo.AspNetUsers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AspNetUsers (
        UserId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_AspNetUsers PRIMARY KEY,
        UserName NVARCHAR(256) NOT NULL,
        EmailAddress NVARCHAR(510) NOT NULL,
        EmailConfirmed BIT NOT NULL CONSTRAINT DF_AspNetUsers_EmailConfirmed DEFAULT ((0)),
        PasswordHash NVARCHAR(1024) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AspNetUsers_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

IF OBJECT_ID(N'dbo.AspNetUserRoles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AspNetUserRoles (
        UserId INT NOT NULL,
        RoleId INT NOT NULL,
        CONSTRAINT PK_AspNetUserRoles PRIMARY KEY (UserId, RoleId)
    );
END;

-- ============================================
-- Parishioner and portal tables
-- ============================================
IF OBJECT_ID(N'dbo.Parishioners', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Parishioners (
        ParishionerId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Parishioners PRIMARY KEY,
        FirstName NVARCHAR(510) NOT NULL,
        LastName NVARCHAR(510) NOT NULL,
        EmailAddress NVARCHAR(510) NULL,
        MobileNumber NVARCHAR(100) NULL,
        Address NVARCHAR(510) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Parishioners_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

IF OBJECT_ID(N'dbo.ParishionerAccounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishionerAccounts (
        AccountId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ParishionerAccounts PRIMARY KEY,
        ParishionerId INT NOT NULL CONSTRAINT UQ_ParishionerAccounts_Parishioner UNIQUE,
        EmailAddress VARCHAR(255) NOT NULL CONSTRAINT UQ_ParishionerAccounts_Email UNIQUE,
        PasswordHash NVARCHAR(1000) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ParishionerAccounts_IsActive DEFAULT ((1)),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ParishionerAccounts_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastLoginAt DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.ParishionerPortalSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishionerPortalSessions (
        SessionToken VARCHAR(64) NOT NULL CONSTRAINT PK_ParishionerPortalSessions PRIMARY KEY,
        AccountId INT NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ParishionerPortalSessions_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

-- ============================================
-- Staff and priest data
-- ============================================
IF OBJECT_ID(N'dbo.Position', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Position (
        PositionId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Position PRIMARY KEY,
        Name NVARCHAR(510) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Employees (
        EmployeeId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Employees PRIMARY KEY,
        UserId INT NOT NULL,
        FirstName NVARCHAR(510) NOT NULL,
        LastName NVARCHAR(510) NOT NULL,
        MobileNumber NVARCHAR(100) NULL,
        Address NVARCHAR(510) NULL,
        DateOfBirth DATE NULL,
        PositionId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Employees_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.Priest', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Priest (
        PriestId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Priest PRIMARY KEY,
        UserId INT NOT NULL,
        Name NVARCHAR(510) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Priest_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

-- ============================================
-- Services and requests
-- ============================================
IF OBJECT_ID(N'dbo.Service', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Service (
        ServiceId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Service PRIMARY KEY,
        Name NVARCHAR(510) NOT NULL,
        Description NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.ServiceRequest', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ServiceRequest (
        ServiceRequestId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ServiceRequest PRIMARY KEY,
        ParishionerId INT NOT NULL,
        ServiceId INT NOT NULL,
        PriestId INT NULL,
        RequestDate DATETIME2 NOT NULL CONSTRAINT DF_ServiceRequest_RequestDate DEFAULT (SYSUTCDATETIME()),
        ScheduledDate DATE NULL,
        ScheduledTime TIME NULL,
        Venue NVARCHAR(510) NULL,
        Status NVARCHAR(200) NOT NULL CONSTRAINT DF_ServiceRequest_Status DEFAULT ('Pending'),
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ServiceRequest_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ContactFirstName NVARCHAR(200) NULL,
        ContactLastName NVARCHAR(200) NULL,
        ContactEmail NVARCHAR(510) NULL,
        ContactMobile NVARCHAR(40) NULL,
        ContactAddress NVARCHAR(MAX) NULL,
        AttendanceStatus VARCHAR(30) NULL,
        AttendanceMarkedAt DATETIME2 NULL,
        VoidedAt DATETIME2 NULL,
        ActiveSlotKey NVARCHAR(200) NULL
    );
END;

IF OBJECT_ID(N'dbo.ApplicationEditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApplicationEditLog (
        ApplicationEditLogId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ApplicationEditLog PRIMARY KEY,
        ServiceRequestId INT NOT NULL,
        ChangedBy NVARCHAR(512) NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_ApplicationEditLog_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Changes NVARCHAR(MAX) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.VerificationTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VerificationTokens (
        TokenId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_VerificationTokens PRIMARY KEY,
        Token VARCHAR(64) NOT NULL CONSTRAINT UQ_VerificationTokens_Token UNIQUE,
        ServiceRequestId INT NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        Used BIT NOT NULL CONSTRAINT DF_VerificationTokens_Used DEFAULT ((0)),
        UsedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_VerificationTokens_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

-- ============================================
-- Mass and event management
-- ============================================
IF OBJECT_ID(N'dbo.MassSchedule', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MassSchedule (
        MassScheduleId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_MassSchedule PRIMARY KEY,
        Title NVARCHAR(400) NOT NULL,
        MassDate DATE NOT NULL,
        MassTime VARCHAR(10) NOT NULL,
        Location NVARCHAR(510) NOT NULL,
        PriestUsername VARCHAR(256) NOT NULL,
        Notes NVARCHAR(2000) NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_MassSchedule_Status DEFAULT ('Scheduled'),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassSchedule_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassSchedule_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

IF OBJECT_ID(N'dbo.Events', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Events (
        EventId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_Events PRIMARY KEY,
        Title NVARCHAR(510) NOT NULL,
        TitleTl NVARCHAR(510) NULL,
        Description NVARCHAR(MAX) NULL,
        DescriptionTl NVARCHAR(MAX) NULL,
        Body NVARCHAR(MAX) NULL,
        BodyTl NVARCHAR(MAX) NULL,
        EventDate DATE NULL,
        EventTime TIME NULL,
        Location NVARCHAR(510) NULL,
        LocationTl NVARCHAR(510) NULL,
        CreatedBy INT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Events_CreatedAt DEFAULT (SYSUTCDATETIME()),
        PhotoUrl NVARCHAR(2000) NULL
    );
END;

-- ============================================
-- Church records and sacramental tables
-- ============================================
IF OBJECT_ID(N'dbo.BaptismRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BaptismRecords (
        BaptismId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_BaptismRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(100) NOT NULL,
        ChildFirstName NVARCHAR(200) NOT NULL,
        ChildMiddleName NVARCHAR(200) NULL,
        ChildLastName NVARCHAR(200) NOT NULL,
        DateOfBirth DATE NOT NULL,
        PlaceOfBirth NVARCHAR(400) NULL,
        DateOfBaptism DATE NOT NULL,
        FatherFullName NVARCHAR(400) NULL,
        MotherFullName NVARCHAR(400) NULL,
        MinisterName NVARCHAR(400) NOT NULL,
        Sponsors NVARCHAR(MAX) NULL,
        Remarks NVARCHAR(MAX) NULL,
        ScannedDocumentUrl NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BaptismRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_BaptismRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(512) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.ConfirmationRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConfirmationRecords (
        ConfirmationId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ConfirmationRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(100) NOT NULL,
        CandidateFirstName NVARCHAR(200) NOT NULL,
        CandidateMiddleName NVARCHAR(200) NULL,
        CandidateLastName NVARCHAR(200) NOT NULL,
        DateOfBirth DATE NOT NULL,
        DateOfConfirmation DATE NOT NULL,
        FatherFullName NVARCHAR(400) NULL,
        MotherFullName NVARCHAR(400) NULL,
        SponsorName NVARCHAR(400) NULL,
        BishopOrMinister NVARCHAR(400) NOT NULL,
        ParishOfBaptism NVARCHAR(400) NULL,
        ScannedDocumentUrl NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ConfirmationRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_ConfirmationRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(512) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.MarriageRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MarriageRecords (
        MarriageId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_MarriageRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(100) NOT NULL,
        GroomFirstName NVARCHAR(200) NOT NULL,
        GroomMiddleName NVARCHAR(200) NULL,
        GroomLastName NVARCHAR(200) NOT NULL,
        GroomAge INT NULL,
        GroomParents NVARCHAR(400) NULL,
        BrideFirstName NVARCHAR(200) NOT NULL,
        BrideMiddleName NVARCHAR(200) NULL,
        BrideLastName NVARCHAR(200) NOT NULL,
        BrideAge INT NULL,
        BrideParents NVARCHAR(400) NULL,
        DateOfMarriage DATE NOT NULL,
        Witnesses NVARCHAR(MAX) NULL,
        SolemnizingPriest NVARCHAR(400) NOT NULL,
        ScannedDocumentUrl NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MarriageRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MarriageRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(512) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.DeathRecords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DeathRecords (
        DeathId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_DeathRecords PRIMARY KEY,
        RegistryNumber NVARCHAR(100) NOT NULL,
        DeceasedFirstName NVARCHAR(200) NOT NULL,
        DeceasedMiddleName NVARCHAR(200) NULL,
        DeceasedLastName NVARCHAR(200) NOT NULL,
        Age INT NULL,
        DateOfDeath DATE NOT NULL,
        DateOfBurial DATE NULL,
        CauseOfDeath NVARCHAR(400) NULL,
        PlaceOfBurial NVARCHAR(400) NULL,
        SacramentsReceived NVARCHAR(1000) NULL,
        OfficiatingPriest NVARCHAR(400) NOT NULL,
        ScannedDocumentUrl NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_DeathRecords_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_DeathRecords_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy NVARCHAR(512) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.SacramentalArchives', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SacramentalArchives (
        ArchiveId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_SacramentalArchives PRIMARY KEY,
        SacramentType VARCHAR(30) NOT NULL,
        BookNumber INT NOT NULL,
        PageNumber INT NOT NULL,
        FileUrl NVARCHAR(2000) NOT NULL,
        Notes NVARCHAR(MAX) NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_SacramentalArchives_UploadedAt DEFAULT (SYSUTCDATETIME()),
        UploadedBy NVARCHAR(512) NOT NULL
    );
END;

IF OBJECT_ID(N'dbo.SacramentalRecordAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SacramentalRecordAudit (
        AuditId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_SacramentalRecordAudit PRIMARY KEY,
        RecordType VARCHAR(30) NOT NULL,
        RecordId INT NOT NULL,
        ActionName VARCHAR(20) NOT NULL,
        ChangedBy NVARCHAR(512) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_SacramentalRecordAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Changes NVARCHAR(MAX) NULL
    );
END;

-- ============================================
-- Finance tables
-- ============================================
IF OBJECT_ID(N'dbo.FinancialEntries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinancialEntries (
        FinancialEntryId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_FinancialEntries PRIMARY KEY,
        EntryDate DATE NOT NULL,
        EntryType VARCHAR(30) NOT NULL,
        Description NVARCHAR(1000) NOT NULL,
        Amount DECIMAL(9,0) NOT NULL,
        ReferenceType VARCHAR(30) NULL,
        ReferenceId INT NULL,
        EnteredBy NVARCHAR(512) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntries_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntries_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_FinancialEntries_Status DEFAULT ('Draft'),
        ApprovedBy NVARCHAR(512) NULL,
        ApprovedAt DATETIME2 NULL,
        ReconciledBy NVARCHAR(512) NULL,
        ReconciledAt DATETIME2 NULL
    );
END;

IF OBJECT_ID(N'dbo.FinancialEntryAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinancialEntryAudit (
        AuditId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_FinancialEntryAudit PRIMARY KEY,
        FinancialEntryId INT NOT NULL,
        ActionName VARCHAR(30) NOT NULL,
        ChangedBy NVARCHAR(512) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntryAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Details NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.FinanceReportSnapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinanceReportSnapshots (
        FinanceReportSnapshotId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_FinanceReportSnapshots PRIMARY KEY,
        ReportType VARCHAR(20) NOT NULL,
        PeriodStart DATE NOT NULL,
        PeriodEnd DATE NOT NULL,
        TotalIncome DECIMAL(14,2) NOT NULL,
        TotalExpenses DECIMAL(14,2) NOT NULL,
        NetTotal DECIMAL(14,2) NOT NULL,
        Details NVARCHAR(MAX) NOT NULL,
        GeneratedAt DATETIME2 NOT NULL CONSTRAINT DF_FinanceReportSnapshots_GeneratedAt DEFAULT (SYSUTCDATETIME()),
        GeneratedBy NVARCHAR(512) NOT NULL
    );
END;

-- ============================================
-- Prayer and updates
-- ============================================
IF OBJECT_ID(N'dbo.PrayerRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PrayerRequests (
        PrayerId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_PrayerRequests PRIMARY KEY,
        Name NVARCHAR(510) NULL,
        Category NVARCHAR(100) NULL,
        Request NVARCHAR(MAX) NULL,
        Anonymous BIT NULL CONSTRAINT DF_PrayerRequests_Anonymous DEFAULT ((0)),
        ShareWithCommunity BIT NULL CONSTRAINT DF_PrayerRequests_ShareWithCommunity DEFAULT ((0)),
        IsApproved BIT NULL CONSTRAINT DF_PrayerRequests_IsApproved DEFAULT ((0)),
        CreatedAt DATETIME NULL CONSTRAINT DF_PrayerRequests_CreatedAt DEFAULT (GETDATE())
    );
END;

-- ============================================
-- Certificate requests and documents
-- ============================================
IF OBJECT_ID(N'dbo.CertificateRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CertificateRequests (
        CertificateRequestId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_CertificateRequests PRIMARY KEY,
        AccountId INT NULL,
        CertificateType VARCHAR(30) NOT NULL,
        PreferredDate DATE NOT NULL,
        PreferredTime VARCHAR(10) NOT NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_CertificateRequests_Status DEFAULT ('Requested'),
        Notes NVARCHAR(2000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequests_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequests_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        ContactEmail VARCHAR(255) NULL,
        ContactPhone VARCHAR(50) NULL,
        FirstName NVARCHAR(200) NULL,
        LastName NVARCHAR(200) NULL,
        ReferenceCode VARCHAR(10) NULL
    );
END;

IF OBJECT_ID(N'dbo.CertificateRequestDocuments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CertificateRequestDocuments (
        CertificateRequestDocumentId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_CertificateRequestDocuments PRIMARY KEY,
        CertificateRequestId INT NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        StoredFileName NVARCHAR(255) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        MimeType VARCHAR(100) NOT NULL,
        FileSizeBytes INT NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequestDocuments_UploadedAt DEFAULT (SYSUTCDATETIME())
    );
END;

-- ============================================
-- Administrative audit tables
-- ============================================
IF OBJECT_ID(N'dbo.UserManagementAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserManagementAudit (
        AuditId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_UserManagementAudit PRIMARY KEY,
        ActionName VARCHAR(40) NOT NULL,
        TargetUserId INT NULL,
        TargetUserName NVARCHAR(512) NULL,
        ChangedBy NVARCHAR(512) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_UserManagementAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Details NVARCHAR(MAX) NULL
    );
END;

-- ============================================
-- Optional indexes for the current baseline
-- ============================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CertificateRequests') AND name = N'UQ_CertificateRequests_RefCode')
BEGIN
    CREATE UNIQUE INDEX UQ_CertificateRequests_RefCode
        ON dbo.CertificateRequests (ReferenceCode)
        WHERE ReferenceCode IS NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CertificateRequests') AND name = N'IX_CertificateRequests_EmailRef')
BEGIN
    CREATE INDEX IX_CertificateRequests_EmailRef
        ON dbo.CertificateRequests (ContactEmail, ReferenceCode)
        WHERE ContactEmail IS NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.CertificateRequestDocuments') AND name = N'IX_CertificateRequestDocuments_Request')
BEGIN
    CREATE INDEX IX_CertificateRequestDocuments_Request
        ON dbo.CertificateRequestDocuments (CertificateRequestId, UploadedAt DESC);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ParishionerPortalSessions') AND name = N'IX_ParishionerPortalSessions_Account')
BEGIN
    CREATE INDEX IX_ParishionerPortalSessions_Account
        ON dbo.ParishionerPortalSessions (AccountId, ExpiresAt);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ParishionerAccounts') AND name = N'IX_ParishionerAccounts_Email')
BEGIN
    CREATE INDEX IX_ParishionerAccounts_Email
        ON dbo.ParishionerAccounts (EmailAddress);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ServiceRequest') AND name = N'IX_ServiceRequest_StatusDate')
BEGIN
    CREATE INDEX IX_ServiceRequest_StatusDate
        ON dbo.ServiceRequest (Status, ScheduledDate, ScheduledTime);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.MassSchedule') AND name = N'IX_MassSchedule_PriestDate')
BEGIN
    CREATE INDEX IX_MassSchedule_PriestDate
        ON dbo.MassSchedule (PriestUsername, MassDate, MassTime);
END;

PRINT 'Current schema baseline complete.';
