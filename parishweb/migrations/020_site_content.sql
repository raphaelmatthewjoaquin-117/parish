IF OBJECT_ID(N'dbo.SiteContent', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SiteContent (
        ContentKey NVARCHAR(50) NOT NULL CONSTRAINT PK_SiteContent PRIMARY KEY,
        ContentJson NVARCHAR(MAX) NOT NULL,
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_SiteContent_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy NVARCHAR(256) NULL
    );
END;
