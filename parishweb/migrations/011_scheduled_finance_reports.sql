/* Persisted weekly and monthly finance report snapshots. */

IF OBJECT_ID(N'dbo.FinanceReportSnapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FinanceReportSnapshots (
        FinanceReportSnapshotId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_FinanceReportSnapshots PRIMARY KEY,
        ReportType VARCHAR(20) NOT NULL,
        PeriodStart DATE NOT NULL,
        PeriodEnd DATE NOT NULL,
        TotalIncome DECIMAL(14,2) NOT NULL,
        TotalExpenses DECIMAL(14,2) NOT NULL,
        NetTotal DECIMAL(14,2) NOT NULL,
        Details NVARCHAR(MAX) NOT NULL,
        GeneratedAt DATETIME2 NOT NULL CONSTRAINT DF_FinanceReportSnapshots_GeneratedAt DEFAULT (SYSUTCDATETIME()),
        GeneratedBy NVARCHAR(256) NOT NULL,
        CONSTRAINT CK_FinanceReportSnapshots_Type CHECK (ReportType IN ('Weekly', 'Monthly')),
        CONSTRAINT UQ_FinanceReportSnapshots_Period UNIQUE (ReportType, PeriodStart, PeriodEnd)
    );

    CREATE INDEX IX_FinanceReportSnapshots_Period
        ON dbo.FinanceReportSnapshots (ReportType, PeriodStart DESC);
END;

PRINT 'Scheduled finance report migration completed successfully.';
