/* Role-aware staff scheduling foundation. Run once against ParishDB. */

IF OBJECT_ID(N'dbo.MassSchedule', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MassSchedule (
        MassScheduleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MassSchedule PRIMARY KEY,
        Title NVARCHAR(200) NOT NULL,
        MassDate DATE NOT NULL,
        MassTime VARCHAR(10) NOT NULL,
        Location NVARCHAR(255) NOT NULL,
        PriestUsername VARCHAR(256) NOT NULL,
        Notes NVARCHAR(1000) NULL,
        Status VARCHAR(30) NOT NULL CONSTRAINT DF_MassSchedule_Status DEFAULT ('Scheduled'),
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassSchedule_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_MassSchedule_UpdatedAt DEFAULT (SYSUTCDATETIME())
    );

    CREATE INDEX IX_MassSchedule_PriestDate
        ON dbo.MassSchedule (PriestUsername, MassDate, MassTime);
END;

/* Ensure the supported staff roles exist when ASP.NET Identity is installed. */
IF OBJECT_ID(N'dbo.AspNetRoles', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.AspNetRoles (Name)
    SELECT role_name
    FROM (VALUES
        ('Admin'),
        ('ParishPriest'),
        ('Secretary'),
        ('Bookkeeper'),
        ('Staff')
    ) AS roles(role_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.AspNetRoles existing
        WHERE UPPER(existing.Name) = UPPER(roles.role_name)
    );
END;
