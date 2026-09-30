/* Certificate request supporting documents. */

IF OBJECT_ID(N'dbo.CertificateRequestDocuments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CertificateRequestDocuments (
        CertificateRequestDocumentId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CertificateRequestDocuments PRIMARY KEY,
        CertificateRequestId INT NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        StoredFileName NVARCHAR(255) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        MimeType VARCHAR(100) NOT NULL,
        FileSizeBytes INT NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_CertificateRequestDocuments_UploadedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_CertificateRequestDocuments_Request FOREIGN KEY (CertificateRequestId)
            REFERENCES dbo.CertificateRequests (CertificateRequestId)
    );

    CREATE INDEX IX_CertificateRequestDocuments_Request
        ON dbo.CertificateRequestDocuments (CertificateRequestId, UploadedAt DESC);
END;

PRINT 'Certificate request document migration completed successfully.';
