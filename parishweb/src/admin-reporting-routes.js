import express from 'express'
import path from 'node:path'
import {
  deletePostgresCertificateRequest,
  getPostgresCertificateDocument,
  listPostgresCertificateRequests,
  listPostgresCertificateUploads,
  setPostgresCertificateRequestStatus,
} from './certificates/postgres-certificates.js'

const sacramentTypes = new Set(['baptism', 'confirmation', 'marriage', 'death'])
const financeTypes = new Set(['StoleFee', 'MassOffering', 'Donation', 'Rental', 'OtherIncome', 'Expense'])
const textField = (column, length, required = false) => ({ column, kind: 'text', length, required })
const dateField = (column, required = false) => ({ column, kind: 'date', required })
const integerField = column => ({ column, kind: 'integer', required: false })
const sacramentRecords = {
  baptism: {
    table: 'BaptismRecords',
    idColumn: 'BaptismId',
    fields: [
      textField('RegistryNumber', 50, true), textField('ChildFirstName', 100, true),
      textField('ChildMiddleName', 100), textField('ChildLastName', 100, true),
      dateField('DateOfBirth', true), textField('PlaceOfBirth', 200),
      dateField('DateOfBaptism', true), textField('FatherFullName', 200),
      textField('MotherFullName', 200), textField('MinisterName', 200, true),
      textField('Sponsors', null), textField('Remarks', null),
    ],
  },
  confirmation: {
    table: 'ConfirmationRecords',
    idColumn: 'ConfirmationId',
    fields: [
      textField('RegistryNumber', 50, true), textField('CandidateFirstName', 100, true),
      textField('CandidateMiddleName', 100), textField('CandidateLastName', 100, true),
      dateField('DateOfBirth', true), dateField('DateOfConfirmation', true),
      textField('FatherFullName', 200), textField('MotherFullName', 200),
      textField('SponsorName', 200), textField('BishopOrMinister', 200, true),
      textField('ParishOfBaptism', 200),
    ],
  },
  marriage: {
    table: 'MarriageRecords',
    idColumn: 'MarriageId',
    fields: [
      textField('RegistryNumber', 50, true), textField('GroomFirstName', 100, true),
      textField('GroomMiddleName', 100), textField('GroomLastName', 100, true),
      integerField('GroomAge'), textField('GroomParents', 200),
      textField('BrideFirstName', 100, true), textField('BrideMiddleName', 100),
      textField('BrideLastName', 100, true), integerField('BrideAge'),
      textField('BrideParents', 200), dateField('DateOfMarriage', true),
      textField('Witnesses', null), textField('SolemnizingPriest', 200, true),
    ],
  },
  death: {
    table: 'DeathRecords',
    idColumn: 'DeathId',
    fields: [
      textField('RegistryNumber', 50, true), textField('DeceasedFirstName', 100, true),
      textField('DeceasedMiddleName', 100), textField('DeceasedLastName', 100, true),
      integerField('Age'), dateField('DateOfDeath', true), dateField('DateOfBurial'),
      textField('CauseOfDeath', 200), textField('PlaceOfBurial', 200),
      textField('SacramentsReceived', 500), textField('OfficiatingPriest', 200, true),
    ],
  },
}

const recordQuery = `
  SELECT 'baptism' AS RecordType, BaptismId AS Id, RegistryNumber,
    CONCAT(ChildFirstName, ' ', ChildLastName) AS Name, DateOfBaptism AS RecordDate,
    MinisterName AS Priest, ScannedDocumentUrl
  FROM dbo.BaptismRecords
  UNION ALL
  SELECT 'confirmation', ConfirmationId, RegistryNumber,
    CONCAT(CandidateFirstName, ' ', CandidateLastName), DateOfConfirmation,
    BishopOrMinister, ScannedDocumentUrl
  FROM dbo.ConfirmationRecords
  UNION ALL
  SELECT 'marriage', MarriageId, RegistryNumber,
    CONCAT(GroomFirstName, ' ', GroomLastName, ' / ', BrideFirstName, ' ', BrideLastName),
    DateOfMarriage, SolemnizingPriest, ScannedDocumentUrl
  FROM dbo.MarriageRecords
  UNION ALL
  SELECT 'death', DeathId, RegistryNumber,
    CONCAT(DeceasedFirstName, ' ', DeceasedLastName), DateOfDeath,
    OfficiatingPriest, ScannedDocumentUrl
  FROM dbo.DeathRecords
`

const postgresRecordQuery = `
  SELECT 'baptism' AS "RecordType", "BaptismId" AS "Id", "RegistryNumber",
    CONCAT("ChildFirstName", ' ', "ChildLastName") AS "Name", "DateOfBaptism" AS "RecordDate",
    "MinisterName" AS "Priest", "ScannedDocumentUrl"
  FROM "public"."BaptismRecords"
  UNION ALL
  SELECT 'confirmation', "ConfirmationId", "RegistryNumber",
    CONCAT("CandidateFirstName", ' ', "CandidateLastName"), "DateOfConfirmation",
    "BishopOrMinister", "ScannedDocumentUrl"
  FROM "public"."ConfirmationRecords"
  UNION ALL
  SELECT 'marriage', "MarriageId", "RegistryNumber",
    CONCAT("GroomFirstName", ' ', "GroomLastName", ' / ', "BrideFirstName", ' ', "BrideLastName"),
    "DateOfMarriage", "SolemnizingPriest", "ScannedDocumentUrl"
  FROM "public"."MarriageRecords"
  UNION ALL
  SELECT 'death', "DeathId", "RegistryNumber",
    CONCAT("DeceasedFirstName", ' ', "DeceasedLastName"), "DateOfDeath",
    "OfficiatingPriest", "ScannedDocumentUrl"
  FROM "public"."DeathRecords"
`

const sacramentalStatisticsQuery = `
  SELECT 'baptism' AS RecordType, DateOfBaptism AS RecordDate,
    DATEDIFF(YEAR, DateOfBirth, DateOfBaptism)
      - CASE WHEN DATEADD(YEAR, DATEDIFF(YEAR, DateOfBirth, DateOfBaptism), DateOfBirth) > DateOfBaptism THEN 1 ELSE 0 END AS PersonAge,
    CAST(NULL AS INT) AS GroomAge, CAST(NULL AS INT) AS BrideAge,
    CAST(NULL AS DECIMAL(5, 1)) AS MarriageAge
  FROM dbo.BaptismRecords
  UNION ALL
  SELECT 'confirmation', DateOfConfirmation, NULL, NULL, NULL, NULL
  FROM dbo.ConfirmationRecords
  UNION ALL
  SELECT 'marriage', DateOfMarriage, NULL, GroomAge, BrideAge,
    COALESCE((GroomAge + BrideAge) / 2.0, GroomAge, BrideAge)
  FROM dbo.MarriageRecords
  UNION ALL
  SELECT 'death', DateOfDeath, Age, NULL, NULL, NULL
  FROM dbo.DeathRecords
`

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function optionalDate(value) {
  if (value === undefined || value === '') return null
  return isIsoDate(value) ? value : undefined
}

function optionalPositiveInteger(value) {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function createAdminReportingRouter({
  getPool,
  sql,
  requireAdmin,
  requireRole,
  logError,
  uploadDirectory,
  uploadArchive,
  saveArchiveFile,
  requireAdminWithQueryToken,
  getArchiveFile,
  deleteArchiveFile,
  getPrivateFile,
  postgresCertificatesEnabled = false,
  postgresOperationsEnabled = false,
  postgresSacramentalEnabled = false,
  getPostgresPool,
}) {
  const router = express.Router()
  const financeAccess = [requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Bookkeeper'])]
  const recordsAccess = [requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff'])]
  const archiveFileAccess = [requireAdminWithQueryToken || requireAdmin, requireRole(['ParishPriest', 'Secretary', 'Staff'])]

  async function withPostgresTransaction(operation) {
    const client = await getPostgresPool().connect()
    let transactionStarted = false
    try {
      await client.query('BEGIN')
      transactionStarted = true
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK')
        } catch (rollbackError) {
          logError(rollbackError, { context: 'sacramentalTransactionRollback' })
        }
      }
      throw error
    } finally {
      client.release()
    }
  }

  router.post('/api/admin/sacramental/:type', ...recordsAccess, async (req, res, next) => {
    const record = sacramentRecords[req.params.type]
    if (!record) return next()
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'A sacramental record is required.' })
    }

    const columns = []
    const values = []
    const inputs = []
    for (const [index, field] of record.fields.entries()) {
      const key = field.column.charAt(0).toLowerCase() + field.column.slice(1)
      const rawValue = req.body[key] ?? req.body[field.column] ?? null
      let value = rawValue

      if (field.kind === 'text') {
        if (value !== null && typeof value !== 'string') {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
        value = typeof value === 'string' ? value.trim() || null : null
        if (value && field.length && value.length > field.length) {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
      } else if (field.kind === 'date') {
        if (value === '') value = null
        if (value !== null && !isIsoDate(value)) {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
      } else if (field.kind === 'integer') {
        if (value === '') value = null
        if (value !== null) {
          value = Number(value)
          if (!Number.isSafeInteger(value) || value < 0) {
            return res.status(400).json({ message: `Invalid value for ${key}.` })
          }
        }
      }

      if (field.required && (value === null || value === '')) {
        return res.status(400).json({ message: `${key} is required.` })
      }

      const type = field.kind === 'date'
        ? sql.Date
        : field.kind === 'integer'
          ? sql.Int
          : sql.NVarChar(field.length ?? sql.MAX)
      const parameter = `field${index}`
      inputs.push([parameter, type, value])
      columns.push(field.column)
      values.push(`@${parameter}`)
    }

    try {
      if (postgresSacramentalEnabled) {
        const createdBy = req.staff?.email || req.staff?.role || 'staff'
        const result = await getPostgresPool().query(`
          INSERT INTO "public"."${record.table}"
            (${columns.map(column => `"${column}"`).join(', ')}, "CreatedBy")
          VALUES (${inputs.map((_, index) => `$${index + 1}`).join(', ')}, $${inputs.length + 1})
          RETURNING "${record.idColumn}" AS id
        `, [...inputs.map(([, , value]) => value), createdBy])
        if (!result.rows[0]) throw new Error('Sacramental record insert returned no ID.')
        return res.status(201).json(result.rows[0])
      }

      const request = getPool().request()
      for (const [parameter, type, value] of inputs) request.input(parameter, type, value)
      request.input('createdBy', sql.NVarChar(256), req.staff?.email || req.staff?.role || 'staff')
      const result = await request.query(`
        INSERT INTO dbo.${record.table} (${columns.join(', ')}, CreatedBy)
        OUTPUT INSERTED.${record.idColumn} AS id
        VALUES (${values.join(', ')}, @createdBy)
      `)
      if (!result.recordset[0]) throw new Error('Sacramental record insert returned no ID.')
      res.status(201).json(result.recordset[0])
    } catch (error) {
      logError(error, { context: 'createSacramentalRecord' })
      res.status(500).json({ message: 'Unable to save sacramental record.' })
    }
  })

  router.put('/api/admin/sacramental/:type/:id', ...recordsAccess, async (req, res, next) => {
    const record = sacramentRecords[req.params.type]
    if (!record) return next()
    const id = optionalPositiveInteger(req.params.id)
    if (!id || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'A valid sacramental record and ID are required.' })
    }

    const assignments = []
    const inputs = []
    for (const [index, field] of record.fields.entries()) {
      const key = field.column.charAt(0).toLowerCase() + field.column.slice(1)
      const rawValue = req.body[key] ?? req.body[field.column] ?? null
      let value = rawValue

      if (field.kind === 'text') {
        if (value !== null && typeof value !== 'string') {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
        value = typeof value === 'string' ? value.trim() || null : null
        if (value && field.length && value.length > field.length) {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
      } else if (field.kind === 'date') {
        if (value === '') value = null
        if (value !== null && !isIsoDate(value)) {
          return res.status(400).json({ message: `Invalid value for ${key}.` })
        }
      } else if (field.kind === 'integer') {
        if (value === '') value = null
        if (value !== null) {
          value = Number(value)
          if (!Number.isSafeInteger(value) || value < 0) {
            return res.status(400).json({ message: `Invalid value for ${key}.` })
          }
        }
      }

      if (field.required && (value === null || value === '')) {
        return res.status(400).json({ message: `${key} is required.` })
      }

      const type = field.kind === 'date'
        ? sql.Date
        : field.kind === 'integer'
          ? sql.Int
          : sql.NVarChar(field.length ?? sql.MAX)
      const parameter = `field${index}`
      inputs.push([parameter, type, value])
      assignments.push(`${field.column} = @${parameter}`)
    }

    try {
      if (postgresSacramentalEnabled) {
        const values = inputs.map(([, , value]) => value)
        const assignments = record.fields.map((field, index) => `"${field.column}" = $${index + 1}`)
        assignments.push('"UpdatedAt" = timezone(\'UTC\', now())')
        const result = await withPostgresTransaction(async client => {
          const updated = await client.query(`
            UPDATE "public"."${record.table}"
            SET ${assignments.join(', ')}
            WHERE "${record.idColumn}" = $${values.length + 1}
          `, [...values, id])
          if (updated.rowCount === 0) return false

          await client.query(`
            INSERT INTO "public"."SacramentalRecordAudit"
              ("RecordType", "RecordId", "ActionName", "ChangedBy", "Changes")
            VALUES ($1, $2, 'Updated', $3, $4)
          `, [
            req.params.type,
            id,
            req.staff?.email || req.staff?.role || 'staff',
            JSON.stringify(Object.fromEntries(record.fields.map(field => [field.column, true]))),
          ])
          return true
        })
        if (!result) return res.status(404).json({ message: 'Sacramental record not found.' })
        return res.json({ message: 'Sacramental record updated.' })
      }

      const request = getPool().request()
      for (const [parameter, type, value] of inputs) request.input(parameter, type, value)
      request.input('id', sql.Int, id)
      request.input('recordType', sql.VarChar(30), req.params.type)
      request.input('changedBy', sql.NVarChar(256), req.staff?.email || req.staff?.role || 'staff')
      request.input('changes', sql.NVarChar(sql.MAX), JSON.stringify(
        Object.fromEntries(record.fields.map(field => [field.column, true])),
      ))
      const result = await request.query(`
        BEGIN TRY
          BEGIN TRANSACTION;
          UPDATE dbo.${record.table}
          SET ${assignments.join(', ')}
          WHERE ${record.idColumn} = @id;
          IF @@ROWCOUNT = 0
          BEGIN
            ROLLBACK TRANSACTION;
            SELECT CAST(0 AS bit) AS updated;
            RETURN;
          END;
          INSERT INTO dbo.SacramentalRecordAudit
            (RecordType, RecordId, ActionName, ChangedBy, Changes)
          VALUES
            (@recordType, @id, 'Updated', @changedBy, @changes);
          COMMIT TRANSACTION;
          SELECT CAST(1 AS bit) AS updated;
        END TRY
        BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          THROW;
        END CATCH
      `)
      if (!result.recordset[0]?.updated) {
        return res.status(404).json({ message: 'Sacramental record not found.' })
      }
      res.json({ message: 'Sacramental record updated.' })
    } catch (error) {
      logError(error, { context: 'updateSacramentalRecord' })
      res.status(500).json({ message: 'Unable to update sacramental record.' })
    }
  })

  router.delete('/api/admin/sacramental/:type/:id', ...recordsAccess, async (req, res, next) => {
    const record = sacramentRecords[req.params.type]
    if (!record) return next()
    const id = optionalPositiveInteger(req.params.id)
    if (!id) return res.status(400).json({ message: 'A valid sacramental record ID is required.' })

    try {
      if (postgresSacramentalEnabled) {
        const deleted = await withPostgresTransaction(async client => {
          const result = await client.query(`
            DELETE FROM "public"."${record.table}" WHERE "${record.idColumn}" = $1
          `, [id])
          if (result.rowCount === 0) return false

          await client.query(`
            INSERT INTO "public"."SacramentalRecordAudit"
              ("RecordType", "RecordId", "ActionName", "ChangedBy", "Changes")
            VALUES ($1, $2, 'Deleted', $3, $4)
          `, [
            req.params.type,
            id,
            req.staff?.email || req.staff?.role || 'staff',
            JSON.stringify({ deleted: true }),
          ])
          return true
        })
        if (!deleted) return res.status(404).json({ message: 'Sacramental record not found.' })
        return res.json({ message: 'Sacramental record deleted.' })
      }

      const result = await getPool().request()
        .input('id', sql.Int, id)
        .input('recordType', sql.VarChar(30), req.params.type)
        .input('changedBy', sql.NVarChar(256), req.staff?.email || req.staff?.role || 'staff')
        .input('changes', sql.NVarChar(sql.MAX), JSON.stringify({ deleted: true }))
        .query(`
          BEGIN TRY
            BEGIN TRANSACTION;
            DELETE FROM dbo.${record.table} WHERE ${record.idColumn} = @id;
            IF @@ROWCOUNT = 0
            BEGIN
              ROLLBACK TRANSACTION;
              SELECT CAST(0 AS bit) AS deleted;
              RETURN;
            END;
            INSERT INTO dbo.SacramentalRecordAudit
              (RecordType, RecordId, ActionName, ChangedBy, Changes)
            VALUES
              (@recordType, @id, 'Deleted', @changedBy, @changes);
            COMMIT TRANSACTION;
            SELECT CAST(1 AS bit) AS deleted;
          END TRY
          BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            THROW;
          END CATCH
        `)
      if (!result.recordset[0]?.deleted) {
        return res.status(404).json({ message: 'Sacramental record not found.' })
      }
      res.json({ message: 'Sacramental record deleted.' })
    } catch (error) {
      logError(error, { context: 'deleteSacramentalRecord' })
      res.status(500).json({ message: 'Unable to delete sacramental record.' })
    }
  })

  router.post('/api/admin/sacramental/upload-archive', ...recordsAccess, (req, res, next) => {
    if (!uploadArchive || !saveArchiveFile) {
      return res.status(500).json({ message: 'Archive uploads are not configured.' })
    }

    uploadArchive(req, res, error => {
      if (error) {
        logError(error, { context: 'sacramentalArchiveUploadMiddleware' })
        return res.status(400).json({ message: 'Only supported archive files up to 20 MB are accepted.' })
      }
      next()
    })
  }, async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Please select an archive file.' })
    try {
      const fileUrl = await saveArchiveFile(req.file)
      res.status(201).json({ fileUrl })
    } catch (error) {
      if (error?.statusCode === 400) {
        return res.status(400).json({ message: 'The archive file contents do not match its file type.' })
      }
      logError(error, { context: 'sacramentalArchiveUpload' })
      res.status(500).json({ message: 'Unable to upload the sacramental archive.' })
    }
  })

  router.get('/api/admin/sacramental/archives/:id/file', ...archiveFileAccess, async (req, res) => {
    const id = optionalPositiveInteger(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid archive ID.' })
    if (!getArchiveFile) return res.status(500).json({ message: 'Archive file storage is not configured.' })

    try {
      const archive = postgresSacramentalEnabled
        ? await getPostgresPool().query(`
            SELECT "FileUrl" FROM "public"."SacramentalArchives"
            WHERE "ArchiveId" = $1
          `, [id])
        : await getPool().request()
          .input('id', sql.Int, id)
          .query('SELECT FileUrl FROM dbo.SacramentalArchives WHERE ArchiveId = @id')
      const fileUrl = postgresSacramentalEnabled ? archive.rows[0]?.FileUrl : archive.recordset[0]?.FileUrl
      if (!fileUrl) return res.status(404).json({ message: 'Archive not found.' })

      const file = await getArchiveFile(fileUrl)
      res.set('Content-Type', file.contentType)
      res.set('Content-Disposition', `inline; filename="${file.filename.replace(/["\\]/g, '')}"`)
      res.set('Cache-Control', 'private, no-store')
      res.set('X-Content-Type-Options', 'nosniff')
      res.send(file.contents)
    } catch (error) {
      if (error?.statusCode === 404) return res.status(404).json({ message: 'Archive file not found.' })
      logError(error, { context: 'sacramentalArchiveFile' })
      res.status(500).json({ message: 'Unable to load the sacramental archive file.' })
    }
  })

  router.get('/api/admin/operations/finance/report', ...financeAccess, async (req, res) => {
    const start = optionalDate(req.query.start)
    const end = optionalDate(req.query.end)
    const type = req.query.type || null
    if (
      start === undefined || end === undefined ||
      (start && end && start > end) ||
      (type !== null && (typeof type !== 'string' || !financeTypes.has(type)))
    ) {
      return res.status(400).json({ message: 'Provide valid finance report filters.' })
    }

    try {
      if (postgresOperationsEnabled) {
        const result = await getPostgresPool().query(`
          SELECT "EntryType", COUNT(*) AS "EntryCount", SUM("Amount") AS "Total"
          FROM "public"."FinancialEntries"
          WHERE "Status" IN ('Approved', 'Reconciled')
            AND ($1::date IS NULL OR "EntryDate" >= $1::date)
            AND ($2::date IS NULL OR "EntryDate" <= $2::date)
            AND ($3::varchar IS NULL OR "EntryType" = $3::varchar)
          GROUP BY "EntryType"
          ORDER BY "EntryType"
        `, [start, end, type])
        return res.json({
          totals: result.rows.map(row => ({
            ...row,
            EntryCount: Number(row.EntryCount),
            Total: Number(row.Total),
          })),
        })
      }

      const result = await getPool().request()
        .input('start', sql.Date, start)
        .input('end', sql.Date, end)
        .input('type', sql.VarChar(30), type)
        .query(`
          SELECT EntryType, COUNT(*) AS EntryCount, SUM(Amount) AS Total
          FROM dbo.FinancialEntries
          WHERE Status IN ('Approved', 'Reconciled')
            AND (@start IS NULL OR EntryDate >= @start)
            AND (@end IS NULL OR EntryDate <= @end)
            AND (@type IS NULL OR EntryType = @type)
          GROUP BY EntryType
          ORDER BY EntryType
        `)
      res.json({ totals: result.recordset })
    } catch (error) {
      logError(error, { context: 'financeReport' })
      res.status(500).json({ message: 'Unable to load the finance report.' })
    }
  })

  router.get('/api/admin/operations/finance/reports', ...financeAccess, async (_req, res) => {
    try {
      if (postgresOperationsEnabled) {
        const result = await getPostgresPool().query(`
          SELECT "FinanceReportSnapshotId", "ReportType", "PeriodStart", "PeriodEnd",
            "TotalIncome", "TotalExpenses", "NetTotal", "GeneratedAt", "GeneratedBy"
          FROM "public"."FinanceReportSnapshots"
          ORDER BY "GeneratedAt" DESC, "FinanceReportSnapshotId" DESC
          LIMIT 100
        `)
        return res.json(result.rows.map(row => ({
          ...row,
          TotalIncome: Number(row.TotalIncome),
          TotalExpenses: Number(row.TotalExpenses),
          NetTotal: Number(row.NetTotal),
        })))
      }

      const result = await getPool().request().query(`
        SELECT TOP 100 FinanceReportSnapshotId, ReportType, PeriodStart, PeriodEnd,
          TotalIncome, TotalExpenses, NetTotal, GeneratedAt, GeneratedBy
        FROM dbo.FinanceReportSnapshots
        ORDER BY GeneratedAt DESC, FinanceReportSnapshotId DESC
      `)
      res.json(result.recordset)
    } catch (error) {
      logError(error, { context: 'financeReportHistory' })
      res.status(500).json({ message: 'Unable to load finance report history.' })
    }
  })

  router.get('/api/admin/operations/finance/audit', ...financeAccess, async (_req, res) => {
    try {
      if (postgresOperationsEnabled) {
        const result = await getPostgresPool().query(`
          SELECT audit."AuditId", audit."FinancialEntryId", audit."ActionName",
            COALESCE(entry."EntryType", 'Unknown') AS "EntryType",
            COALESCE(entry."Description", 'Entry no longer exists') AS "Description",
            audit."ChangedBy", audit."ChangedAt", audit."Details"
          FROM "public"."FinancialEntryAudit" audit
          LEFT JOIN "public"."FinancialEntries" entry
            ON entry."FinancialEntryId" = audit."FinancialEntryId"
          ORDER BY audit."ChangedAt" DESC, audit."AuditId" DESC
          LIMIT 200
        `)
        return res.json(result.rows)
      }

      const result = await getPool().request().query(`
        SELECT TOP 200 audit.AuditId, audit.FinancialEntryId, audit.ActionName,
          COALESCE(entry.EntryType, 'Unknown') AS EntryType,
          COALESCE(entry.Description, 'Entry no longer exists') AS Description,
          audit.ChangedBy, audit.ChangedAt, audit.Details
        FROM dbo.FinancialEntryAudit audit
        LEFT JOIN dbo.FinancialEntries entry
          ON entry.FinancialEntryId = audit.FinancialEntryId
        ORDER BY audit.ChangedAt DESC, audit.AuditId DESC
      `)
      res.json(result.recordset)
    } catch (error) {
      logError(error, { context: 'financeAudit' })
      res.status(500).json({ message: 'Unable to load finance audit history.' })
    }
  })

  router.get('/api/admin/operations/statistics', ...recordsAccess, async (req, res) => {
    const rawYear = req.query.year
    const year = rawYear === undefined ? new Date().getFullYear() : Number(rawYear)
    if (
      (rawYear !== undefined && (typeof rawYear !== 'string' || !/^\d{4}$/.test(rawYear))) ||
      !Number.isSafeInteger(year) || year < 1900 || year > 9998
    ) {
      return res.status(400).json({ message: 'Provide a valid statistics year.' })
    }

    try {
      if (postgresSacramentalEnabled) {
        const summaryResult = await getPostgresPool().query(`
          WITH "Records" AS (
            SELECT 'baptism' AS "RecordType", "DateOfBaptism" AS "RecordDate",
              EXTRACT(YEAR FROM age("DateOfBaptism", "DateOfBirth")) AS "PersonAge",
              NULL::integer AS "GroomAge", NULL::integer AS "BrideAge",
              NULL::numeric AS "MarriageAge"
            FROM "public"."BaptismRecords"
            UNION ALL
            SELECT 'confirmation', "DateOfConfirmation", NULL, NULL, NULL, NULL
            FROM "public"."ConfirmationRecords"
            UNION ALL
            SELECT 'marriage', "DateOfMarriage", NULL, "GroomAge", "BrideAge",
              COALESCE(
                ("GroomAge" + "BrideAge") / 2.0,
                "GroomAge"::numeric,
                "BrideAge"::numeric
              )
            FROM "public"."MarriageRecords"
            UNION ALL
            SELECT 'death', "DateOfDeath", "Age", NULL, NULL, NULL
            FROM "public"."DeathRecords"
          )
          SELECT
            COUNT(*) FILTER (WHERE "RecordType" = 'baptism') AS "totalBaptisms",
            COUNT(*) FILTER (WHERE "RecordType" = 'confirmation') AS "totalConfirmations",
            COUNT(*) FILTER (WHERE "RecordType" = 'marriage') AS "totalMarriages",
            COUNT(*) FILTER (WHERE "RecordType" = 'death') AS "totalDeaths",
            COUNT(*) FILTER (WHERE "RecordType" = 'baptism' AND "PersonAge" < 1) AS "InfantsUnder1Yr",
            COUNT(*) FILTER (WHERE "RecordType" = 'baptism' AND "PersonAge" >= 1) AS "ChildrenOver1Yr",
            AVG("GroomAge") FILTER (WHERE "RecordType" = 'marriage') AS "AvgGroomAge",
            AVG("BrideAge") FILTER (WHERE "RecordType" = 'marriage') AS "AvgBrideAge",
            COUNT(*) FILTER (WHERE "RecordType" = 'marriage' AND "MarriageAge" < 25) AS "Under25",
            COUNT(*) FILTER (WHERE "RecordType" = 'marriage' AND "MarriageAge" BETWEEN 25 AND 35) AS "Age25To35",
            COUNT(*) FILTER (WHERE "RecordType" = 'marriage' AND "MarriageAge" > 35) AS "Over35",
            AVG("PersonAge") FILTER (WHERE "RecordType" = 'death') AS "AvgDeceasedAge",
            COUNT(*) FILTER (WHERE "RecordType" = 'death' AND "PersonAge" < 18) AS "Under18",
            COUNT(*) FILTER (WHERE "RecordType" = 'death' AND "PersonAge" BETWEEN 18 AND 59) AS "Age18To59",
            COUNT(*) FILTER (WHERE "RecordType" = 'death' AND "PersonAge" >= 60) AS "Senior60Plus"
          FROM "Records"
          WHERE "RecordDate" >= make_date($1::integer, 1, 1)
            AND "RecordDate" < make_date($1::integer + 1, 1, 1)
        `, [year])

        const monthlyResult = await getPostgresPool().query(`
          WITH "Records" AS (
            SELECT 'baptism' AS "RecordType", "DateOfBaptism" AS "RecordDate" FROM "public"."BaptismRecords"
            UNION ALL
            SELECT 'confirmation', "DateOfConfirmation" FROM "public"."ConfirmationRecords"
            UNION ALL
            SELECT 'marriage', "DateOfMarriage" FROM "public"."MarriageRecords"
            UNION ALL
            SELECT 'death', "DateOfDeath" FROM "public"."DeathRecords"
          ),
          "MonthlyCounts" AS (
            SELECT EXTRACT(MONTH FROM "RecordDate")::integer AS "MonthNumber",
              COUNT(*) FILTER (WHERE "RecordType" = 'baptism') AS baptisms,
              COUNT(*) FILTER (WHERE "RecordType" = 'confirmation') AS confirmations,
              COUNT(*) FILTER (WHERE "RecordType" = 'marriage') AS marriages,
              COUNT(*) FILTER (WHERE "RecordType" = 'death') AS deaths
            FROM "Records"
            WHERE "RecordDate" >= make_date($1::integer, 1, 1)
              AND "RecordDate" < make_date($1::integer + 1, 1, 1)
            GROUP BY EXTRACT(MONTH FROM "RecordDate")::integer
          )
          SELECT months.month_number AS month,
            to_char(make_date($1::integer, months.month_number, 1), 'FMMonth') AS "monthName",
            COALESCE(counts.baptisms, 0) AS baptisms,
            COALESCE(counts.confirmations, 0) AS confirmations,
            COALESCE(counts.marriages, 0) AS marriages,
            COALESCE(counts.deaths, 0) AS deaths
          FROM generate_series(1, 12) AS months(month_number)
          LEFT JOIN "MonthlyCounts" counts ON counts."MonthNumber" = months.month_number
          ORDER BY months.month_number
        `, [year])

        const summary = summaryResult.rows[0] || {}
        const numeric = value => value === null || value === undefined ? null : Number(value)
        return res.json({
          targetYear: year,
          summary: {
            totalBaptisms: Number(summary.totalBaptisms || 0),
            totalConfirmations: Number(summary.totalConfirmations || 0),
            totalMarriages: Number(summary.totalMarriages || 0),
            totalDeaths: Number(summary.totalDeaths || 0),
          },
          demographics: {
            baptisms: {
              InfantsUnder1Yr: Number(summary.InfantsUnder1Yr || 0),
              ChildrenOver1Yr: Number(summary.ChildrenOver1Yr || 0),
            },
            marriages: {
              AvgGroomAge: numeric(summary.AvgGroomAge),
              AvgBrideAge: numeric(summary.AvgBrideAge),
              Under25: Number(summary.Under25 || 0),
              Age25To35: Number(summary.Age25To35 || 0),
              Over35: Number(summary.Over35 || 0),
            },
            deaths: {
              AvgDeceasedAge: numeric(summary.AvgDeceasedAge),
              Under18: Number(summary.Under18 || 0),
              Age18To59: Number(summary.Age18To59 || 0),
              Senior60Plus: Number(summary.Senior60Plus || 0),
            },
          },
          monthlyBreakdown: monthlyResult.rows.map(row => ({
            ...row,
            baptisms: Number(row.baptisms),
            confirmations: Number(row.confirmations),
            marriages: Number(row.marriages),
            deaths: Number(row.deaths),
          })),
        })
      }

      const summaryResult = await getPool().request()
        .input('year', sql.Int, year)
        .query(`
          WITH Records AS (${sacramentalStatisticsQuery})
          SELECT
            COUNT(CASE WHEN RecordType = 'baptism' THEN 1 END) AS totalBaptisms,
            COUNT(CASE WHEN RecordType = 'confirmation' THEN 1 END) AS totalConfirmations,
            COUNT(CASE WHEN RecordType = 'marriage' THEN 1 END) AS totalMarriages,
            COUNT(CASE WHEN RecordType = 'death' THEN 1 END) AS totalDeaths,
            COUNT(CASE WHEN RecordType = 'baptism' AND PersonAge < 1 THEN 1 END) AS InfantsUnder1Yr,
            COUNT(CASE WHEN RecordType = 'baptism' AND PersonAge >= 1 THEN 1 END) AS ChildrenOver1Yr,
            AVG(CASE WHEN RecordType = 'marriage' THEN GroomAge END) AS AvgGroomAge,
            AVG(CASE WHEN RecordType = 'marriage' THEN BrideAge END) AS AvgBrideAge,
            COUNT(CASE WHEN RecordType = 'marriage' AND MarriageAge < 25 THEN 1 END) AS Under25,
            COUNT(CASE WHEN RecordType = 'marriage' AND MarriageAge BETWEEN 25 AND 35 THEN 1 END) AS Age25To35,
            COUNT(CASE WHEN RecordType = 'marriage' AND MarriageAge > 35 THEN 1 END) AS Over35,
            AVG(CASE WHEN RecordType = 'death' THEN PersonAge END) AS AvgDeceasedAge,
            COUNT(CASE WHEN RecordType = 'death' AND PersonAge < 18 THEN 1 END) AS Under18,
            COUNT(CASE WHEN RecordType = 'death' AND PersonAge BETWEEN 18 AND 59 THEN 1 END) AS Age18To59,
            COUNT(CASE WHEN RecordType = 'death' AND PersonAge >= 60 THEN 1 END) AS Senior60Plus
          FROM Records
          WHERE RecordDate >= DATEFROMPARTS(@year, 1, 1)
            AND RecordDate < DATEFROMPARTS(@year + 1, 1, 1)
        `)
      const monthlyResult = await getPool().request()
        .input('year', sql.Int, year)
        .query(`
          WITH Records AS (${sacramentalStatisticsQuery}),
          MonthlyCounts AS (
            SELECT MONTH(RecordDate) AS MonthNumber,
              COUNT(CASE WHEN RecordType = 'baptism' THEN 1 END) AS baptisms,
              COUNT(CASE WHEN RecordType = 'confirmation' THEN 1 END) AS confirmations,
              COUNT(CASE WHEN RecordType = 'marriage' THEN 1 END) AS marriages,
              COUNT(CASE WHEN RecordType = 'death' THEN 1 END) AS deaths
            FROM Records
            WHERE RecordDate >= DATEFROMPARTS(@year, 1, 1)
              AND RecordDate < DATEFROMPARTS(@year + 1, 1, 1)
            GROUP BY MONTH(RecordDate)
          ),
          Months AS (
            SELECT MonthNumber FROM (VALUES
              (1), (2), (3), (4), (5), (6),
              (7), (8), (9), (10), (11), (12)
            ) AS MonthList(MonthNumber)
          )
          SELECT Months.MonthNumber AS month,
            DATENAME(MONTH, DATEFROMPARTS(@year, Months.MonthNumber, 1)) AS monthName,
            COALESCE(MonthlyCounts.baptisms, 0) AS baptisms,
            COALESCE(MonthlyCounts.confirmations, 0) AS confirmations,
            COALESCE(MonthlyCounts.marriages, 0) AS marriages,
            COALESCE(MonthlyCounts.deaths, 0) AS deaths
          FROM Months
          LEFT JOIN MonthlyCounts ON MonthlyCounts.MonthNumber = Months.MonthNumber
          ORDER BY Months.MonthNumber
        `)

      const summary = summaryResult.recordset[0] || {}
      res.json({
        targetYear: year,
        summary: {
          totalBaptisms: Number(summary.totalBaptisms || 0),
          totalConfirmations: Number(summary.totalConfirmations || 0),
          totalMarriages: Number(summary.totalMarriages || 0),
          totalDeaths: Number(summary.totalDeaths || 0),
        },
        demographics: {
          baptisms: {
            InfantsUnder1Yr: Number(summary.InfantsUnder1Yr || 0),
            ChildrenOver1Yr: Number(summary.ChildrenOver1Yr || 0),
          },
          marriages: {
            AvgGroomAge: summary.AvgGroomAge,
            AvgBrideAge: summary.AvgBrideAge,
            Under25: Number(summary.Under25 || 0),
            Age25To35: Number(summary.Age25To35 || 0),
            Over35: Number(summary.Over35 || 0),
          },
          deaths: {
            AvgDeceasedAge: summary.AvgDeceasedAge,
            Under18: Number(summary.Under18 || 0),
            Age18To59: Number(summary.Age18To59 || 0),
            Senior60Plus: Number(summary.Senior60Plus || 0),
          },
        },
        monthlyBreakdown: monthlyResult.recordset,
      })
    } catch (error) {
      logError(error, { context: 'sacramentalStatistics' })
      res.status(500).json({ message: 'Unable to load sacramental statistics.' })
    }
  })

  router.get('/api/admin/certificate-requests', ...recordsAccess, async (_req, res) => {
    try {
      if (postgresCertificatesEnabled) {
        return res.json(await listPostgresCertificateRequests(getPostgresPool()))
      }
      const result = await getPool().request().query(`
        SELECT request.CertificateRequestId, request.CertificateType,
          request.FirstName, request.LastName, request.ContactEmail AS EmailAddress,
          request.ContactPhone, request.ReferenceCode, request.PreferredDate,
          request.PreferredTime, request.Status, request.Notes, request.CreatedAt,
          request.UpdatedAt, COUNT(document.CertificateRequestDocumentId) AS DocumentCount
        FROM dbo.CertificateRequests request
        LEFT JOIN dbo.CertificateRequestDocuments document
          ON document.CertificateRequestId = request.CertificateRequestId
        GROUP BY request.CertificateRequestId, request.CertificateType,
          request.FirstName, request.LastName, request.ContactEmail, request.ContactPhone,
          request.ReferenceCode, request.PreferredDate, request.PreferredTime,
          request.Status, request.Notes, request.CreatedAt, request.UpdatedAt
        ORDER BY request.CreatedAt DESC, request.CertificateRequestId DESC
      `)
      res.json(result.recordset)
    } catch (error) {
      logError(error, { context: 'adminCertificateRequests' })
      res.status(500).json({ message: 'Unable to load certificate requests.' })
    }
  })

  router.get('/api/admin/certificate-requests/:requestId/documents', ...recordsAccess, async (req, res) => {
    const requestId = optionalPositiveInteger(req.params.requestId)
    if (requestId === undefined || requestId === null) {
      return res.status(400).json({ message: 'Invalid certificate request ID.' })
    }

    try {
      if (postgresCertificatesEnabled) {
        const documents = await listPostgresCertificateUploads(getPostgresPool(), requestId)
        return res.json(documents.map(document => ({
          ...document,
          FileUrl: `/api/admin/certificate-requests/${requestId}/documents/${document.CertificateRequestDocumentId}/file`,
        })))
      }
      const result = await getPool().request()
        .input('requestId', sql.Int, requestId)
        .query(`
          SELECT CertificateRequestDocumentId, OriginalFileName, MimeType,
            FileSizeBytes, UploadedAt
          FROM dbo.CertificateRequestDocuments
          WHERE CertificateRequestId = @requestId
          ORDER BY UploadedAt DESC, CertificateRequestDocumentId DESC
        `)
      res.json(result.recordset.map(document => ({
        ...document,
        FileUrl: `/api/admin/certificate-requests/${requestId}/documents/${document.CertificateRequestDocumentId}/file`,
      })))
    } catch (error) {
      logError(error, { context: 'adminCertificateRequestDocuments' })
      res.status(500).json({ message: 'Unable to load certificate request documents.' })
    }
  })

  router.get('/api/admin/certificate-requests/:requestId/documents/:documentId/file', ...recordsAccess, async (req, res) => {
    const requestId = optionalPositiveInteger(req.params.requestId)
    const documentId = optionalPositiveInteger(req.params.documentId)
    if (!requestId || !documentId || !uploadDirectory) {
      return res.status(400).json({ message: 'Invalid certificate document request.' })
    }

    try {
      if (postgresCertificatesEnabled) {
        const document = await getPostgresCertificateDocument(getPostgresPool(), requestId, documentId)
        if (!document) return res.status(404).json({ message: 'Certificate document not found.' })

        const fileName = path.basename(document.StoredFileName || '')
        if (!/^[A-Za-z0-9._-]+$/.test(fileName) || fileName.includes('..')) {
          return res.status(404).json({ message: 'Certificate document not found.' })
        }

        if (getPrivateFile) {
          const file = await getPrivateFile(fileName)
          res.type(document.MimeType)
          res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.OriginalFileName)}`)
          res.set('Cache-Control', 'private, no-store')
          res.set('X-Content-Type-Options', 'nosniff')
          return res.send(file.contents)
        }

        const filePath = path.resolve(uploadDirectory, fileName)
        if (!fileName || filePath !== path.join(path.resolve(uploadDirectory), fileName)) {
          return res.status(404).json({ message: 'Certificate document not found.' })
        }

        res.type(document.MimeType)
        res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.OriginalFileName)}`)
        return res.sendFile(filePath, error => {
          if (error && !res.headersSent) {
            if (error.code === 'ENOENT') return res.status(404).json({ message: 'Certificate document not found.' })
            logError(error, { context: 'adminCertificateDocumentFile' })
            res.status(500).json({ message: 'Unable to open certificate document.' })
          }
        })
      }
      const result = await getPool().request()
        .input('requestId', sql.Int, requestId)
        .input('documentId', sql.Int, documentId)
        .query(`
          SELECT StoredFileName, OriginalFileName, MimeType
          FROM dbo.CertificateRequestDocuments
          WHERE CertificateRequestId = @requestId
            AND CertificateRequestDocumentId = @documentId
        `)
      const document = result.recordset[0]
      if (!document) return res.status(404).json({ message: 'Certificate document not found.' })

      const fileName = path.basename(document.StoredFileName || '')
      const filePath = path.resolve(uploadDirectory, fileName)
      if (!fileName || filePath !== path.join(path.resolve(uploadDirectory), fileName)) {
        return res.status(404).json({ message: 'Certificate document not found.' })
      }

      res.type(document.MimeType)
      res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.OriginalFileName)}`)
      res.sendFile(filePath, error => {
        if (error && !res.headersSent) {
          if (error.code === 'ENOENT') return res.status(404).json({ message: 'Certificate document not found.' })
          logError(error, { context: 'adminCertificateDocumentFile' })
          res.status(500).json({ message: 'Unable to open certificate document.' })
        }
      })
    } catch (error) {
      if (error?.statusCode === 404) {
        return res.status(404).json({ message: 'Certificate document not found.' })
      }
      logError(error, { context: 'adminCertificateDocumentFile' })
      res.status(500).json({ message: 'Unable to open certificate document.' })
    }
  })

  router.put('/api/admin/certificate-requests/:requestId', ...recordsAccess, async (req, res) => {
    const requestId = optionalPositiveInteger(req.params.requestId)
    const status = req.body?.status
    const statuses = new Set(['Requested', 'Confirmed', 'ReadyForClaim', 'Claimed', 'Rejected'])
    if (!requestId || typeof status !== 'string' || !statuses.has(status)) {
      return res.status(400).json({ message: 'Provide a valid certificate request status.' })
    }

    try {
      if (postgresCertificatesEnabled) {
        if (!await setPostgresCertificateRequestStatus(getPostgresPool(), requestId, status)) {
          return res.status(404).json({ message: 'Certificate request not found.' })
        }
        return res.json({ message: 'Certificate request updated.' })
      }
      const result = await getPool().request()
        .input('requestId', sql.Int, requestId)
        .input('status', sql.VarChar(30), status)
        .query(`
          UPDATE dbo.CertificateRequests
          SET Status = @status, UpdatedAt = SYSUTCDATETIME()
          OUTPUT INSERTED.CertificateRequestId
          WHERE CertificateRequestId = @requestId
        `)
      if (!result.recordset[0]) return res.status(404).json({ message: 'Certificate request not found.' })
      res.json({ message: 'Certificate request updated.' })
    } catch (error) {
      logError(error, { context: 'adminCertificateRequestUpdate' })
      res.status(500).json({ message: 'Unable to update certificate request.' })
    }
  })

  router.delete('/api/admin/certificate-requests/:requestId', ...recordsAccess, async (req, res) => {
    const requestId = optionalPositiveInteger(req.params.requestId)
    if (!requestId) return res.status(400).json({ message: 'Invalid certificate request ID.' })

    try {
      if (postgresCertificatesEnabled) {
        if (!await deletePostgresCertificateRequest(getPostgresPool(), requestId)) {
          return res.status(404).json({ message: 'Certificate request not found.' })
        }
        return res.json({ message: 'Certificate request deleted.' })
      }
      const result = await getPool().request()
        .input('requestId', sql.Int, requestId)
        .query(`
          BEGIN TRANSACTION
          IF NOT EXISTS (
            SELECT 1 FROM dbo.CertificateRequests WHERE CertificateRequestId = @requestId
          )
          BEGIN
            ROLLBACK TRANSACTION
            SELECT CAST(0 AS bit) AS Deleted
            RETURN
          END
          DELETE FROM dbo.CertificateRequestDocuments WHERE CertificateRequestId = @requestId
          DELETE FROM dbo.CertificateRequests WHERE CertificateRequestId = @requestId
          COMMIT TRANSACTION
          SELECT CAST(1 AS bit) AS Deleted
        `)
      if (!result.recordset[0]?.Deleted) {
        return res.status(404).json({ message: 'Certificate request not found.' })
      }
      res.json({ message: 'Certificate request deleted.' })
    } catch (error) {
      logError(error, { context: 'adminCertificateRequestDelete' })
      res.status(500).json({ message: 'Unable to delete certificate request.' })
    }
  })

  router.get('/api/admin/sacramental/search', ...recordsAccess, async (req, res) => {
    const type = req.query.type || null
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const priest = typeof req.query.priest === 'string' ? req.query.priest.trim() : ''
    const start = optionalDate(req.query.startDate)
    const end = optionalDate(req.query.endDate)
    const page = optionalPositiveInteger(req.query.page) ?? 1
    const limit = optionalPositiveInteger(req.query.limit) ?? 50
    if (
      (type !== null && (typeof type !== 'string' || !sacramentTypes.has(type))) ||
      start === undefined || end === undefined ||
      (start && end && start > end) ||
      (req.query.page !== undefined && optionalPositiveInteger(req.query.page) === undefined) ||
      (req.query.limit !== undefined && optionalPositiveInteger(req.query.limit) === undefined) ||
      limit > 100 || q.length > 100 || priest.length > 100
    ) {
      return res.status(400).json({ message: 'Provide valid sacramental search filters.' })
    }

    const offset = (page - 1) * limit
    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({ message: 'The requested page is out of range.' })
    }

    const where = `
      WHERE (@type IS NULL OR RecordType = @type)
        AND (@q IS NULL OR RegistryNumber LIKE @q OR Name LIKE @q)
        AND (@start IS NULL OR RecordDate >= @start)
        AND (@end IS NULL OR RecordDate <= @end)
        AND (@priest IS NULL OR Priest LIKE @priest)
    `
    const bindFilters = request => request
      .input('type', sql.VarChar(20), type)
      .input('q', sql.NVarChar(202), q ? `%${q}%` : null)
      .input('start', sql.Date, start)
      .input('end', sql.Date, end)
      .input('priest', sql.NVarChar(202), priest ? `%${priest}%` : null)

    try {
      if (postgresSacramentalEnabled) {
        const values = [
          type,
          q ? `%${q}%` : null,
          start,
          end,
          priest ? `%${priest}%` : null,
        ]
        const where = `
          WHERE ($1::varchar IS NULL OR "RecordType" = $1::varchar)
            AND ($2::varchar IS NULL OR "RegistryNumber" ILIKE $2::varchar OR "Name" ILIKE $2::varchar)
            AND ($3::date IS NULL OR "RecordDate" >= $3::date)
            AND ($4::date IS NULL OR "RecordDate" <= $4::date)
            AND ($5::varchar IS NULL OR "Priest" ILIKE $5::varchar)
        `
        const count = await getPostgresPool().query(`
          WITH "Records" AS (${postgresRecordQuery})
          SELECT COUNT(*) AS "total" FROM "Records" ${where}
        `, values)
        const result = await getPostgresPool().query(`
          WITH "Records" AS (${postgresRecordQuery})
          SELECT "RecordType", "Id", "RegistryNumber", "Name", "RecordDate", "Priest", "ScannedDocumentUrl"
          FROM "Records" ${where}
          ORDER BY "RecordDate" DESC, "Id" DESC
          OFFSET $6::integer LIMIT $7::integer
        `, [...values, offset, limit])
        return res.json({
          records: result.rows,
          pagination: { page, limit, total: Number(count.rows[0]?.total || 0) },
        })
      }

      const count = await bindFilters(getPool().request()).query(`
        WITH Records AS (${recordQuery})
        SELECT COUNT(*) AS total FROM Records ${where}
      `)
      const result = await bindFilters(getPool().request())
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limit)
        .query(`
          WITH Records AS (${recordQuery})
          SELECT RecordType, Id, RegistryNumber, Name, RecordDate, Priest, ScannedDocumentUrl
          FROM Records ${where}
          ORDER BY RecordDate DESC, Id DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `)
      res.json({
        records: result.recordset,
        pagination: { page, limit, total: Number(count.recordset[0]?.total || 0) },
      })
    } catch (error) {
      logError(error, { context: 'sacramentalSearch' })
      res.status(500).json({ message: 'Unable to search sacramental records.' })
    }
  })

  router.get('/api/admin/sacramental/archives', ...recordsAccess, async (req, res) => {
    const sacramentType = req.query.sacramentType || null
    const bookNumber = optionalPositiveInteger(req.query.bookNumber)
    const pageNumber = optionalPositiveInteger(req.query.pageNumber)
    const registryNumber = typeof req.query.registryNumber === 'string'
      ? req.query.registryNumber.trim()
      : ''
    if (
      (sacramentType !== null && (typeof sacramentType !== 'string' || !sacramentTypes.has(sacramentType))) ||
      bookNumber === undefined || pageNumber === undefined ||
      (req.query.registryNumber !== undefined && typeof req.query.registryNumber !== 'string') ||
      registryNumber.length > 50
    ) {
      return res.status(400).json({ message: 'Provide valid archive filters.' })
    }

    try {
      const result = postgresSacramentalEnabled
        ? await getPostgresPool().query(`
            SELECT "ArchiveId", "SacramentType", "BookNumber", "PageNumber",
              "RegistryNumber", "FileUrl", "Notes", "UploadedAt", "UploadedBy"
            FROM "public"."SacramentalArchives"
            WHERE ($1::varchar IS NULL OR "SacramentType" = $1::varchar)
              AND ($2::integer IS NULL OR "BookNumber" = $2::integer)
              AND ($3::integer IS NULL OR "PageNumber" = $3::integer)
              AND ($4::varchar IS NULL OR "RegistryNumber" = $4::varchar)
            ORDER BY "UploadedAt" DESC, "ArchiveId" DESC
          `, [sacramentType, bookNumber, pageNumber, registryNumber || null])
        : await getPool().request()
          .input('sacramentType', sql.VarChar(30), sacramentType)
          .input('bookNumber', sql.Int, bookNumber)
          .input('pageNumber', sql.Int, pageNumber)
          .input('registryNumber', sql.NVarChar(50), registryNumber || null)
          .query(`
            SELECT ArchiveId, SacramentType, BookNumber, PageNumber, RegistryNumber,
              FileUrl, Notes,
              UploadedAt, UploadedBy
            FROM dbo.SacramentalArchives
            WHERE (@sacramentType IS NULL OR SacramentType = @sacramentType)
              AND (@bookNumber IS NULL OR BookNumber = @bookNumber)
              AND (@pageNumber IS NULL OR PageNumber = @pageNumber)
              AND (@registryNumber IS NULL OR RegistryNumber = @registryNumber)
            ORDER BY UploadedAt DESC, ArchiveId DESC
          `)
      const archives = postgresSacramentalEnabled ? result.rows : result.recordset
      res.json({
        archives: archives.map(archive => ({
          ...archive,
          FileUrl: `/api/admin/sacramental/archives/${archive.ArchiveId}/file`,
        })),
      })
    } catch (error) {
      logError(error, { context: 'sacramentalArchives' })
      res.status(500).json({ message: 'Unable to load sacramental archives.' })
    }
  })

  router.post('/api/admin/sacramental/archives', ...recordsAccess, async (req, res) => {
    const { sacramentType, bookNumber, pageNumber, registryNumber, fileUrl, notes } = req.body || {}
    const normalizedRegistryNumber = typeof registryNumber === 'string' ? registryNumber.trim() || null : null
    const parsedBookNumber = Number(bookNumber)
    const parsedPageNumber = Number(pageNumber)
    if (
      typeof sacramentType !== 'string' || !sacramentTypes.has(sacramentType) ||
      !Number.isSafeInteger(parsedBookNumber) || parsedBookNumber < 1 ||
      !Number.isSafeInteger(parsedPageNumber) || parsedPageNumber < 1 ||
      (registryNumber !== undefined && registryNumber !== null && typeof registryNumber !== 'string') ||
      (normalizedRegistryNumber !== null && normalizedRegistryNumber.length > 50) ||
      typeof fileUrl !== 'string' || !fileUrl.trim() || fileUrl.length > 1000 ||
      (notes !== undefined && notes !== null && typeof notes !== 'string')
    ) {
      return res.status(400).json({ message: 'Provide valid archive details.' })
    }

    try {
      const uploadedBy = req.staff?.email || req.staff?.role || 'staff'
      const result = postgresSacramentalEnabled
        ? await getPostgresPool().query(`
            INSERT INTO "public"."SacramentalArchives"
              ("SacramentType", "BookNumber", "PageNumber", "RegistryNumber", "FileUrl", "Notes", "UploadedBy")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING "ArchiveId" AS id
          `, [
            sacramentType,
            parsedBookNumber,
            parsedPageNumber,
            normalizedRegistryNumber,
            fileUrl.trim(),
            notes?.trim() || null,
            uploadedBy,
          ])
        : await getPool().request()
          .input('sacramentType', sql.VarChar(30), sacramentType)
          .input('bookNumber', sql.Int, parsedBookNumber)
          .input('pageNumber', sql.Int, parsedPageNumber)
          .input('registryNumber', sql.NVarChar(50), normalizedRegistryNumber)
          .input('fileUrl', sql.NVarChar(1000), fileUrl.trim())
          .input('notes', sql.NVarChar(sql.MAX), notes?.trim() || null)
          .input('uploadedBy', sql.NVarChar(256), uploadedBy)
          .query(`
            INSERT INTO dbo.SacramentalArchives
              (SacramentType, BookNumber, PageNumber, RegistryNumber, FileUrl, Notes, UploadedBy)
            OUTPUT INSERTED.ArchiveId AS id
            VALUES
              (@sacramentType, @bookNumber, @pageNumber, @registryNumber, @fileUrl, @notes, @uploadedBy)
          `)
      const id = postgresSacramentalEnabled ? result.rows[0]?.id : result.recordset[0]?.id
      if (!id) throw new Error('Sacramental archive insert returned no ID.')
      res.status(201).json({ id })
    } catch (error) {
      logError(error, { context: 'createSacramentalArchive' })
      res.status(500).json({ message: 'Unable to save sacramental archive.' })
    }
  })

  router.put('/api/admin/sacramental/archives/:id', ...recordsAccess, async (req, res) => {
    const id = optionalPositiveInteger(req.params.id)
    const bookNumber = optionalPositiveInteger(req.body?.bookNumber)
    const pageNumber = optionalPositiveInteger(req.body?.pageNumber)
    const registryNumber = req.body?.registryNumber
    const registryNumberProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'registryNumber')
    const normalizedRegistryNumber = typeof registryNumber === 'string' ? registryNumber.trim() || null : null
    const notes = req.body?.notes
    if (
      !id || !bookNumber || !pageNumber ||
      (registryNumberProvided && registryNumber !== null && typeof registryNumber !== 'string') ||
      (normalizedRegistryNumber !== null && normalizedRegistryNumber.length > 50) ||
      (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 4000))
    ) {
      return res.status(400).json({ message: 'Provide valid archive details.' })
    }

    try {
      const normalizedNotes = typeof notes === 'string' ? notes.trim() || null : null
      const result = postgresSacramentalEnabled
        ? await getPostgresPool().query(`
            UPDATE "public"."SacramentalArchives"
            SET "BookNumber" = $2, "PageNumber" = $3,
              "RegistryNumber" = CASE WHEN $4::boolean THEN $5::varchar ELSE "RegistryNumber" END,
              "Notes" = $6
            WHERE "ArchiveId" = $1
          `, [id, bookNumber, pageNumber, registryNumberProvided, normalizedRegistryNumber, normalizedNotes])
        : await getPool().request()
          .input('id', sql.Int, id)
          .input('bookNumber', sql.Int, bookNumber)
          .input('pageNumber', sql.Int, pageNumber)
          .input('registryNumber', sql.NVarChar(50), normalizedRegistryNumber)
          .input('registryNumberProvided', sql.Bit, registryNumberProvided)
          .input('notes', sql.NVarChar(sql.MAX), normalizedNotes)
          .query(`
            UPDATE dbo.SacramentalArchives
            SET BookNumber = @bookNumber, PageNumber = @pageNumber,
              RegistryNumber = CASE WHEN @registryNumberProvided = 1 THEN @registryNumber ELSE RegistryNumber END,
              Notes = @notes
            WHERE ArchiveId = @id
          `)
      if (postgresSacramentalEnabled ? result.rowCount === 0 : result.rowsAffected?.[0] === 0) {
        return res.status(404).json({ message: 'Archive not found.' })
      }
      res.json({ message: 'Archive entry updated.' })
    } catch (error) {
      logError(error, { context: 'updateSacramentalArchive' })
      res.status(500).json({ message: 'Unable to update sacramental archive.' })
    }
  })

  router.delete('/api/admin/sacramental/archives/:id', ...recordsAccess, async (req, res) => {
    const id = optionalPositiveInteger(req.params.id)
    if (!id) return res.status(400).json({ message: 'Invalid archive ID.' })
    if (!deleteArchiveFile) return res.status(500).json({ message: 'Archive file storage is not configured.' })

    try {
      const archive = postgresSacramentalEnabled
        ? await getPostgresPool().query(`
            SELECT "FileUrl" FROM "public"."SacramentalArchives"
            WHERE "ArchiveId" = $1
          `, [id])
        : await getPool().request()
          .input('id', sql.Int, id)
          .query('SELECT FileUrl FROM dbo.SacramentalArchives WHERE ArchiveId = @id')
      const fileUrl = postgresSacramentalEnabled ? archive.rows[0]?.FileUrl : archive.recordset[0]?.FileUrl
      if (!fileUrl) return res.status(404).json({ message: 'Archive not found.' })

      await deleteArchiveFile(fileUrl)
      if (postgresSacramentalEnabled) {
        await getPostgresPool().query(`
          DELETE FROM "public"."SacramentalArchives" WHERE "ArchiveId" = $1
        `, [id])
      } else {
        await getPool().request()
          .input('id', sql.Int, id)
          .query('DELETE FROM dbo.SacramentalArchives WHERE ArchiveId = @id')
      }
      res.json({ message: 'Archive entry and file deleted.' })
    } catch (error) {
      logError(error, { context: 'deleteSacramentalArchive' })
      res.status(500).json({ message: 'Unable to delete sacramental archive.' })
    }
  })

  router.get('/api/admin/sacramental/:type/:id/audit', ...recordsAccess, async (req, res) => {
    const record = sacramentRecords[req.params.type]
    const id = optionalPositiveInteger(req.params.id)
    if (!record || !id) return res.status(400).json({ message: 'Invalid sacramental record.' })

    try {
      if (postgresSacramentalEnabled) {
        const result = await getPostgresPool().query(`
          SELECT "AuditId", "ActionName", "ChangedBy", "ChangedAt", "Changes"
          FROM "public"."SacramentalRecordAudit"
          WHERE "RecordType" = $1 AND "RecordId" = $2
          ORDER BY "ChangedAt" DESC, "AuditId" DESC
        `, [req.params.type, id])
        return res.json(result.rows)
      }

      const result = await getPool().request()
        .input('recordType', sql.VarChar(30), req.params.type)
        .input('recordId', sql.Int, id)
        .query(`
          SELECT AuditId, ActionName, ChangedBy, ChangedAt, Changes
          FROM dbo.SacramentalRecordAudit
          WHERE RecordType = @recordType AND RecordId = @recordId
          ORDER BY ChangedAt DESC, AuditId DESC
        `)
      res.json(result.recordset)
    } catch (error) {
      logError(error, { context: 'sacramentalRecordAudit' })
      res.status(500).json({ message: 'Unable to load sacramental record history.' })
    }
  })

  router.get('/api/admin/sacramental/:type/:id', ...recordsAccess, async (req, res) => {
    const record = sacramentRecords[req.params.type]
    const id = optionalPositiveInteger(req.params.id)
    if (!record || !id) return res.status(400).json({ message: 'Invalid sacramental record.' })

    try {
      if (postgresSacramentalEnabled) {
        const result = await getPostgresPool().query(`
          SELECT * FROM "public"."${record.table}"
          WHERE "${record.idColumn}" = $1
        `, [id])
        if (!result.rows[0]) return res.status(404).json({ message: 'Sacramental record not found.' })
        return res.json(result.rows[0])
      }

      const result = await getPool().request()
        .input('id', sql.Int, id)
        .query(`SELECT * FROM dbo.${record.table} WHERE ${record.idColumn} = @id`)
      if (!result.recordset[0]) return res.status(404).json({ message: 'Sacramental record not found.' })
      res.json(result.recordset[0])
    } catch (error) {
      logError(error, { context: 'sacramentalRecordDetail' })
      res.status(500).json({ message: 'Unable to load sacramental record.' })
    }
  })

  return router
}
