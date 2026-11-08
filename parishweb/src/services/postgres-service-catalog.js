export async function listPostgresServices(pool) {
  const result = await pool.query(`
    SELECT "ServiceId" AS id, "Name" AS name, "Description" AS description
    FROM "public"."Service"
    WHERE "IsActive" = TRUE
    ORDER BY "Name"
  `);
  return result.rows;
}

export async function listPostgresServiceFields(pool, serviceId) {
  const result = await pool.query(`
    SELECT "FieldKey" AS key, "Label" AS label, "FieldType" AS type,
      "OptionsJson" AS "optionsJson", "IsRequired" AS required
    FROM "public"."ServiceFieldDefinition"
    WHERE "ServiceId" = $1 AND "IsActive" = TRUE
    ORDER BY "SortOrder", "FieldDefinitionId"
  `, [serviceId]);

  return {
    fields: result.rows.map(row => ({
      key: row.key,
      label: row.label,
      type: row.type,
      options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
      required: Boolean(row.required),
    })),
  };
}

export async function listPostgresAdminServiceFields(pool) {
  const result = await pool.query(`
    SELECT field."FieldDefinitionId" AS id, field."ServiceId" AS "serviceId",
      service."Name" AS "serviceName", field."FieldKey" AS key, field."Label" AS label,
      field."FieldType" AS type, field."OptionsJson" AS "optionsJson",
      field."IsRequired" AS required, field."SortOrder" AS "sortOrder",
      field."IsActive" AS active
    FROM "public"."ServiceFieldDefinition" AS field
    JOIN "public"."Service" AS service ON service."ServiceId" = field."ServiceId"
    ORDER BY service."Name", field."SortOrder", field."FieldDefinitionId"
  `);
  return result.rows.map(row => ({
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    key: row.key,
    label: row.label,
    type: row.type,
    options: row.optionsJson ? JSON.parse(row.optionsJson) : undefined,
    required: Boolean(row.required),
    sortOrder: row.sortOrder,
    active: Boolean(row.active),
  }));
}

export async function createPostgresServiceField(pool, field) {
  const result = await pool.query(`
    INSERT INTO "public"."ServiceFieldDefinition"
      ("ServiceId", "FieldKey", "Label", "FieldType", "OptionsJson", "IsRequired", "SortOrder", "IsActive")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING "FieldDefinitionId" AS id
  `, [
    field.serviceId,
    field.key,
    field.label,
    field.type,
    field.optionsJson,
    field.required,
    field.sortOrder,
    field.active,
  ]);
  if (!result.rows[0]) {
    throw new Error('PostgreSQL did not return the created service field ID.');
  }
  return result.rows[0].id;
}

export async function updatePostgresServiceField(pool, id, field) {
  const result = await pool.query(`
    UPDATE "public"."ServiceFieldDefinition"
    SET "Label" = $2, "FieldType" = $3, "OptionsJson" = $4, "IsRequired" = $5,
      "SortOrder" = $6, "IsActive" = $7
    WHERE "FieldDefinitionId" = $1
  `, [id, field.label, field.type, field.optionsJson, field.required, field.sortOrder, field.active]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deletePostgresServiceField(pool, id) {
  const result = await pool.query(`
    DELETE FROM "public"."ServiceFieldDefinition"
    WHERE "FieldDefinitionId" = $1
  `, [id]);
  return result.rowCount !== null && result.rowCount > 0;
}
