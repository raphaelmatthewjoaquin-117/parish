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
  getPrivateFile?: (fileName: string) => Promise<{ contents: Buffer }>
  postgresCertificatesEnabled?: boolean
  postgresOperationsEnabled?: boolean
  postgresSacramentalEnabled?: boolean
  getPostgresPool?: () => {
    query: (statement: string, values?: unknown[]) =>
      Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
    connect: () => Promise<{
      query: (statement: string, values?: unknown[]) =>
        Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>
      release: () => void
    }>
  }
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
    uploadDirectory: 'uploads',
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

  it('returns PostgreSQL finance totals with the existing response shape', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/FROM "public"\."FinancialEntries"/)
      expect(statement).toMatch(/"Status" IN \('Approved', 'Reconciled'\)/)
      expect(values).toEqual(['2026-01-01', '2026-01-31', 'Expense'])
      return {
        rows: [{ EntryType: 'Expense', EntryCount: '2', Total: '75.00' }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresOperationsEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/operations/finance/report?start=2026-01-01&end=2026-01-31&type=Expense`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      totals: [{ EntryType: 'Expense', EntryCount: 2, Total: 75 }],
    })
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('lists PostgreSQL finance report snapshots newest first', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string) => {
      expect(statement).toMatch(/FROM "public"\."FinanceReportSnapshots"/)
      expect(statement).toMatch(/ORDER BY "GeneratedAt" DESC, "FinanceReportSnapshotId" DESC/)
      return {
        rows: [{
          FinanceReportSnapshotId: 3,
          ReportType: 'Monthly',
          PeriodStart: '2026-10-01',
          PeriodEnd: '2026-10-31',
          TotalIncome: '120.00',
          TotalExpenses: '45.00',
          NetTotal: '75.00',
          GeneratedAt: '2026-11-01T10:00:00Z',
          GeneratedBy: 'parish@example.org',
        }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresOperationsEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/operations/finance/reports`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      {
        FinanceReportSnapshotId: 3,
        ReportType: 'Monthly',
        PeriodStart: '2026-10-01',
        PeriodEnd: '2026-10-31',
        TotalIncome: 120,
        TotalExpenses: 45,
        NetTotal: 75,
        GeneratedAt: '2026-11-01T10:00:00Z',
        GeneratedBy: 'parish@example.org',
      },
    ])
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('lists PostgreSQL finance audit records with entry details newest first', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string) => {
      expect(statement).toMatch(/FROM "public"\."FinancialEntryAudit" audit/)
      expect(statement).toMatch(/LEFT JOIN "public"\."FinancialEntries" entry/)
      expect(statement).toMatch(/ORDER BY audit\."ChangedAt" DESC, audit\."AuditId" DESC/)
      return {
        rows: [{
          AuditId: 21,
          FinancialEntryId: 4,
          ActionName: 'Approved',
          EntryType: 'Donation',
          Description: 'Sunday offering',
          ChangedBy: 'parish@example.org',
          ChangedAt: '2026-10-30T12:00:00Z',
          Details: null,
        }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresOperationsEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
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
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('rejects invalid finance report filters before querying', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/operations/finance/report?start=2026-02-01&end=2026-01-01`)

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('lists certificate requests from PostgreSQL when that provider is enabled', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async () => ({
      rows: [{ CertificateRequestId: 7, DocumentCount: '2' }],
      rowCount: 1,
    }))
    const api = createTestApi(sqlServerQuery, {
      postgresCertificatesEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/certificate-requests`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { CertificateRequestId: 7, DocumentCount: 2 },
    ])
    expect(sqlServerQuery).not.toHaveBeenCalled()
    expect(postgresQuery).toHaveBeenCalledOnce()
  })

  it('streams PostgreSQL certificate documents from private storage after authorization', async () => {
    const getPrivateFile = vi.fn(async () => ({ contents: Buffer.from('private document') }))
    const api = createTestApi(async () => ({ recordset: [] }), {
      postgresCertificatesEnabled: true,
      getPrivateFile,
      getPostgresPool: () => ({
        query: async () => ({
          rows: [{
            StoredFileName: 'safe-file.pdf',
            OriginalFileName: 'baptism record.pdf',
            MimeType: 'application/pdf',
          }],
          rowCount: 1,
        }),
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/certificate-requests/8/documents/14/file`)

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('private document')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(getPrivateFile).toHaveBeenCalledWith('safe-file.pdf')
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

  it('returns PostgreSQL sacramental statistics with the existing response shape', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(values).toEqual([2026])
      if (statement.includes('generate_series')) {
        return {
          rows: [{
            month: 1,
            monthName: 'January',
            baptisms: '2',
            confirmations: '1',
            marriages: '0',
            deaths: '1',
          }],
          rowCount: 1,
        }
      }

      expect(statement).toMatch(/FROM "Records"/)
      expect(statement).toMatch(/"DateOfBaptism"/)
      expect(statement).toMatch(/"DateOfConfirmation"/)
      expect(statement).toMatch(/"DateOfMarriage"/)
      expect(statement).toMatch(/"DateOfDeath"/)
      return {
        rows: [{
          totalBaptisms: '2',
          totalConfirmations: '1',
          totalMarriages: '0',
          totalDeaths: '1',
          InfantsUnder1Yr: '1',
          ChildrenOver1Yr: '1',
          AvgGroomAge: null,
          AvgBrideAge: null,
          Under25: '0',
          Age25To35: '0',
          Over35: '0',
          AvgDeceasedAge: '74',
          Under18: '0',
          Age18To59: '0',
          Senior60Plus: '1',
        }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
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
    expect(sqlServerQuery).not.toHaveBeenCalled()
    expect(postgresQuery).toHaveBeenCalledTimes(2)
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

  it('searches PostgreSQL sacramental records with parameterized filters and pagination', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/"public"\."BaptismRecords"/)
      expect(statement).toMatch(/"public"\."ConfirmationRecords"/)
      expect(statement).toMatch(/"public"\."MarriageRecords"/)
      expect(statement).toMatch(/"public"\."DeathRecords"/)
      expect(values?.slice(0, 5)).toEqual([
        'baptism',
        '%Maria%',
        '2020-01-01',
        '2020-12-31',
        '%Fr. Ben%',
      ])
      if (statement.includes('COUNT(*)')) return { rows: [{ total: '1' }], rowCount: 1 }
      expect(values?.slice(5)).toEqual([10, 10])
      return {
        rows: [{
          RecordType: 'baptism',
          Id: 2,
          RegistryNumber: 'B-002',
          Name: 'Maria Santos',
          RecordDate: '2020-06-01',
          Priest: 'Fr. Ben',
          ScannedDocumentUrl: null,
        }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
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
        ScannedDocumentUrl: null,
      }],
      pagination: { page: 2, limit: 10, total: 1 },
    })
    expect(sqlServerQuery).not.toHaveBeenCalled()
    expect(postgresQuery).toHaveBeenCalledTimes(2)
  })

  it('loads PostgreSQL sacramental record details by validated record type and ID', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/FROM "public"\."BaptismRecords"\s+WHERE "BaptismId" = \$1/)
      expect(values).toEqual([2])
      return {
        rows: [{ BaptismId: 2, RegistryNumber: 'B-002', ChildFirstName: 'Maria' }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/2`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      BaptismId: 2,
      RegistryNumber: 'B-002',
      ChildFirstName: 'Maria',
    })
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('loads PostgreSQL sacramental record audit history', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/FROM "public"\."SacramentalRecordAudit"/)
      expect(statement).toMatch(/ORDER BY "ChangedAt" DESC, "AuditId" DESC/)
      expect(values).toEqual(['baptism', 2])
      return {
        rows: [{ AuditId: 1, ActionName: 'Updated', ChangedBy: 'staff@example.org' }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/2/audit`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      { AuditId: 1, ActionName: 'Updated', ChangedBy: 'staff@example.org' },
    ])
    expect(sqlServerQuery).not.toHaveBeenCalled()
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

  it('lists PostgreSQL sacramental archives with validated filters and file routes', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/FROM "public"\."SacramentalArchives"/)
      expect(statement).toMatch(/"RegistryNumber" = \$4/)
      expect(statement).toMatch(/ORDER BY "UploadedAt" DESC, "ArchiveId" DESC/)
      expect(values).toEqual(['marriage', 2, 6, 'M-100'])
      return {
        rows: [{
          ArchiveId: 11,
          SacramentType: 'marriage',
          BookNumber: 2,
          PageNumber: 6,
          RegistryNumber: 'M-100',
          FileUrl: 'private/archive.pdf',
        }],
        rowCount: 1,
      }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
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
    expect(sqlServerQuery).not.toHaveBeenCalled()
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

  it('creates PostgreSQL sacramental archives using bound values', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (statement: string, values?: unknown[]) => {
      expect(statement).toMatch(/INSERT INTO "public"\."SacramentalArchives"/)
      expect(values).toEqual(['baptism', 1, 5, 'B-005', 'private/scan.pdf', 'Old register', 'staff'])
      return { rows: [{ id: 17 }], rowCount: 1 }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sacramentType: 'baptism',
        bookNumber: 1,
        pageNumber: 5,
        registryNumber: ' B-005 ',
        fileUrl: ' private/scan.pdf ',
        notes: ' Old register ',
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 17 })
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('saves a standalone archive without a registry number', async () => {
    const api = createTestApi(async (_statement, inputs) => {
      expect(inputs.get('registryNumber')).toBeNull()
      return { recordset: [{ id: 18 }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sacramentType: 'baptism',
        bookNumber: 1,
        pageNumber: 6,
        fileUrl: '/uploads/old-scan.pdf',
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 18 })
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

  it('serves PostgreSQL archive scans through the protected file route', async () => {
    const getArchiveFile = vi.fn(async () => ({
      contents: Buffer.from('scan'),
      contentType: 'application/pdf',
      filename: 'scan.pdf',
    }))
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async () => ({
      rows: [{ FileUrl: 'private/scan.pdf' }],
      rowCount: 1,
    }))
    const api = createTestApi(sqlServerQuery, {
      getArchiveFile,
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7/file?token=test-token`)

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('scan')
    expect(getArchiveFile).toHaveBeenCalledWith('private/scan.pdf')
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('updates archive book, page, and notes', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/UPDATE dbo\.SacramentalArchives/)
      expect(inputs.get('id')).toBe(7)
      expect(inputs.get('bookNumber')).toBe(2)
      expect(inputs.get('pageNumber')).toBe(8)
      expect(inputs.get('notes')).toBe('Updated notes')
      expect(inputs.get('registryNumberProvided')).toBe(false)
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

  it('updates PostgreSQL archive metadata and reports missing IDs', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (_statement: string, values?: unknown[]) => {
      expect(values).toEqual([7, 2, 8, false, null, 'Updated notes'])
      return { rows: [], rowCount: 0 }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookNumber: 2, pageNumber: 8, notes: ' Updated notes ' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Archive not found.' })
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('updates PostgreSQL archive metadata when the archive exists', async () => {
    const postgresQuery = vi.fn(async () => ({ rows: [], rowCount: 1 }))
    const api = createTestApi(async () => ({ recordset: [] }), {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookNumber: 2, pageNumber: 8, notes: 'Updated notes' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Archive entry updated.' })
  })

  it('deletes the PostgreSQL archive and its stored file', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [{ FileUrl: 'private/archive.pdf' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    const deleteArchiveFile = vi.fn(async () => undefined)
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      deleteArchiveFile,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Archive entry and file deleted.' })
    expect(deleteArchiveFile).toHaveBeenCalledWith('private/archive.pdf')
    expect(postgresQuery).toHaveBeenLastCalledWith(
      expect.stringMatching(/DELETE FROM "public"\."SacramentalArchives"/),
      [7],
    )
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('links an existing archive to a registry entry when updated', async () => {
    const api = createTestApi(async (_statement, inputs) => {
      expect(inputs.get('registryNumber')).toBe('B-005')
      return { recordset: [], rowsAffected: [1] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/archives/7`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookNumber: 1, pageNumber: 6, registryNumber: ' B-005 ' }),
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

  it('creates a baptism record and returns its generated ID', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/INSERT INTO dbo\.BaptismRecords/)
      expect(statement).toMatch(/OUTPUT INSERTED\.BaptismId AS id/)
      expect(inputs.get('field0')).toBe('B-005')
      expect(inputs.get('field1')).toBe('Ana')
      expect(inputs.get('createdBy')).toBe('staff')
      return { recordset: [{ id: 5 }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registryNumber: 'B-005',
        childFirstName: 'Ana',
        childLastName: 'Santos',
        dateOfBirth: '2024-01-02',
        dateOfBaptism: '2024-02-03',
        ministerName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 5 })
  })

  it('creates a PostgreSQL baptism record with bound values and a generated ID', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const postgresQuery = vi.fn(async (_statement: string, values?: unknown[]) => {
      expect(values).toEqual([
        'B-005', 'Ana', null, 'Santos', '2024-01-02', null, '2024-02-03',
        null, null, 'Fr. Jose', null, null, 'staff',
      ])
      return { rows: [{ id: 5 }], rowCount: 1 }
    })
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: postgresQuery,
        connect: async () => {
          throw new Error('Unexpected transaction connection')
        },
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registryNumber: 'B-005',
        childFirstName: 'Ana',
        childLastName: 'Santos',
        dateOfBirth: '2024-01-02',
        dateOfBaptism: '2024-02-03',
        ministerName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 5 })
    expect(postgresQuery.mock.calls[0][0]).toMatch(/INSERT INTO "public"\."BaptismRecords"/)
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('updates a baptism record and records the changed fields', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/UPDATE dbo\.BaptismRecords/)
      expect(statement).toMatch(/INSERT INTO dbo\.SacramentalRecordAudit/)
      expect(inputs.get('id')).toBe(1)
      expect(inputs.get('field0')).toBe('B-001')
      expect(inputs.get('field1')).toBe('Ana')
      expect(inputs.get('changedBy')).toBe('staff')
      expect(inputs.get('changes')).toContain('"RegistryNumber"')
      return { recordset: [{ updated: true }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RegistryNumber: 'B-001',
        ChildFirstName: 'Ana',
        ChildLastName: 'Santos',
        DateOfBirth: '2024-01-02',
        DateOfBaptism: '2024-02-03',
        MinisterName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record updated.' })
  })

  it('updates a PostgreSQL sacramental record and writes its audit row in one transaction', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
    const release = vi.fn()
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: vi.fn(),
        connect: async () => ({ query: clientQuery, release }),
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RegistryNumber: 'B-001',
        ChildFirstName: 'Ana',
        ChildLastName: 'Santos',
        DateOfBirth: '2024-01-02',
        DateOfBaptism: '2024-02-03',
        MinisterName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record updated.' })
    expect(clientQuery.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      expect.stringMatching(/UPDATE "public"\."BaptismRecords"/),
      expect.stringMatching(/INSERT INTO "public"\."SacramentalRecordAudit"/),
      'COMMIT',
    ])
    expect(clientQuery.mock.calls[2][1]).toEqual([
      'baptism',
      1,
      'staff',
      JSON.stringify({
        RegistryNumber: true,
        ChildFirstName: true,
        ChildMiddleName: true,
        ChildLastName: true,
        DateOfBirth: true,
        PlaceOfBirth: true,
        DateOfBaptism: true,
        FatherFullName: true,
        MotherFullName: true,
        MinisterName: true,
        Sponsors: true,
        Remarks: true,
      }),
    ])
    expect(release).toHaveBeenCalledOnce()
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('returns not found when updating a missing sacramental record', async () => {
    const query = vi.fn(async () => ({ recordset: [{ updated: false }] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RegistryNumber: 'B-001',
        ChildFirstName: 'Ana',
        ChildLastName: 'Santos',
        DateOfBirth: '2024-01-02',
        DateOfBaptism: '2024-02-03',
        MinisterName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record not found.' })
  })

  it('rejects invalid sacramental updates before querying', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RegistryNumber: 'B-001',
        ChildFirstName: 'Ana',
        ChildLastName: 'Santos',
        DateOfBirth: 'not-a-date',
        DateOfBaptism: '2024-02-03',
        MinisterName: 'Fr. Jose',
      }),
    })

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('deletes a sacramental record and preserves an audit entry', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/DELETE FROM dbo\.BaptismRecords WHERE BaptismId = @id/)
      expect(statement).toMatch(/INSERT INTO dbo\.SacramentalRecordAudit/)
      expect(inputs.get('id')).toBe(1)
      expect(inputs.get('recordType')).toBe('baptism')
      expect(inputs.get('changedBy')).toBe('staff')
      return { recordset: [{ deleted: true }] }
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record deleted.' })
  })

  it('deletes a PostgreSQL sacramental record and audit row atomically', async () => {
    const sqlServerQuery = vi.fn(async () => ({ recordset: [] }))
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
    const release = vi.fn()
    const api = createTestApi(sqlServerQuery, {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: vi.fn(),
        connect: async () => ({ query: clientQuery, release }),
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, { method: 'DELETE' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record deleted.' })
    expect(clientQuery.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      expect.stringMatching(/DELETE FROM "public"\."BaptismRecords"/),
      expect.stringMatching(/INSERT INTO "public"\."SacramentalRecordAudit"/),
      'COMMIT',
    ])
    expect(clientQuery.mock.calls[2][1]).toEqual(['baptism', 1, 'staff', '{"deleted":true}'])
    expect(release).toHaveBeenCalledOnce()
    expect(sqlServerQuery).not.toHaveBeenCalled()
  })

  it('rolls back a PostgreSQL sacramental delete if its audit write fails', async () => {
    const clientQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockRejectedValueOnce(new Error('audit unavailable'))
      .mockResolvedValueOnce({ rows: [], rowCount: null })
    const api = createTestApi(async () => ({ recordset: [] }), {
      postgresSacramentalEnabled: true,
      getPostgresPool: () => ({
        query: vi.fn(),
        connect: async () => ({ query: clientQuery, release: vi.fn() }),
      }),
    })

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, { method: 'DELETE' })

    expect(response.status).toBe(500)
    expect(clientQuery.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      expect.stringMatching(/DELETE FROM "public"\."BaptismRecords"/),
      expect.stringMatching(/INSERT INTO "public"\."SacramentalRecordAudit"/),
      'ROLLBACK',
    ])
  })

  it('returns not found when deleting a missing sacramental record', async () => {
    const api = createTestApi(async () => ({ recordset: [{ deleted: false }] }))

    const response = await fetch(`${api}/api/admin/sacramental/baptism/1`, { method: 'DELETE' })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ message: 'Sacramental record not found.' })
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

  it('rejects archive creation with an oversized registry number', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/admin/sacramental/archives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sacramentType: 'baptism',
        bookNumber: 1,
        pageNumber: 5,
        registryNumber: 'x'.repeat(51),
        fileUrl: '/uploads/scan.pdf',
      }),
    })

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
