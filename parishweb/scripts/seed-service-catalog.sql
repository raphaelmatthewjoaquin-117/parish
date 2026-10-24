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

SELECT ServiceId, Name, Description, IsActive
FROM dbo.Service
WHERE IsActive = 1
ORDER BY Name;
