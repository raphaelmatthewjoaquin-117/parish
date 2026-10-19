-- Create an admin user in ASP.NET Identity tables
-- Password: "Admin@123" (hashed with PBKDF2 HMACSHA256, 10000 iterations)

-- First, ensure the roles exist
IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE Name = 'Admin')
BEGIN
    INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
    VALUES ('Admin', 'ADMIN');
END

IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE Name = 'ParishPriest')
BEGIN
    INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
    VALUES ('ParishPriest', 'PARISHPRIEST');
END

IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE Name = 'Secretary')
BEGIN
    INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
    VALUES ('Secretary', 'SECRETARY');
END

IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE Name = 'Bookkeeper')
BEGIN
    INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
    VALUES ('Bookkeeper', 'BOOKKEEPER');
END

IF NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE Name = 'Staff')
BEGIN
    INSERT INTO dbo.AspNetRoles (Name, NormalizedName)
    VALUES ('Staff', 'STAFF');
END

-- Create admin user
-- Password hash for "Admin@123" using ASP.NET Core Identity format (PBKDF2 HMACSHA256, 10000 iterations)
DECLARE @AdminUserId INT;
DECLARE @AdminRoleId INT;

SELECT @AdminRoleId = RoleId FROM dbo.AspNetRoles WHERE Name = 'Admin';

IF NOT EXISTS (SELECT 1 FROM dbo.AspNetUsers WHERE EmailAddress = 'admin@parish.local')
BEGIN
    INSERT INTO dbo.AspNetUsers (
        UserName,
        EmailAddress,
        EmailConfirmed,
        PasswordHash,
        MustChangePassword,
        CreatedAt
    )
    VALUES (
        'admin',
        'admin@parish.local',
        1,
        'ATO6EGmFV+at531pdezGByFv1+9c+oyQXJQml0WXd+XANpoz/EgClGs8tr7oK2GWlA==',
        1,
        SYSUTCDATETIME()
    );

    SET @AdminUserId = SCOPE_IDENTITY();

    -- Assign Admin role
    INSERT INTO dbo.AspNetUserRoles (UserId, RoleId)
    VALUES (@AdminUserId, @AdminRoleId);

    PRINT 'Admin user created successfully. Email: admin@parish.local, Password: Admin@123';
END
ELSE
BEGIN
    PRINT 'Admin user already exists.';
    SELECT @AdminUserId = UserId FROM dbo.AspNetUsers WHERE EmailAddress = 'admin@parish.local';
    SELECT @AdminRoleId = RoleId FROM dbo.AspNetRoles WHERE Name = 'Admin';

    IF NOT EXISTS (SELECT 1 FROM dbo.AspNetUserRoles WHERE UserId = @AdminUserId AND RoleId = @AdminRoleId)
    BEGIN
        INSERT INTO dbo.AspNetUserRoles (UserId, RoleId)
        VALUES (@AdminUserId, @AdminRoleId);
        PRINT 'Admin role assigned to existing user.';
    END
END