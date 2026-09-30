IF COL_LENGTH(N'dbo.Events', N'Description') IS NULL
BEGIN
    ALTER TABLE dbo.Events ADD Description NVARCHAR(MAX) NULL;
END;
GO