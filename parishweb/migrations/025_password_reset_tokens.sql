IF OBJECT_ID(N'dbo.PasswordResetTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PasswordResetTokens (
        PasswordResetTokenId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_PasswordResetTokens PRIMARY KEY,
        UserId INT NOT NULL,
        TokenHash CHAR(64) NOT NULL CONSTRAINT UQ_PasswordResetTokens_TokenHash UNIQUE,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_PasswordResetTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        CONSTRAINT FK_PasswordResetTokens_AspNetUsers FOREIGN KEY (UserId)
            REFERENCES dbo.AspNetUsers (UserId) ON DELETE CASCADE
    );
    CREATE INDEX IX_PasswordResetTokens_UserId ON dbo.PasswordResetTokens (UserId);
END;

PRINT 'Password reset token migration completed successfully.';
