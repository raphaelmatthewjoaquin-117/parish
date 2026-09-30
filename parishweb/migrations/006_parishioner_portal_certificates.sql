/* Parishioner portal accounts and certificate appointment requests. */

IF OBJECT_ID(N'dbo.ParishionerAccounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishionerAccounts (
        AccountId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ParishionerAccounts PRIMARY KEY,
        ParishionerId INT NOT NULL CONSTRAINT UQ_ParishionerAccounts_Parishioner UNIQUE,
        EmailAddress VARCHAR(255) NOT NULL CONSTRAINT UQ_ParishionerAccounts_Email UNIQUE,
        PasswordHash NVARCHAR(500) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ParishionerAccounts_IsActive DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ParishionerAccounts_CreatedAt DEFAULT (SYSUTCDATETIME()),
        LastLoginAt DATETIME2 NULL
    );

    CREATE INDEX IX_ParishionerAccounts_Email
        ON dbo.ParishionerAccounts (EmailAddress);
END;

IF OBJECT_ID(N'dbo.ParishionerPortalSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishionerPortalSessions (
        SessionToken VARCHAR(64) NOT NULL CONSTRAINT PK_ParishionerPortalSessions PRIMARY KEY,
        AccountId INT NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ParishionerPortalSessions_CreatedAt DEFAULT (SYSUTCDATETIME())
    );

    CREATE INDEX IX_ParishionerPortalSessions_Account
        ON dbo.ParishionerPortalSessions (AccountId, ExpiresAt);
END;

IF OBJECT_ID(N'dbo.CertificateRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CertificateRequests (
        CertificateRequestId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CertificateRequests PRIMARY KEY,
        AccountId INT NOT NULL,
        CertificateType VARCHAR(30) NOT NULL,
        PreferredDate DATE NOT NULL,
        PreferredTime VARCHAR(10) NOT NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_CertificateRequests_Status DEFAULT ('Requested'),
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequests_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequests_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );

    CREATE INDEX IX_CertificateRequests_Account
        ON dbo.CertificateRequests (AccountId, CreatedAt DESC);

    CREATE INDEX IX_CertificateRequests_Appointment
        ON dbo.CertificateRequests (PreferredDate, PreferredTime, Status);
END;

PRINT 'Parishioner portal and certificate request migration completed successfully.';
