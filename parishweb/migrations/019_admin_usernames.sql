/* Store admin account usernames separately from email addresses. */

IF COL_LENGTH(N'dbo.AspNetUsers', N'UserName') IS NULL
BEGIN
    ALTER TABLE dbo.AspNetUsers ADD UserName NVARCHAR(256) NULL;
END;

EXEC sys.sp_executesql N'
    UPDATE dbo.AspNetUsers
    SET UserName = COALESCE(LEFT(NULLIF(LTRIM(RTRIM(EmailAddress)), N''''), 256), CONCAT(N''user-'', UserId))
    WHERE UserName IS NULL OR LTRIM(RTRIM(UserName)) = N'''';
';

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.AspNetUsers')
      AND name = N'UserName'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.AspNetUsers ALTER COLUMN UserName NVARCHAR(256) NOT NULL;
END;

PRINT 'Admin usernames migration completed successfully.';
