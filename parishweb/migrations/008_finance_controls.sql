/* Finance workflow: expenses, approvals, reconciliation, and audit history. */

IF COL_LENGTH(N'dbo.FinancialEntries', N'Status') IS NULL
    ALTER TABLE dbo.FinancialEntries ADD Status VARCHAR(30) NOT NULL CONSTRAINT DF_FinancialEntries_Status DEFAULT ('Draft');

IF COL_LENGTH(N'dbo.FinancialEntries', N'ApprovedBy') IS NULL
    ALTER TABLE dbo.FinancialEntries ADD ApprovedBy NVARCHAR(256) NULL;

IF COL_LENGTH(N'dbo.FinancialEntries', N'ApprovedAt') IS NULL
    ALTER TABLE dbo.FinancialEntries ADD ApprovedAt DATETIME2 NULL;

IF COL_LENGTH(N'dbo.FinancialEntries', N'ReconciledBy') IS NULL
    ALTER TABLE dbo.FinancialEntries ADD ReconciledBy NVARCHAR(256) NULL;

IF COL_LENGTH(N'dbo.FinancialEntries', N'ReconciledAt') IS NULL
    ALTER TABLE dbo.FinancialEntries ADD ReconciledAt DATETIME2 NULL;

IF OBJECT_ID(N'dbo.FinancialEntryAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinancialEntryAudit (
        AuditId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FinancialEntryAudit PRIMARY KEY,
        FinancialEntryId INT NOT NULL,
        ActionName VARCHAR(30) NOT NULL,
        ChangedBy NVARCHAR(256) NOT NULL,
        ChangedAt DATETIME2 NOT NULL CONSTRAINT DF_FinancialEntryAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        Details NVARCHAR(MAX) NULL
    );

    CREATE INDEX IX_FinancialEntryAudit_Entry
        ON dbo.FinancialEntryAudit (FinancialEntryId, ChangedAt DESC);
END;

PRINT 'Finance controls migration completed successfully.';
