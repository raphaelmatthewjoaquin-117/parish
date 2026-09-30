/* Audit history for sacramental ledger changes. */

IF OBJECT_ID(N'dbo.SacramentalRecordAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SacramentalRecordAudit (
        AuditId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SacramentalRecordAudit PRIMARY KEY,
        RecordType VARCHAR(30) NOT NULL,
        RecordId INT NOT NULL,
        ActionName VARCHAR(20) NOT NULL,
        ChangedBy NVARCHAR(256) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_SacramentalRecordAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Changes NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_SacramentalRecordAudit_Record
        ON dbo.SacramentalRecordAudit (RecordType, RecordId, ChangedAt DESC);
END;

PRINT 'Sacramental record audit migration completed successfully.';
