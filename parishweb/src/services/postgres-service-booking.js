async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'PostgreSQL booking transaction and rollback failed.');
    }
    throw error;
  } finally {
    client.release();
  }
}

const sacramentDetails = {
  Baptism: ['BaptismRequestDetail', ['ChildFirstName', 'ChildMiddleName', 'ChildLastName', 'ChildDateOfBirth', 'PlaceOfBirth', 'FatherFullName', 'MotherFullName', 'GodfatherName', 'GodmotherName']],
  Marriage: ['MarriageRequestDetail', ['GroomFirstName', 'GroomMiddleName', 'GroomLastName', 'GroomAge', 'BrideFirstName', 'BrideMiddleName', 'BrideLastName', 'BrideAge', 'CenomarNumber', 'Witnesses']],
  Confirmation: ['ConfirmationRequestDetail', ['CandidateFirstName', 'CandidateMiddleName', 'CandidateLastName', 'CandidateDateOfBirth', 'SponsorName', 'ParishOfBaptism']],
  'Funeral Mass': ['FuneralRequestDetail', ['DeceasedFirstName', 'DeceasedMiddleName', 'DeceasedLastName', 'DateOfDeath', 'RelationshipToDeceased', 'PlaceOfWake']],
  'House Blessing': ['HouseBlessingRequestDetail', ['FullAddress', 'Landmark', 'PreferredContactPerson']],
};

function detailValue(column, value) {
  if (value == null || value === '') return null;
  if (['ChildDateOfBirth', 'CandidateDateOfBirth', 'DateOfDeath'].includes(column)) return String(value).slice(0, 10);
  if (['GroomAge', 'BrideAge'].includes(column)) return String(value).slice(0, 10);
  return String(value).slice(0, 4000);
}

export async function savePostgresSacramentDetails(pool, serviceName, requestId, details) {
  const mapping = sacramentDetails[serviceName];
  if (!mapping || !details || typeof details !== 'object') return;

  const [table, columns] = mapping;
  const columnsByKey = new Map(columns.map(column => [column[0].toLowerCase() + column.slice(1), column]));
  const valuesByColumn = new Map(columns.map(column => [column, null]));
  const extras = {};
  for (const [key, value] of Object.entries(details)) {
    const column = columnsByKey.get(key);
    if (column) valuesByColumn.set(column, detailValue(column, value));
    else extras[key] = value;
  }

  const insertColumns = ['ServiceRequestId', ...columns, 'ExtraFieldsJson'];
  const values = [requestId, ...columns.map(column => valuesByColumn.get(column)), Object.keys(extras).length ? JSON.stringify(extras) : null];
  const placeholders = values.map((_, index) => {
    const column = insertColumns[index];
    const cast = ['ChildDateOfBirth', 'CandidateDateOfBirth', 'DateOfDeath'].includes(column)
      ? '::date'
      : ['GroomAge', 'BrideAge'].includes(column)
        ? '::integer'
        : '';
    return `$${index + 1}${cast}`;
  });
  await pool.query(`
    INSERT INTO "public"."${table}" (${insertColumns.map(column => `"${column}"`).join(', ')})
    VALUES (${placeholders.join(', ')})
  `, values);
}

export function createPostgresServiceBooking(pool, booking) {
  return withTransaction(pool, async client => {
    let parishioner = await client.query(`
      SELECT "ParishionerId" AS id
      FROM "public"."Parishioners"
      WHERE "EmailAddress" = $1
      LIMIT 1
      FOR UPDATE
    `, [booking.email]);
    if (parishioner.rows.length === 0 && booking.mobileNumber) {
      parishioner = await client.query(`
        SELECT "ParishionerId" AS id
        FROM "public"."Parishioners"
        WHERE "MobileNumber" = $1
        LIMIT 1
        FOR UPDATE
      `, [booking.mobileNumber]);
    }

    let parishionerId = parishioner.rows[0]?.id;
    if (parishionerId) {
      await client.query(`
        UPDATE "public"."Parishioners"
        SET "FirstName" = $1, "LastName" = $2, "Address" = $3,
          "EmailAddress" = $4, "MobileNumber" = $5
        WHERE "ParishionerId" = $6
      `, [booking.firstName, booking.lastName, booking.address || null, booking.email, booking.mobileNumber || null, parishionerId]);
    } else {
      const insertedParishioner = await client.query(`
        INSERT INTO "public"."Parishioners"
          ("FirstName", "LastName", "EmailAddress", "MobileNumber", "Address", "CreatedAt")
        VALUES ($1, $2, $3, $4, $5, timezone('UTC', now()))
        RETURNING "ParishionerId" AS id
      `, [booking.firstName, booking.lastName, booking.email, booking.mobileNumber || null, booking.address || null]);
      parishionerId = insertedParishioner.rows[0].id;
    }

    const insertedRequest = await client.query(`
      INSERT INTO "public"."ServiceRequest"
        ("ParishionerId", "ServiceId", "RequestDate", "ScheduledDate", "ScheduledTime",
         "Venue", "Status", "Notes", "CreatedAt", "ContactFirstName", "ContactLastName",
         "ContactEmail", "ContactMobile", "ContactAddress")
      VALUES ($1, $2, timezone('UTC', now()), $3, $4, '', 'PendingVerification', $5,
        timezone('UTC', now()), $6, $7, $8, $9, $10)
      RETURNING "ServiceRequestId" AS id
    `, [
      parishionerId,
      booking.serviceId,
      booking.scheduledDate,
      booking.scheduledTime,
      booking.notes || null,
      booking.firstName,
      booking.lastName,
      booking.email,
      booking.mobileNumber || null,
      booking.address || null,
    ]);
    const requestId = insertedRequest.rows[0].id;

    for (const document of booking.documents) {
      await client.query(`
        INSERT INTO "public"."ServiceRequestDocument"
          ("ServiceRequestId", "FieldKey", "Label", "OriginalFileName", "ContentType", "FileData")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        requestId,
        document.key,
        document.label,
        document.fileName,
        document.file.mimetype,
        document.file.buffer,
      ]);
    }

    await client.query(`
      INSERT INTO "public"."VerificationTokens"
        ("Token", "ServiceRequestId", "ExpiresAt", "Used", "CreatedAt")
      VALUES ($1, $2, timezone('UTC', now()) + INTERVAL '24 hours', false, timezone('UTC', now()))
    `, [booking.verificationToken, requestId]);
    return requestId;
  });
}

export async function verifyPostgresServiceBookingToken(pool, token) {
  const result = await pool.query(`
    UPDATE "public"."VerificationTokens"
    SET "Used" = true, "UsedAt" = timezone('UTC', now())
    WHERE "Token" = $1
      AND "Used" = false
      AND "ExpiresAt" > timezone('UTC', now())
    RETURNING "ServiceRequestId" AS "requestId"
  `, [token]);
  return result.rows[0]?.requestId ?? null;
}

export async function createPostgresServiceVerificationToken(pool, requestId, token) {
  await pool.query(`
    INSERT INTO "public"."VerificationTokens"
      ("Token", "ServiceRequestId", "ExpiresAt", "Used", "CreatedAt")
    VALUES ($1, $2, timezone('UTC', now()) + INTERVAL '24 hours', false, timezone('UTC', now()))
  `, [token, requestId]);
}
