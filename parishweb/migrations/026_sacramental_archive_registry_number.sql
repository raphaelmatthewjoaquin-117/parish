/* Associate sacramental archive pages with their register entry. */

IF COL_LENGTH(N'dbo.SacramentalArchives', N'RegistryNumber') IS NULL
    ALTER TABLE dbo.SacramentalArchives
        ADD RegistryNumber NVARCHAR(50) NULL;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.SacramentalArchives')
      AND name = N'IX_SacramentalArchives_SacramentType_RegistryNumber'
)
    CREATE INDEX IX_SacramentalArchives_SacramentType_RegistryNumber
        ON dbo.SacramentalArchives (SacramentType, RegistryNumber);

PRINT 'Sacramental archive registry number migration completed successfully.';
