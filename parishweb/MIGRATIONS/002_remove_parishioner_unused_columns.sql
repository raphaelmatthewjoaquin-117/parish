-- Remove unused columns from Parishioners table
-- DateOfBirth and Gender are not used in the application

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Parishioners' AND COLUMN_NAME = 'DateOfBirth')
BEGIN
    ALTER TABLE dbo.Parishioners DROP COLUMN DateOfBirth;
    PRINT 'DateOfBirth column removed from Parishioners';
END
ELSE
BEGIN
    PRINT 'DateOfBirth column does not exist in Parishioners';
END;

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Parishioners' AND COLUMN_NAME = 'Gender')
BEGIN
    ALTER TABLE dbo.Parishioners DROP COLUMN Gender;
    PRINT 'Gender column removed from Parishioners';
END
ELSE
BEGIN
    PRINT 'Gender column does not exist in Parishioners';
END;