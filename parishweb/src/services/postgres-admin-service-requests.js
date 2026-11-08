import { shouldDeleteServiceRequestDocuments } from '../../server-rules.js';

const detailFields = {
  ChildFirstName: 'childFirstName',
  ChildMiddleName: 'childMiddleName',
  ChildLastName: 'childLastName',
  ChildDateOfBirth: 'childDateOfBirth',
  PlaceOfBirth: 'placeOfBirth',
  FatherFullName: 'fatherFullName',
  MotherFullName: 'motherFullName',
  GodfatherName: 'godfatherName',
  GodmotherName: 'godmotherName',
  GroomFirstName: 'groomFirstName',
  GroomMiddleName: 'groomMiddleName',
  GroomLastName: 'groomLastName',
  GroomAge: 'groomAge',
  BrideFirstName: 'brideFirstName',
  BrideMiddleName: 'brideMiddleName',
  BrideLastName: 'brideLastName',
  BrideAge: 'brideAge',
  CenomarNumber: 'cenomarNumber',
  Witnesses: 'witnesses',
  CandidateFirstName: 'candidateFirstName',
  CandidateMiddleName: 'candidateMiddleName',
  CandidateLastName: 'candidateLastName',
  CandidateDateOfBirth: 'candidateDateOfBirth',
  SponsorName: 'sponsorName',
  ParishOfBaptism: 'parishOfBaptism',
  DeceasedFirstName: 'deceasedFirstName',
  DeceasedMiddleName: 'deceasedMiddleName',
  DeceasedLastName: 'deceasedLastName',
  DateOfDeath: 'dateOfDeath',
  RelationshipToDeceased: 'relationshipToDeceased',
  PlaceOfWake: 'placeOfWake',
  HouseBlessingFullAddress: 'fullAddress',
  HouseBlessingLandmark: 'landmark',
  HouseBlessingPreferredContactPerson: 'preferredContactPerson',
};

const extraFields = [
  'BaptismExtraFields',
  'MarriageExtraFields',
  'ConfirmationExtraFields',
  'FuneralExtraFields',
  'HouseBlessingExtraFields',
];

export async function listPostgresAdminServiceRequests(pool) {
  const result = await pool.query(`
    SELECT request."ServiceRequestId", request."ParishionerId", request."ServiceId",
      request."ScheduledDate", request."ScheduledTime", request."Status", request."Notes",
      request."CreatedAt",
      baptism."ChildFirstName", baptism."ChildMiddleName", baptism."ChildLastName",
      baptism."ChildDateOfBirth", baptism."PlaceOfBirth", baptism."FatherFullName",
      baptism."MotherFullName", baptism."GodfatherName", baptism."GodmotherName",
      baptism."ExtraFieldsJson" AS "BaptismExtraFields",
      marriage."GroomFirstName", marriage."GroomMiddleName", marriage."GroomLastName",
      marriage."GroomAge", marriage."BrideFirstName", marriage."BrideMiddleName",
      marriage."BrideLastName", marriage."BrideAge", marriage."CenomarNumber",
      marriage."Witnesses", marriage."ExtraFieldsJson" AS "MarriageExtraFields",
      confirmation."CandidateFirstName", confirmation."CandidateMiddleName",
      confirmation."CandidateLastName", confirmation."CandidateDateOfBirth",
      confirmation."SponsorName", confirmation."ParishOfBaptism",
      confirmation."ExtraFieldsJson" AS "ConfirmationExtraFields",
      funeral."DeceasedFirstName", funeral."DeceasedMiddleName", funeral."DeceasedLastName",
      funeral."DateOfDeath", funeral."RelationshipToDeceased", funeral."PlaceOfWake",
      funeral."ExtraFieldsJson" AS "FuneralExtraFields",
      blessing."FullAddress" AS "HouseBlessingFullAddress",
      blessing."Landmark" AS "HouseBlessingLandmark",
      blessing."PreferredContactPerson" AS "HouseBlessingPreferredContactPerson",
      blessing."ExtraFieldsJson" AS "HouseBlessingExtraFields",
      COALESCE(request."ContactFirstName", parishioner."FirstName") AS "FirstName",
      COALESCE(request."ContactLastName", parishioner."LastName") AS "LastName",
      COALESCE(request."ContactEmail", parishioner."EmailAddress") AS "EmailAddress",
      COALESCE(request."ContactMobile", parishioner."MobileNumber") AS "MobileNumber",
      COALESCE(request."ContactAddress", parishioner."Address") AS "Address",
      service."Name" AS "ServiceName"
    FROM "public"."ServiceRequest" AS request
    JOIN "public"."Parishioners" AS parishioner
      ON parishioner."ParishionerId" = request."ParishionerId"
    JOIN "public"."Service" AS service ON service."ServiceId" = request."ServiceId"
    LEFT JOIN "public"."BaptismRequestDetail" AS baptism
      ON baptism."ServiceRequestId" = request."ServiceRequestId"
    LEFT JOIN "public"."MarriageRequestDetail" AS marriage
      ON marriage."ServiceRequestId" = request."ServiceRequestId"
    LEFT JOIN "public"."ConfirmationRequestDetail" AS confirmation
      ON confirmation."ServiceRequestId" = request."ServiceRequestId"
    LEFT JOIN "public"."FuneralRequestDetail" AS funeral
      ON funeral."ServiceRequestId" = request."ServiceRequestId"
    LEFT JOIN "public"."HouseBlessingRequestDetail" AS blessing
      ON blessing."ServiceRequestId" = request."ServiceRequestId"
    ORDER BY request."CreatedAt" DESC
  `);
  const documentResult = await pool.query(`
    SELECT "ServiceRequestId", "FieldKey", "Label", "OriginalFileName"
    FROM "public"."ServiceRequestDocument"
  `);
  const documentsByRequest = new Map();
  for (const document of documentResult.rows) {
    const documents = documentsByRequest.get(document.ServiceRequestId) || [];
    documents.push(document);
    documentsByRequest.set(document.ServiceRequestId, documents);
  }

  return result.rows.map(row => {
    const details = Object.fromEntries(Object.entries(detailFields)
      .map(([column, key]) => [key, row[column]])
      .filter(([, value]) => value !== null && value !== undefined && value !== ''));
    for (const column of extraFields) {
      if (row[column]) {
        try {
          Object.assign(details, JSON.parse(row[column]));
        } catch {
          // Keep the request visible if legacy detail JSON is malformed.
        }
      }
    }
    for (const document of documentsByRequest.get(row.ServiceRequestId) || []) {
      details[document.FieldKey] = {
        fieldKey: document.FieldKey,
        label: document.Label,
        fileName: document.OriginalFileName,
      };
    }

    return {
      id: row.ServiceRequestId,
      parishionerId: row.ParishionerId,
      serviceId: row.ServiceId,
      firstName: row.FirstName,
      lastName: row.LastName,
      email: row.EmailAddress,
      mobileNumber: row.MobileNumber,
      address: row.Address,
      serviceName: row.ServiceName,
      scheduledDate: row.ScheduledDate,
      scheduledTime: row.ScheduledTime,
      status: row.Status,
      notes: row.Notes,
      createdAt: row.CreatedAt,
      details,
    };
  });
}

export async function getPostgresServiceRequestDocument(pool, requestId, fieldKey) {
  const result = await pool.query(`
    SELECT "OriginalFileName", "ContentType", "FileData"
    FROM "public"."ServiceRequestDocument"
    WHERE "ServiceRequestId" = $1 AND "FieldKey" = $2
    LIMIT 1
  `, [requestId, fieldKey]);
  return result.rows[0] || null;
}

export async function updatePostgresAdminServiceRequest(pool, requestId, status, adminNotes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adminNote = adminNotes
      ? `\n\n[ADMIN NOTE] ${new Date().toISOString()}: ${String(adminNotes)}`
      : null;
    const result = await client.query(`
      UPDATE "public"."ServiceRequest"
      SET "Status" = $2,
          "Notes" = CASE WHEN $3::text IS NULL THEN "Notes"
            ELSE concat(COALESCE("Notes", ''), $3::text) END,
          "VoidedAt" = CASE WHEN $2 = ANY(ARRAY['Voided', 'VoidedNoShow', 'Cancelled'])
            THEN timezone('UTC', now()) ELSE "VoidedAt" END
      WHERE "ServiceRequestId" = $1
      RETURNING "ServiceRequestId"
    `, [requestId, status, adminNote]);

    if (shouldDeleteServiceRequestDocuments(status)) {
      await client.query(`
        DELETE FROM "public"."ServiceRequestDocument"
        WHERE "ServiceRequestId" = $1
      `, [requestId]);
    }

    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Service request update and rollback failed.');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePostgresAdminServiceRequest(pool, requestId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of [
      'VerificationTokens',
      'ServiceRequestDocument',
      'BaptismRequestDetail',
      'MarriageRequestDetail',
      'ConfirmationRequestDetail',
      'FuneralRequestDetail',
      'HouseBlessingRequestDetail',
    ]) {
      await client.query(`
        DELETE FROM "public"."${table}"
        WHERE "ServiceRequestId" = $1
      `, [requestId]);
    }
    const result = await client.query(`
      DELETE FROM "public"."ServiceRequest"
      WHERE "ServiceRequestId" = $1
      RETURNING "ServiceRequestId"
    `, [requestId]);
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Service request deletion and rollback failed.');
    }
    throw error;
  } finally {
    client.release();
  }
}
