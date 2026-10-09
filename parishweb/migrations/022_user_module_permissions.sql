/* Per-account module permission overrides and forced password change. */

IF COL_LENGTH(N'dbo.AspNetUsers', N'MustChangePassword') IS NULL
BEGIN
    ALTER TABLE dbo.AspNetUsers
        ADD MustChangePassword BIT NOT NULL CONSTRAINT DF_AspNetUsers_MustChangePassword DEFAULT (0);
END;

IF OBJECT_ID(N'dbo.UserModulePermissions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserModulePermissions (
        UserId     INT           NOT NULL,
        ModuleName NVARCHAR(50)  NOT NULL,
        CanView    BIT           NOT NULL CONSTRAINT DF_UserModulePermissions_CanView DEFAULT (0),
        CanEdit    BIT           NOT NULL CONSTRAINT DF_UserModulePermissions_CanEdit DEFAULT (0),
        UpdatedAt  DATETIME2     NOT NULL CONSTRAINT DF_UserModulePermissions_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy  NVARCHAR(512) NULL,
        CONSTRAINT PK_UserModulePermissions PRIMARY KEY (UserId, ModuleName),
        CONSTRAINT FK_UserModulePermissions_User FOREIGN KEY (UserId) REFERENCES dbo.AspNetUsers (UserId) ON DELETE CASCADE
    );
END;

PRINT 'User module permissions migration completed successfully.';
