IF COL_LENGTH('dbo.Events', 'PhotoUrl') IS NULL
BEGIN
    ALTER TABLE dbo.Events
    ADD PhotoUrl NVARCHAR(1000) NULL;

    PRINT 'PhotoUrl column added to Events';
END
ELSE
BEGIN
    PRINT 'PhotoUrl column already exists';
END;