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

COMMIT;

SELECT "ServiceId", "Name", "Description", "IsActive"
FROM "public"."Service"
WHERE "IsActive" = TRUE
ORDER BY "Name";
