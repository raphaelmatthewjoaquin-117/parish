/* Per-service document uploads and staff review after email verification. */

IF OBJECT_ID(N'dbo.ServiceRequestDocument', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ServiceRequestDocument (
        DocumentId INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_ServiceRequestDocument PRIMARY KEY,
        ServiceRequestId INT NOT NULL CONSTRAINT FK_ServiceRequestDocument_ServiceRequest
            REFERENCES dbo.ServiceRequest(ServiceRequestId),
        FieldKey VARCHAR(100) NOT NULL,
        Label NVARCHAR(200) NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        ContentType VARCHAR(100) NOT NULL,
        FileData VARBINARY(MAX) NOT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_ServiceRequestDocument_UploadedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_ServiceRequestDocument_RequestField UNIQUE (ServiceRequestId, FieldKey)
    );
END;

INSERT INTO dbo.ServiceFieldDefinition (ServiceId, FieldKey, Label, FieldType, IsRequired, SortOrder)
SELECT s.ServiceId, v.FieldKey, v.Label, 'file', v.IsRequired, v.SortOrder
FROM dbo.Service s
CROSS APPLY (VALUES
    ('birthCertificate', N'Birth certificate', 1, 100),
    ('baptismNoRecord', N'Certificate of no record of baptism', 0, 101),
    ('permissionLetter', N'Letter of permission', 0, 102)
) AS v(FieldKey, Label, IsRequired, SortOrder)
WHERE s.IsActive = 1
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.ServiceFieldDefinition existing
    WHERE existing.ServiceId = s.ServiceId
      AND existing.FieldKey = v.FieldKey
  );

EXEC sys.sp_executesql N'
    UPDATE dbo.ServiceRequest
    SET ActiveSlotKey = CASE WHEN Status IN (''PendingVerification'', ''PendingReview'', ''Confirmed'')
        THEN CONVERT(NVARCHAR(20), ServiceId) + N''|'' + CONVERT(NVARCHAR(10), ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), ScheduledTime, 108)
        ELSE NULL END;';

IF OBJECT_ID(N'dbo.trg_ServiceRequest_ActiveSlotKey', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_ServiceRequest_ActiveSlotKey;

EXEC sys.sp_executesql N'
    CREATE TRIGGER dbo.trg_ServiceRequest_ActiveSlotKey
    ON dbo.ServiceRequest
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE sr
        SET ActiveSlotKey = CASE WHEN sr.Status IN (''PendingVerification'', ''PendingReview'', ''Confirmed'')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N''|'' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END
        FROM dbo.ServiceRequest sr
        INNER JOIN inserted i ON i.ServiceRequestId = sr.ServiceRequestId
        WHERE ISNULL(sr.ActiveSlotKey, N'''') <> ISNULL(CASE WHEN sr.Status IN (''PendingVerification'', ''PendingReview'', ''Confirmed'')
            THEN CONVERT(NVARCHAR(20), sr.ServiceId) + N''|'' + CONVERT(NVARCHAR(10), sr.ScheduledDate, 23) + N''|'' + CONVERT(NVARCHAR(8), sr.ScheduledTime, 108)
            ELSE NULL END, N'''');
    END;';
