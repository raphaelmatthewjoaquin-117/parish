BEGIN;

WITH seed ("Name") AS (
  VALUES
    ('Baptism'),
    ('Marriage'),
    ('Confirmation'),
    ('First Communion'),
    ('Funeral Mass'),
    ('House Blessing')
)
UPDATE "public"."Service" AS service
SET "IsActive" = TRUE
FROM seed
WHERE lower(btrim(service."Name")) = lower(seed."Name");

WITH seed ("Name") AS (
  VALUES
    ('Baptism'),
    ('Marriage'),
    ('Confirmation'),
    ('First Communion'),
    ('Funeral Mass'),
    ('House Blessing')
)
INSERT INTO "public"."Service" ("Name", "IsActive")
SELECT seed."Name", TRUE
FROM seed
WHERE NOT EXISTS (
  SELECT 1
  FROM "public"."Service" AS service
  WHERE lower(btrim(service."Name")) = lower(seed."Name")
);

INSERT INTO "public"."ServiceFieldDefinition"
  ("ServiceId", "FieldKey", "Label", "FieldType", "IsRequired", "SortOrder", "IsActive", "CreatedAt")
SELECT service."ServiceId", field_seed."FieldKey", field_seed."Label",
  field_seed."FieldType", field_seed."IsRequired", field_seed."SortOrder",
  TRUE, timezone('UTC', now())
FROM "public"."Service" AS service
CROSS JOIN (
  VALUES
    ('birthCertificate', 'Birth certificate', 'file', TRUE, 100),
    ('baptismNoRecord', 'Certificate of no record of baptism', 'file', FALSE, 101),
    ('permissionLetter', 'Letter of permission', 'file', FALSE, 102)
) AS field_seed ("FieldKey", "Label", "FieldType", "IsRequired", "SortOrder")
WHERE service."IsActive" = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."ServiceFieldDefinition" AS existing
    WHERE existing."ServiceId" = service."ServiceId"
      AND existing."FieldKey" = field_seed."FieldKey"
  );

COMMIT;

SELECT "ServiceId", "Name", "Description", "IsActive"
FROM "public"."Service"
WHERE "IsActive" = TRUE
ORDER BY "Name";
