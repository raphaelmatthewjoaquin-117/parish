/* Admin-managed blocked dates/times for service and certificate appointments. */

IF OBJECT_ID(N'dbo.BlockedSlots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BlockedSlots (
        BlockedSlotId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_BlockedSlots PRIMARY KEY,
        BlockDate DATE NOT NULL,
        BlockTime VARCHAR(5) NULL,              -- NULL blocks the whole day
        Scope VARCHAR(20) NOT NULL,             -- All | Service | Certificate
        ServiceId INT NULL,                     -- required when Scope = Service
        Reason NVARCHAR(300) NULL,
        CreatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_BlockedSlots_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_BlockedSlots_Scope CHECK (Scope IN ('All', 'Service', 'Certificate')),
        CONSTRAINT CK_BlockedSlots_ServiceId CHECK ((Scope = 'Service' AND ServiceId IS NOT NULL) OR (Scope <> 'Service' AND ServiceId IS NULL))
    );
    CREATE INDEX IX_BlockedSlots_BlockDate ON dbo.BlockedSlots (BlockDate);
END;

PRINT 'Blocked slots migration completed successfully.';
