/* Guest certificate requests — remove account requirement, add contact fields and reference code. */

-- Make AccountId nullable so guest requests (no account) are supported.
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.CertificateRequests')
      AND name = N'AccountId'
)
BEGIN
    ALTER TABLE dbo.CertificateRequests
      ALTER COLUMN AccountId INT NULL;
END;

-- Add guest contact fields only if they do not already exist.
IF COL_LENGTH('dbo.CertificateRequests', 'ContactEmail') IS NULL
    ALTER TABLE dbo.CertificateRequests ADD ContactEmail VARCHAR(255) NULL;

IF COL_LENGTH('dbo.CertificateRequests', 'ContactPhone') IS NULL
    ALTER TABLE dbo.CertificateRequests ADD ContactPhone VARCHAR(50) NULL;

IF COL_LENGTH('dbo.CertificateRequests', 'FirstName') IS NULL
    ALTER TABLE dbo.CertificateRequests ADD FirstName NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.CertificateRequests', 'LastName') IS NULL
    ALTER TABLE dbo.CertificateRequests ADD LastName NVARCHAR(100) NULL;

IF COL_LENGTH('dbo.CertificateRequests', 'ReferenceCode') IS NULL
    ALTER TABLE dbo.CertificateRequests ADD ReferenceCode VARCHAR(10) NULL;

-- Create indexes only when the column exists and the index is missing.
IF COL_LENGTH('dbo.CertificateRequests', 'ReferenceCode') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID(N'dbo.CertificateRequests')
         AND name = N'UQ_CertificateRequests_RefCode'
   )
BEGIN
    CREATE UNIQUE INDEX UQ_CertificateRequests_RefCode
      ON dbo.CertificateRequests (ReferenceCode)
      WHERE ReferenceCode IS NOT NULL;
END;

IF COL_LENGTH('dbo.CertificateRequests', 'ContactEmail') IS NOT NULL
   AND COL_LENGTH('dbo.CertificateRequests', 'ReferenceCode') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID(N'dbo.CertificateRequests')
         AND name = N'IX_CertificateRequests_EmailRef'
   )
BEGIN
    CREATE INDEX IX_CertificateRequests_EmailRef
      ON dbo.CertificateRequests (ContactEmail, ReferenceCode)
      WHERE ContactEmail IS NOT NULL;
END;

PRINT 'Migration 010: guest certificate request columns added successfully.';
