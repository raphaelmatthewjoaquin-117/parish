-- Migration 003: Add contact snapshot columns to ServiceRequest
-- Stores contact details at the time of booking to preserve history

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ServiceRequest' AND COLUMN_NAME = 'ContactFirstName')
BEGIN
    ALTER TABLE dbo.ServiceRequest ADD ContactFirstName NVARCHAR(100) NULL;
    PRINT 'Added ContactFirstName to ServiceRequest';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ServiceRequest' AND COLUMN_NAME = 'ContactLastName')
BEGIN
    ALTER TABLE dbo.ServiceRequest ADD ContactLastName NVARCHAR(100) NULL;
    PRINT 'Added ContactLastName to ServiceRequest';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ServiceRequest' AND COLUMN_NAME = 'ContactEmail')
BEGIN
    ALTER TABLE dbo.ServiceRequest ADD ContactEmail NVARCHAR(255) NULL;
    PRINT 'Added ContactEmail to ServiceRequest';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ServiceRequest' AND COLUMN_NAME = 'ContactMobile')
BEGIN
    ALTER TABLE dbo.ServiceRequest ADD ContactMobile NVARCHAR(20) NULL;
    PRINT 'Added ContactMobile to ServiceRequest';
END;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ServiceRequest' AND COLUMN_NAME = 'ContactAddress')
BEGIN
    ALTER TABLE dbo.ServiceRequest ADD ContactAddress NVARCHAR(500) NULL;
    PRINT 'Added ContactAddress to ServiceRequest';
END;

-- Backfill existing requests with current parishioner data as fallback
UPDATE sr
SET
    sr.ContactFirstName = ISNULL(sr.ContactFirstName, p.FirstName),
    sr.ContactLastName  = ISNULL(sr.ContactLastName,  p.LastName),
    sr.ContactEmail     = ISNULL(sr.ContactEmail,     p.EmailAddress),
    sr.ContactMobile    = ISNULL(sr.ContactMobile,    p.MobileNumber),
    sr.ContactAddress   = ISNULL(sr.ContactAddress,   p.Address)
FROM dbo.ServiceRequest sr
JOIN dbo.Parishioners p ON sr.ParishionerId = p.ParishionerId;
PRINT 'Backfilled existing ServiceRequests with current Parishioner details';
