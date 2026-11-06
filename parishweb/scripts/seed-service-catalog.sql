SET NOCOUNT ON;

MERGE INTO dbo.Service AS target
USING (
    VALUES
        (N'Baptism', N'Baptism scheduling and ceremony booking.'),
        (N'Marriage', N'Marriage scheduling and wedding ceremony booking.'),
        (N'Confirmation', N'Confirmation scheduling and ceremony booking.'),
        (N'First Communion', N'First Communion scheduling and ceremony booking.'),
        (N'Funeral Mass', N'Funeral Mass scheduling and coordination.')
) AS source (Name, Description)
ON target.Name = source.Name
WHEN MATCHED THEN
    UPDATE SET
        Description = source.Description,
        IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (Name, Description, IsActive)
    VALUES (source.Name, source.Description, 1);

IF OBJECT_ID(N'dbo.ServiceFieldDefinition', N'U') IS NOT NULL
BEGIN
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
END;

SELECT ServiceId, Name, Description, IsActive
FROM dbo.Service
WHERE IsActive = 1
ORDER BY Name;
