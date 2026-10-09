IF OBJECT_ID(N'dbo.ContactMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ContactMessages (
        ContactMessageId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ContactMessages PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Email NVARCHAR(320) NOT NULL,
        Phone NVARCHAR(50) NULL,
        Message NVARCHAR(MAX) NOT NULL,
        IsRead BIT NOT NULL CONSTRAINT DF_ContactMessages_IsRead DEFAULT (0),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContactMessages_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;
