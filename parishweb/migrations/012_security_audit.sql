/* Security events, including time-limited emergency access overrides. */

IF OBJECT_ID(N'dbo.SecurityAuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SecurityAuditLog (
        SecurityAuditId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SecurityAuditLog PRIMARY KEY,
        EventType VARCHAR(40) NOT NULL,
        ActorUserName NVARCHAR(256) NOT NULL,
        TargetUserName NVARCHAR(256) NULL,
        Reason NVARCHAR(1000) NULL,
        ExpiresAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_SecurityAuditLog_CreatedAt DEFAULT (SYSUTCDATETIME()),
        Details NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_SecurityAuditLog_CreatedAt
        ON dbo.SecurityAuditLog (CreatedAt DESC);
END;

PRINT 'Security audit migration completed successfully.';
