/* Adds a soft-disable flag for services so admins can hide offerings without deleting historical bookings. */

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Service') AND name = N'IsActive'
)
BEGIN
    ALTER TABLE dbo.Service ADD IsActive BIT NOT NULL CONSTRAINT DF_Service_IsActive DEFAULT (1);
END;

UPDATE dbo.Service SET IsActive = 0 WHERE Name = 'Anointing of the Sick';
