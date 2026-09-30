/* Admin-configurable form fields per sacrament, plus typed detail tables for structured booking data. */

IF OBJECT_ID(N'dbo.ServiceFieldDefinition', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ServiceFieldDefinition (
        FieldDefinitionId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ServiceFieldDefinition PRIMARY KEY,
        ServiceId INT NOT NULL CONSTRAINT FK_ServiceFieldDefinition_Service REFERENCES dbo.Service(ServiceId),
        FieldKey VARCHAR(100) NOT NULL,
        Label NVARCHAR(200) NOT NULL,
        FieldType VARCHAR(20) NOT NULL CONSTRAINT DF_ServiceFieldDefinition_FieldType DEFAULT ('text'),
        OptionsJson NVARCHAR(MAX) NULL,
        IsRequired BIT NOT NULL CONSTRAINT DF_ServiceFieldDefinition_IsRequired DEFAULT (0),
        SortOrder INT NOT NULL CONSTRAINT DF_ServiceFieldDefinition_SortOrder DEFAULT (0),
        IsActive BIT NOT NULL CONSTRAINT DF_ServiceFieldDefinition_IsActive DEFAULT (1),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ServiceFieldDefinition_CreatedAt DEFAULT (SYSUTCDATETIME())
    );

    CREATE UNIQUE INDEX IX_ServiceFieldDefinition_ServiceKey ON dbo.ServiceFieldDefinition (ServiceId, FieldKey);
END;

-- Typed detail tables: known columns per sacrament for structured/queryable data, plus a JSON overflow
-- column so admins can add custom fields via ServiceFieldDefinition without needing a schema change.
IF OBJECT_ID(N'dbo.BaptismRequestDetail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BaptismRequestDetail (
        ServiceRequestId INT NOT NULL CONSTRAINT PK_BaptismRequestDetail PRIMARY KEY CONSTRAINT FK_BaptismRequestDetail_ServiceRequest REFERENCES dbo.ServiceRequest(ServiceRequestId),
        ChildFirstName NVARCHAR(200) NULL,
        ChildMiddleName NVARCHAR(200) NULL,
        ChildLastName NVARCHAR(200) NULL,
        ChildDateOfBirth DATE NULL,
        PlaceOfBirth NVARCHAR(300) NULL,
        FatherFullName NVARCHAR(300) NULL,
        MotherFullName NVARCHAR(300) NULL,
        GodfatherName NVARCHAR(300) NULL,
        GodmotherName NVARCHAR(300) NULL,
        ExtraFieldsJson NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.MarriageRequestDetail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MarriageRequestDetail (
        ServiceRequestId INT NOT NULL CONSTRAINT PK_MarriageRequestDetail PRIMARY KEY CONSTRAINT FK_MarriageRequestDetail_ServiceRequest REFERENCES dbo.ServiceRequest(ServiceRequestId),
        GroomFirstName NVARCHAR(200) NULL,
        GroomMiddleName NVARCHAR(200) NULL,
        GroomLastName NVARCHAR(200) NULL,
        GroomAge INT NULL,
        BrideFirstName NVARCHAR(200) NULL,
        BrideMiddleName NVARCHAR(200) NULL,
        BrideLastName NVARCHAR(200) NULL,
        BrideAge INT NULL,
        CenomarNumber NVARCHAR(100) NULL,
        Witnesses NVARCHAR(MAX) NULL,
        ExtraFieldsJson NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.ConfirmationRequestDetail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ConfirmationRequestDetail (
        ServiceRequestId INT NOT NULL CONSTRAINT PK_ConfirmationRequestDetail PRIMARY KEY CONSTRAINT FK_ConfirmationRequestDetail_ServiceRequest REFERENCES dbo.ServiceRequest(ServiceRequestId),
        CandidateFirstName NVARCHAR(200) NULL,
        CandidateMiddleName NVARCHAR(200) NULL,
        CandidateLastName NVARCHAR(200) NULL,
        CandidateDateOfBirth DATE NULL,
        SponsorName NVARCHAR(300) NULL,
        ParishOfBaptism NVARCHAR(300) NULL,
        ExtraFieldsJson NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.FuneralRequestDetail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.FuneralRequestDetail (
        ServiceRequestId INT NOT NULL CONSTRAINT PK_FuneralRequestDetail PRIMARY KEY CONSTRAINT FK_FuneralRequestDetail_ServiceRequest REFERENCES dbo.ServiceRequest(ServiceRequestId),
        DeceasedFirstName NVARCHAR(200) NULL,
        DeceasedMiddleName NVARCHAR(200) NULL,
        DeceasedLastName NVARCHAR(200) NULL,
        DateOfDeath DATE NULL,
        RelationshipToDeceased NVARCHAR(200) NULL,
        PlaceOfWake NVARCHAR(300) NULL,
        ExtraFieldsJson NVARCHAR(MAX) NULL
    );
END;

IF OBJECT_ID(N'dbo.HouseBlessingRequestDetail', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.HouseBlessingRequestDetail (
        ServiceRequestId INT NOT NULL CONSTRAINT PK_HouseBlessingRequestDetail PRIMARY KEY CONSTRAINT FK_HouseBlessingRequestDetail_ServiceRequest REFERENCES dbo.ServiceRequest(ServiceRequestId),
        FullAddress NVARCHAR(500) NULL,
        Landmark NVARCHAR(300) NULL,
        PreferredContactPerson NVARCHAR(300) NULL,
        ExtraFieldsJson NVARCHAR(MAX) NULL
    );
END;

-- Seed default field definitions per active sacrament (admins can edit/add/remove afterward).
INSERT INTO dbo.ServiceFieldDefinition (ServiceId, FieldKey, Label, FieldType, IsRequired, SortOrder)
SELECT s.ServiceId, v.FieldKey, v.Label, v.FieldType, v.IsRequired, v.SortOrder
FROM dbo.Service s
CROSS APPLY (VALUES
    ('Baptism', 'childFirstName', 'Child first name', 'text', 1, 1),
    ('Baptism', 'childMiddleName', 'Child middle name', 'text', 0, 2),
    ('Baptism', 'childLastName', 'Child last name', 'text', 1, 3),
    ('Baptism', 'childDateOfBirth', 'Child date of birth', 'date', 1, 4),
    ('Baptism', 'placeOfBirth', 'Place of birth', 'text', 0, 5),
    ('Baptism', 'fatherFullName', 'Father''s full name', 'text', 1, 6),
    ('Baptism', 'motherFullName', 'Mother''s full name', 'text', 1, 7),
    ('Baptism', 'godfatherName', 'Godfather name', 'text', 0, 8),
    ('Baptism', 'godmotherName', 'Godmother name', 'text', 0, 9),

    ('Marriage', 'groomFirstName', 'Groom first name', 'text', 1, 1),
    ('Marriage', 'groomMiddleName', 'Groom middle name', 'text', 0, 2),
    ('Marriage', 'groomLastName', 'Groom last name', 'text', 1, 3),
    ('Marriage', 'groomAge', 'Groom age', 'number', 1, 4),
    ('Marriage', 'brideFirstName', 'Bride first name', 'text', 1, 5),
    ('Marriage', 'brideMiddleName', 'Bride middle name', 'text', 0, 6),
    ('Marriage', 'brideLastName', 'Bride last name', 'text', 1, 7),
    ('Marriage', 'brideAge', 'Bride age', 'number', 1, 8),
    ('Marriage', 'cenomarNumber', 'CENOMAR number', 'text', 0, 9),
    ('Marriage', 'witnesses', 'Witnesses', 'textarea', 0, 10),

    ('Confirmation', 'candidateFirstName', 'Candidate first name', 'text', 1, 1),
    ('Confirmation', 'candidateMiddleName', 'Candidate middle name', 'text', 0, 2),
    ('Confirmation', 'candidateLastName', 'Candidate last name', 'text', 1, 3),
    ('Confirmation', 'candidateDateOfBirth', 'Candidate date of birth', 'date', 1, 4),
    ('Confirmation', 'sponsorName', 'Sponsor name', 'text', 1, 5),
    ('Confirmation', 'parishOfBaptism', 'Parish of baptism', 'text', 0, 6),

    ('Funeral Mass', 'deceasedFirstName', 'Deceased first name', 'text', 1, 1),
    ('Funeral Mass', 'deceasedMiddleName', 'Deceased middle name', 'text', 0, 2),
    ('Funeral Mass', 'deceasedLastName', 'Deceased last name', 'text', 1, 3),
    ('Funeral Mass', 'dateOfDeath', 'Date of death', 'date', 1, 4),
    ('Funeral Mass', 'relationshipToDeceased', 'Your relationship to the deceased', 'text', 1, 5),
    ('Funeral Mass', 'placeOfWake', 'Place of wake', 'text', 0, 6),

    ('House Blessing', 'fullAddress', 'Full address to bless', 'textarea', 1, 1),
    ('House Blessing', 'landmark', 'Nearby landmark', 'text', 0, 2),
    ('House Blessing', 'preferredContactPerson', 'Preferred contact person on site', 'text', 0, 3)
) AS v(ServiceName, FieldKey, Label, FieldType, IsRequired, SortOrder)
WHERE s.Name = v.ServiceName
  AND NOT EXISTS (
    SELECT 1 FROM dbo.ServiceFieldDefinition existing
    WHERE existing.ServiceId = s.ServiceId AND existing.FieldKey = v.FieldKey
  );
