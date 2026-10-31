// @vitest-environment node

import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RequestHandler } from 'express'
import { createAdminReportingRouter } from './admin-reporting-routes.js'

const servers: Array<ReturnType<express.Express['listen']>> = []

function createTestApi(query: (
  statement: string,
  inputs: Map<string, unknown>,
) => { recordset: Array<Record<string, unknown>> } | Promise<{ recordset: Array<Record<string, unknown>> }>, extras: {
  uploadArchive?: RequestHandler
  saveArchiveFile?: (file: { path: string; filename: string; originalname: string; mimetype: string; size: number }) => Promise<string>
  requireAdminWithQueryToken?: RequestHandler
  getArchiveFile?: (fileUrl: string) => Promise<{ contents: Buffer; contentType: string; filename: string }>
  deleteArchiveFile?: (fileUrl: string) => Promise<void>
} = {}) {
  const app = express()
  app.use(express.json())
  app.use(createAdminReportingRouter({
    getPool: () => ({
      request: () => {
        const inputs = new Map<string, unknown>()
        const request = {
          input: (name: string, _type: unknown, value: unknown) => {
            inputs.set(name, value)
            return request
          },
          query: async (statement: string) => query(statement, inputs),
        }
        return request
      },
    }),
    sql: {
      Date: 'Date',
      Int: 'Int',
      MAX: 'MAX',
      VarChar: (length: unknown) => length,
      NVarChar: (length: unknown) => length,
    },
    requireAdmin: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
    logError: vi.fn(),
    ...extras,
  }))

  const server = app.listen(0)
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not start')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })))
})

describe('admin reporting routes', () => {
  it('returns finance totals using only approved and reconciled entries', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/Status IN \('Approved',\s*'Reconciled'\)/)
      expect(inputs.get('start')).toBe('2026-01-01')
      expect(inputs.get('end')).toBe('2026-01-31')
      expect(inputs.get('type')).toBe('Expense')
      return { recordset: [{ EntryType: 'Expense', EntryCount: 2, Total: 75 }] }
    })

    const response = await fetch(`${api}/api/admin/operations/finance/report?start=2026-01-01&end=2026-01-31&type=Expense`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      totals: [{ EntryType: 'Expense', EntryCount: 2, Total: 75 }],
    })
  })

  it('rejects invalid finance report filters before querying', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/operations/finance/report?start=2026-02-01&end=2026-01-01`)

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('lists generated finance report snapshots newest first', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/FROM dbo\.FinanceReportSnapshots/i)
      expect(statement).toMatch(/ORDER BY GeneratedAt DESC/i)
      return { recordset: [{ FinanceReportSnapshotId: 3, ReportType: 'Monthly' }] }
    })

    const response = await fetch(`${api}/api/admin/operations/finance/reports`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { FinanceReportSnapshotId: 3, ReportType: 'Monthly' },
    ])
  })

  it('returns sacramental statistics for a validated year', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(inputs.get('year')).toBe(2026)
      if (statement.includes('MonthList')) {
        expect(statement).toMatch(/DATEFROMPARTS\(@year, Months\.MonthNumber, 1\)/)
        return {
          recordset: [{
            month: 1,
            monthName: 'January',
            baptisms: 2,
            confirmations: 1,
            marriages: 0,
            deaths: 1,
          }],
        }
      }

      expect(statement).toMatch(/FROM dbo\.BaptismRecords/)
      expect(statement).toMatch(/FROM dbo\.ConfirmationRecords/)
      expect(statement).toMatch(/FROM dbo\.MarriageRecords/)
      expect(statement).toMatch(/FROM dbo\.DeathRecords/)
      return {
        recordset: [{
          totalBaptisms: 2,
          totalConfirmations: 1,
          totalMarriages: 0,
          totalDeaths: 1,
          InfantsUnder1Yr: 1,
          ChildrenOver1Yr: 1,
          AvgGroomAge: null,
          AvgBrideAge: null,
          Under25: 0,
          Age25To35: 0,
          Over35: 0,
          AvgDeceasedAge: 74,
          Under18: 0,
          Age18To59: 0,
          Senior60Plus: 1,
        }],
      }
    })

    const response = await fetch(`${api}/api/admin/operations/statistics?year=2026`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      targetYear: 2026,
      summary: { totalBaptisms: 2, totalConfirmations: 1, totalMarriages: 0, totalDeaths: 1 },
      demographics: {
        baptisms: { InfantsUnder1Yr: 1, ChildrenOver1Yr: 1 },
        marriages: { AvgGroomAge: null, AvgBrideAge: null, Under25: 0, Age25To35: 0, Over35: 0 },
        deaths: { AvgDeceasedAge: 74, Under18: 0, Age18To59: 0, Senior60Plus: 1 },
      },
      monthlyBreakdown: [{
        month: 1,
        monthName: 'January',
        baptisms: 2,
        confirmations: 1,
        marriages: 0,
        deaths: 1,
      }],
    })
  })

  it('rejects invalid sacramental statistics years before querying', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/operations/statistics?year=not-a-year`)

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('lists finance audit history with entry details newest first', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/FROM dbo\.FinancialEntryAudit audit/i)
      expect(statement).toMatch(/LEFT JOIN dbo\.FinancialEntries entry/i)
      expect(statement).toMatch(/ORDER BY audit\.ChangedAt DESC/i)
      return {
        recordset: [{
          AuditId: 21,
          FinancialEntryId: 4,
          ActionName: 'Approved',
          EntryType: 'Donation',
          Description: 'Sunday offering',
          ChangedBy: 'parish@example.org',
          ChangedAt: '2026-10-30T12:00:00Z',
          Details: null,
        }],
      }
    })

    const response = await fetch(`${api}/api/admin/operations/finance/audit`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{
      AuditId: 21,
      FinancialEntryId: 4,
      ActionName: 'Approved',
      EntryType: 'Donation',
      Description: 'Sunday offering',
      ChangedBy: 'parish@example.org',
      ChangedAt: '2026-10-30T12:00:00Z',
      Details: null,
    }])
  })

  it('lists admin certificate requests with contact and appointment details', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/FROM dbo\.CertificateRequests/i)
      expect(statement).toMatch(/ContactEmail AS EmailAddress/i)
      expect(statement).toMatch(/COUNT\(document\.CertificateRequestDocumentId\) AS DocumentCount/i)
      expect(statement).toMatch(/ORDER BY request\.CreatedAt DESC/i)
      return { recordset: [{ CertificateRequestId: 8, FirstName: 'Jo', EmailAddress: 'jo@example.com', DocumentCount: 1 }] }
    })

    const response = await fetch(`${api}/api/admin/certificate-requests`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { CertificateRequestId: 8, FirstName: 'Jo', EmailAddress: 'jo@example.com', DocumentCount: 1 },
    ])
  })

  it('returns certificate documents through the authenticated file route', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/FROM dbo\.CertificateRequestDocuments/i)
      expect(statement).not.toMatch(/StoredFileName/)
      return {
        recordset: [{
          CertificateRequestDocumentId: 14,
          OriginalFileName: 'baptism.pdf',
          MimeType: 'application/pdf',
          FileSizeBytes: 1024,
          UploadedAt: '2026-10-01',
        }],
      }
    })

    const response = await fetch(`${api}/api/admin/certificate-requests/8/documents`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{
      CertificateRequestDocumentId: 14,
      OriginalFileName: 'baptism.pdf',
      MimeType: 'application/pdf',
      FileSizeBytes: 1024,
      UploadedAt: '2026-10-01',
      FileUrl: '/api/admin/certificate-requests/8/documents/14/file',
    }])
  })

  it('updates certificate request status only to a supported value', async () => {
    const query = vi.fn(async statement => {
      expect(statement).toMatch(/UPDATE dbo\.CertificateRequests/i)
      return { recordset: [{ CertificateRequestId: 8 }] }
    })
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/certificate-requests/8`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ReadyForClaim' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Certificate request updated.' })
    expect(query).toHaveBeenCalledOnce()
  })

  it('deletes certificate documents before the request in one transaction', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/BEGIN TRANSACTION/i)
      expect(statement.indexOf('DELETE FROM dbo.CertificateRequestDocuments'))
        .toBeLessThan(statement.indexOf('DELETE FROM dbo.CertificateRequests'))
      expect(statement).toMatch(/COMMIT TRANSACTION/i)
      return { recordset: [{ Deleted: true }] }
    })

    const response = await fetch(`${api}/api/admin/certificate-requests/8`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Certificate request deleted.' })
  })

  it('searches sacramental records with filters and paginated output', async () => {
    let queryCount = 0
    const api = createTestApi(async (statement, inputs) => {
      queryCount += 1
      expect(statement).toMatch(/BaptismRecords/i)
      expect(inputs.get('type')).toBe('baptism')
      expect(inputs.get('q')).toBe('%Maria%')
      expect(inputs.get('start')).toBe('2020-01-01')
      expect(inputs.get('end')).toBe('2020-12-31')
      expect(inputs.get('priest')).toBe('%Fr. Ben%')
      if (queryCount === 1) return { recordset: [{ total: 1 }] }
      expect(inputs.get('offset')).toBe(10)
      expect(inputs.get('limit')).toBe(10)
      return {
        recordset: [{
          RecordType: 'baptism',
          Id: 2,
          RegistryNumber: 'B-002',
          Name: 'Maria Santos',
          RecordDate: '2020-06-01',
          Priest: 'Fr. Ben',
        }],
      }
    })

    const response = await fetch(`${api}/api/admin/sacramental/search?type=baptism&q=Maria&startDate=2020-01-01&endDate=2020-12-31&priest=Fr.%20Ben&page=2&limit=10`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      records: [{
        RecordType: 'baptism',
        Id: 2,
        RegistryNumber: 'B-002',
        Name: 'Maria Santos',
        RecordDate: '2020-06-01',
        Priest: 'Fr. Ben',
      }],
      pagination: { page: 2, limit: 10, total: 1 },
    })
  })

  it('lists sacramental archives filtered by registry number', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/FROM dbo\.SacramentalArchives/i)
      expect(statement).toMatch(/RegistryNumber = @registryNumber/i)
      expect(inputs.get('sacramentType')).toBe('marriage')
      expect(inputs.get('bookNumber')).toBe(2)
      expect(inputs.get('pageNumber')).toBe(6)
      expect(inputs.get('registryNumber')).toBe('M-100')
      return { recordset: [{ ArchiveId: 11, SacramentType: 'marriage', BookNumber: 2, PageNumber: 6, RegistryNumber: 'M-100' }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives?sacramentType=marriage&bookNumber=2&pageNumber=6&registryNumber=M-100`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      archives: [{
        ArchiveId: 11,
        SacramentType: 'marriage',
        BookNumber: 2,
        PageNumber: 6,
        RegistryNumber: 'M-100',
        FileUrl: '/api/admin/sacramental/archives/11/file',
      }],
    })
  })

  it('saves an archive with a validated registry number', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/INSERT INTO dbo\.SacramentalArchives/i)
      expect(statement).toMatch(/RegistryNumber/)
      expect(inputs.get('registryNumber')).toBe('B-005')
      return { recordset: [{ id: 17 }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sacramentType: 'baptism',
        bookNumber: 1,
        pageNumber: 5,
        registryNumber: ' B-005 ',
        fileUrl: '/uploads/scan.pdf',
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 17 })
  })

  it('uploads a sacramental archive and returns its file URL', async () => {
    const saveArchiveFile = vi.fn(async () => '/uploads/scan.pdf')
    const api = createTestApi(async () => ({ recordset: [] }), {
      uploadArchive: (req, _res, next) => {
        Object.assign(req, { file: {
          fieldname: 'document',
          originalname: 'scan.pdf',
          encoding: '7bit',
          mimetype: 'application/pdf',
          destination: 'uploads',
          filename: 'scan.pdf',
          path: 'uploads\\scan.pdf',
          size: 12,
        } })
        next()
      },
      saveArchiveFile,
    })

    const response = await fetch(`${api}/api/admin/sacramental/upload-archive`, { method: 'POST' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ fileUrl: '/uploads/scan.pdf' })
    expect(saveArchiveFile).toHaveBeenCalledOnce()
  })

  it('serves archive scans through an authenticated file route', async () => {
    const getArchiveFile = vi.fn(async () => ({
      contents: Buffer.from('scan'),
      contentType: 'application/pdf',
      filename: 'scan.pdf',
    }))
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/SELECT FileUrl FROM dbo\.SacramentalArchives/)
      return { recordset: [{ FileUrl: '/uploads/scan.pdf' }] }
    }, { getArchiveFile })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7/file?token=test-token`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    await expect(response.text()).resolves.toBe('scan')
    expect(getArchiveFile).toHaveBeenCalledWith('/uploads/scan.pdf')
  })

  it('updates archive book, page, and notes', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/UPDATE dbo\.SacramentalArchives/)
      expect(inputs.get('id')).toBe(7)
      expect(inputs.get('bookNumber')).toBe(2)
      expect(inputs.get('pageNumber')).toBe(8)
      expect(inputs.get('notes')).toBe('Updated notes')
      return { recordset: [] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookNumber: 2, pageNumber: 8, notes: ' Updated notes ' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Archive entry updated.' })
  })

  it('deletes the archive scan and its database entry', async () => {
    const deleteArchiveFile = vi.fn(async () => {})
    const api = createTestApi(async statement => {
      if (statement.includes('SELECT FileUrl')) return { recordset: [{ FileUrl: '/uploads/scan.pdf' }] }
      expect(statement).toMatch(/DELETE FROM dbo\.SacramentalArchives/)
      return { recordset: [] }
    }, { deleteArchiveFile })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Archive entry and file deleted.' })
    expect(deleteArchiveFile).toHaveBeenCalledWith('/uploads/scan.pdf')
  })

  it('loads one sacramental record using a fixed table mapping', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/FROM dbo\.BaptismRecords WHERE BaptismId = @id/)
      expect(inputs.get('id')).toBe(5)
      return { recordset: [{ BaptismId: 5, RegistryNumber: 'B-005' }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/5`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ BaptismId: 5, RegistryNumber: 'B-005' })
  })

  it('returns sacramental audit history for the selected record', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/FROM dbo\.SacramentalRecordAudit/i)
      expect(inputs.get('recordType')).toBe('death')
      expect(inputs.get('recordId')).toBe(3)
      return { recordset: [{ AuditId: 12, ActionName: 'Updated' }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/death/3/audit`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ AuditId: 12, ActionName: 'Updated' }])
  })

  it('rejects overlong registry archive filters', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/sacramental/archives?registryNumber=${'x'.repeat(51)}`)

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('rejects archive creation without a registry number', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/sacramental/archives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sacramentType: 'baptism',
        bookNumber: 1,
        pageNumber: 5,
        fileUrl: '/uploads/scan.pdf',
      }),
    })

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
