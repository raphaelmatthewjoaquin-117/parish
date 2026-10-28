import express from 'express'

const prayerCategories = new Set(['healing', 'thanksgiving', 'guidance', 'family', 'deceased', 'other'])

export function createPrayerRouter({ getPool, sql, requireAdmin, requireRole, logError }) {
  const router = express.Router()

  router.get('/api/prayers', async (_req, res) => {
    try {
      const result = await getPool().request().query(`
        SELECT PrayerId, Name, Category, Request, Anonymous, CreatedAt
        FROM dbo.PrayerRequests
        WHERE IsApproved = 1 AND ShareWithCommunity = 1
        ORDER BY CreatedAt DESC
      `)

      res.json(result.recordset.map(row => ({
        id: row.PrayerId,
        name: row.Anonymous ? 'Anonymous' : row.Name,
        category: row.Category,
        request: row.Request,
        createdAt: row.CreatedAt,
      })))
    } catch (error) {
      logError(error, { context: 'publicPrayersLookup' })
      res.status(500).json({ message: 'Unable to load prayers.' })
    }
  })

  router.post('/api/prayers', async (req, res) => {
    const { name, category, request, anonymous, shareWithCommunity } = req.body || {}
    if (
      typeof name !== 'string' || !name.trim() || name.trim().length > 255 ||
      typeof category !== 'string' || !prayerCategories.has(category) ||
      typeof request !== 'string' || request.trim().length < 10 ||
      (anonymous !== undefined && typeof anonymous !== 'boolean') ||
      (shareWithCommunity !== undefined && typeof shareWithCommunity !== 'boolean')
    ) {
      return res.status(400).json({ message: 'Please provide a valid prayer request.' })
    }

    try {
      const result = await getPool().request()
        .input('name', sql.NVarChar(255), name.trim())
        .input('category', sql.NVarChar(50), category)
        .input('request', sql.NVarChar(sql.MAX), request.trim())
        .input('anonymous', sql.Bit, anonymous ?? false)
        .input('shareWithCommunity', sql.Bit, shareWithCommunity ?? false)
        .query(`
          INSERT INTO dbo.PrayerRequests
            (Name, Category, Request, Anonymous, ShareWithCommunity, IsApproved, CreatedAt)
          OUTPUT INSERTED.PrayerId
          VALUES (@name, @category, @request, @anonymous, @shareWithCommunity, 0, GETDATE())
        `)

      res.status(201).json({
        id: result.recordset[0]?.PrayerId,
        message: 'Prayer request received.',
      })
    } catch (error) {
      logError(error, { context: 'createPrayerRequest' })
      res.status(500).json({ message: 'Unable to submit prayer request.' })
    }
  })

  router.post('/api/prayers/:prayerId/approve', requireAdmin, requireRole(['ParishPriest', 'Secretary']), async (req, res) => {
    const prayerId = Number(req.params.prayerId)
    if (!Number.isSafeInteger(prayerId) || prayerId < 1) {
      return res.status(400).json({ message: 'Invalid prayer request.' })
    }

    try {
      const result = await getPool().request()
        .input('prayerId', sql.Int, prayerId)
        .query(`
          UPDATE dbo.PrayerRequests
          SET IsApproved = 1
          OUTPUT INSERTED.PrayerId
          WHERE PrayerId = @prayerId
        `)

      if (!result.recordset[0]) {
        return res.status(404).json({ message: 'Prayer request not found.' })
      }

      res.json({ success: true })
    } catch (error) {
      logError(error, { context: 'approvePrayerRequest' })
      res.status(500).json({ message: 'Unable to approve prayer request.' })
    }
  })

  return router
}
