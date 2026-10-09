IF COL_LENGTH(N'dbo.Events', N'TitleTl') IS NULL
BEGIN
    ALTER TABLE dbo.Events ADD TitleTl NVARCHAR(510) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Events', N'DescriptionTl') IS NULL
BEGIN
    ALTER TABLE dbo.Events ADD DescriptionTl NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Events', N'BodyTl') IS NULL
BEGIN
    ALTER TABLE dbo.Events ADD BodyTl NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH(N'dbo.Events', N'LocationTl') IS NULL
BEGIN
    ALTER TABLE dbo.Events ADD LocationTl NVARCHAR(510) NULL;
END;
GO
