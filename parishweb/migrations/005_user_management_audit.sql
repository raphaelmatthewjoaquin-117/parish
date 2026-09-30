/* User and role management audit trail. Run after the existing migrations. */

IF OBJECT_ID(N'dbo.UserManagementAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserManagementAudit (
        AuditId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UserManagementAudit PRIMARY KEY,
        ActionName VARCHAR(40) NOT NULL,
        TargetUserId INT NULL,
        TargetUserName NVARCHAR(256) NULL,
        ChangedBy NVARCHAR(256) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_UserManagementAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Details NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_UserManagementAudit_ChangedAt
        ON dbo.UserManagementAudit (ChangedAt DESC);

    CREATE INDEX IX_UserManagementAudit_TargetUser
        ON dbo.UserManagementAudit (TargetUserId, ChangedAt DESC);
END;

PRINT 'User management audit migration completed successfully.';
