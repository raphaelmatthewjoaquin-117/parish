import express from 'express'
import { normalizeBlockedSlotInput } from '../server-rules.js'

export async function cleanupExpiredBlockedSlots(getPool, getPostgresPool = null) {
  if (getPostgresPool) {
    const result = await getPostgresPool().query(`
      DELETE FROM "public"."BlockedSlots"
      WHERE "BlockDate" < timezone('Asia/Manila', now())::date
    `)
    return result.rowCount ?? 0
  }

  const result = await getPool().request().query(`
    DELETE FROM dbo.BlockedSlots
    -- Parish booking dates use Manila time (UTC+08:00), regardless of DB host timezone.
    WHERE BlockDate < CONVERT(date, DATEADD(HOUR, 8, SYSUTCDATETIME()))
  `)
  return result.rowsAffected?.[0] ?? 0
}

export function createBlockedSlotsRouter({
  getPool,
  getPostgresPool,
  postgresEnabled = false,
  sql,
  requireAdmin,
  requireRole,
  logError,
}) {
  const router = express.Router()
  const availabilityAccess = [requireAdmin, requireRole(['ParishPriest', 'Secretary'])]

  router.get('/api/admin/blocked-slots', ...availabilityAccess, async (_req, res) => {
    try {
      await cleanupExpiredBlockedSlots(getPool, postgresEnabled ? getPostgresPool : null)
      if (postgresEnabled) {
        const result = await getPostgresPool().query(`
          SELECT block."BlockedSlotId" AS id,
            to_char(block."BlockDate", 'YYYY-MM-DD') AS date,
            block."BlockTime" AS time, block."Scope" AS scope,
            block."ServiceId" AS "serviceId", service."Name" AS "serviceName",
            block."Reason" AS reason
          FROM "public"."BlockedSlots" AS block
          LEFT JOIN "public"."Service" AS service
            ON service."ServiceId" = block."ServiceId"
          ORDER BY block."BlockDate", block."BlockTime", block."BlockedSlotId"
        `)
        return res.json(result.rows)
      }

      const result = await getPool().request().query(`
        SELECT b.BlockedSlotId, CONVERT(varchar(10), b.BlockDate, 23) AS BlockDate,
          b.BlockTime, b.Scope, b.ServiceId, s.Name AS ServiceName, b.Reason
        FROM dbo.BlockedSlots b
        LEFT JOIN dbo.Service s ON s.ServiceId = b.ServiceId
        ORDER BY b.BlockDate, b.BlockTime, b.BlockedSlotId
      `)
      res.json(result.recordset.map(row => ({
        id: row.BlockedSlotId,
        date: row.BlockDate,
        time: row.BlockTime,
        scope: row.Scope,
        serviceId: row.ServiceId,
        serviceName: row.ServiceName,
        reason: row.Reason,
      })))
    } catch (error) {
      logError(error, { context: 'adminBlockedSlotsLookup' })
      res.status(500).json({ message: 'Unable to load blocked booking times.' })
    }
  })

  router.post('/api/admin/blocked-slots', ...availabilityAccess, async (req, res) => {
    const block = normalizeBlockedSlotInput(req.body)
    const now = new Date()
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    if (!block || block.date < today) {
      return res.status(400).json({ message: 'Choose a future office date and a valid office-hour time.' })
    }

    try {
      if (postgresEnabled) {
        const result = await getPostgresPool().query(`
          INSERT INTO "public"."BlockedSlots"
            ("BlockDate", "BlockTime", "Scope", "ServiceId", "Reason", "CreatedAt")
          VALUES ($1, $2, $3, $4, $5, timezone('UTC', now()))
          RETURNING "BlockedSlotId" AS id
        `, [block.date, block.time, block.scope, block.serviceId, block.reason])
        return res.status(201).json({ id: result.rows[0].id })
      }

      const result = await getPool().request()
        .input('date', sql.Date, block.date)
        .input('time', sql.VarChar(5), block.time)
        .input('scope', sql.VarChar(20), block.scope)
        .input('serviceId', sql.Int, block.serviceId)
        .input('reason', sql.NVarChar(300), block.reason)
        .query(`
          INSERT INTO dbo.BlockedSlots (BlockDate, BlockTime, Scope, ServiceId, Reason)
          OUTPUT INSERTED.BlockedSlotId
          VALUES (@date, @time, @scope, @serviceId, @reason)
        `)
      res.status(201).json({ id: result.recordset[0].BlockedSlotId })
    } catch (error) {
      logError(error, { context: 'adminBlockedSlotCreate' })
      res.status(500).json({ message: 'Unable to block that booking time.' })
    }
  })

  router.delete('/api/admin/blocked-slots/:id', ...availabilityAccess, async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid blocked slot ID.' })
    }

    try {
      if (postgresEnabled) {
        const result = await getPostgresPool().query(`
          DELETE FROM "public"."BlockedSlots"
          WHERE "BlockedSlotId" = $1
          RETURNING "BlockedSlotId"
        `, [id])
        if (result.rows.length === 0) {
          return res.status(404).json({ message: 'Blocked booking time not found.' })
        }
        return res.json({ success: true })
      }

      const result = await getPool().request()
        .input('id', sql.Int, id)
        .query(`
          DELETE FROM dbo.BlockedSlots
          OUTPUT DELETED.BlockedSlotId
          WHERE BlockedSlotId = @id
        `)
      if (result.recordset.length === 0) {
        return res.status(404).json({ message: 'Blocked booking time not found.' })
      }
      res.json({ success: true })
    } catch (error) {
      logError(error, { context: 'adminBlockedSlotDelete' })
      res.status(500).json({ message: 'Unable to remove that booking block.' })
    }
  })

  return router
}
