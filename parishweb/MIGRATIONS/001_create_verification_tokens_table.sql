-- Create VerificationTokens table for storing service request verification tokens
-- These tokens are used for email-based verification of service bookings
-- Tokens expire after 24 hours for security

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'VerificationTokens')
BEGIN
    CREATE TABLE dbo.VerificationTokens (
        TokenId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        Token NVARCHAR(64) NOT NULL UNIQUE,
        ServiceRequestId INT NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NOT NULL,
        Used BIT DEFAULT 0,
        UsedAt DATETIME2 NULL,

        -- Foreign key to ServiceRequest table (singular, not plural)
        CONSTRAINT FK_VerificationTokens_ServiceRequest
            FOREIGN KEY (ServiceRequestId)
            REFERENCES dbo.ServiceRequest(ServiceRequestId)
            ON DELETE CASCADE
    );

    -- Index for faster token lookups
    CREATE INDEX IDX_VerificationTokens_Token
        ON dbo.VerificationTokens(Token);

    -- Index for cleanup queries (find expired tokens)
    CREATE INDEX IDX_VerificationTokens_ExpiresAt
        ON dbo.VerificationTokens(ExpiresAt);

    -- Index for pending verifications
    CREATE INDEX IDX_VerificationTokens_Pending
        ON dbo.VerificationTokens(Used, ExpiresAt);

    PRINT 'VerificationTokens table created successfully';
END
ELSE
BEGIN
    PRINT 'VerificationTokens table already exists';
END;