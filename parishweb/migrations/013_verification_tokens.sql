/* Verification tokens for service request email confirmation. */

IF OBJECT_ID(N'dbo.VerificationTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.VerificationTokens (
        TokenId          INT           IDENTITY(1,1) NOT NULL CONSTRAINT PK_VerificationTokens PRIMARY KEY,
        Token            VARCHAR(64)   NOT NULL CONSTRAINT UQ_VerificationTokens_Token UNIQUE,
        ServiceRequestId INT           NOT NULL,
        ExpiresAt        DATETIME2     NOT NULL,
        Used             BIT           NOT NULL CONSTRAINT DF_VerificationTokens_Used DEFAULT (0),
        UsedAt           DATETIME2     NULL,
        CreatedAt        DATETIME2     NOT NULL CONSTRAINT DF_VerificationTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_VerificationTokens_ServiceRequest
            FOREIGN KEY (ServiceRequestId)
            REFERENCES dbo.ServiceRequest (ServiceRequestId)
    );

    CREATE INDEX IX_VerificationTokens_Token
        ON dbo.VerificationTokens (Token)
        WHERE Used = 0;

    CREATE INDEX IX_VerificationTokens_ExpiresAt
        ON dbo.VerificationTokens (ExpiresAt)
        WHERE Used = 0;
END;

PRINT 'Migration 011: VerificationTokens table created successfully.';
