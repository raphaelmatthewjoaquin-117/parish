// @vitest-environment node

import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFinanceWorkflowRouter,
  transitionSqlServerFinanceEntry,
} from './finance-workflow-router.js'
import { transitionPostgresFinanceEntry } from './postgres-finance-entries.js'

const servers: Array<ReturnType<express.Express['listen']>> = []

function createApi(currentStatus: string | null, roleLists: string[][] = []) {
  const pool = {
    connect: async () => ({
      query: async (statement: string) => {
        if (statement.includes('SELECT "Status"')) {
          return { rows: currentStatus ? [{ Status: currentStatus }] : [], rowCount: currentStatus ? 1 : 0 }
        }
        return { rows: [], rowCount: 1 }
      },
      release: vi.fn(),
    }),
  }
  const app = express()
  app.use(createFinanceWorkflowRouter({
    transitionFinanceEntry: (id, action, changedBy) =>
      transitionPostgresFinanceEntry(pool, id, action, changedBy),
    requireAdmin: (_req, _res, next) => next(),
    requireRole: roles => {
      roleLists.push(roles)
      return (_req, _res, next) => next()
    },
    logError: vi.fn(),
    staffName: () => 'staff@example.org',
  }))

  const server = app.listen(0)
  servers.push(server)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not start')
  return { url: `http://127.0.0.1:${address.port}`, roleLists }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })))
})

describe('finance workflow routes', () => {
  it('approves a submitted entry and preserves the actor and reviewer role checks', async () => {
    const api = createApi('Submitted')

    const response = await fetch(`${api.url}/api/admin/operations/finance/12/approve`, {
      method: 'POST',
      headers: { 'x-admin-token': 'test-token' },
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message: 'Finance entry approved.' })
    expect(api.roleLists).toContainEqual(['ParishPriest', 'Secretary'])
  })

  it.each([
    ['submit', 'Draft', 'Finance entry submitted.', ['Bookkeeper']],
    ['reject', 'Submitted', 'Finance entry rejected.', ['ParishPriest', 'Secretary']],
    ['reconcile', 'Approved', 'Finance entry reconciled.', ['Bookkeeper']],
  ])('supports the %s transition with its matching role check', async (action, currentStatus, message, roles) => {
    const api = createApi(currentStatus)

    const response = await fetch(`${api.url}/api/admin/operations/finance/12/${action}`, { method: 'POST' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ message })
    expect(api.roleLists).toContainEqual(roles)
  })

  it('returns conflict when an action is invalid for the current entry status', async () => {
    const api = createApi('Draft')

    const response = await fetch(`${api.url}/api/admin/operations/finance/12/approve`, { method: 'POST' })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      message: 'Finance entry cannot be approved from Draft.',
    })
  })

  describe('SQL Server finance workflow transitions', () => {
    it('records reconciliation status, actor, and audit event in one transaction', async () => {
      const statements: Array<{ statement: string; values: Map<string, unknown> }> = []
      let committed = false
      class Transaction {
        constructor() {}
        async begin() {}
        async commit() { committed = true }
        async rollback() {}
        request() {
          const values = new Map<string, unknown>()
          return {
            input(name: string, _type: unknown, value: unknown) {
              values.set(name, value)
              return this
            },
            async query(statement: string) {
              statements.push({ statement, values: new Map(values) })
              if (statement.includes('SELECT Status')) {
                return { recordset: [{ Status: 'Approved' }] }
              }
              return { recordset: [], rowsAffected: [1, 1] }
            },
          }
        }
      }
      const sql = {
        Transaction,
        Int: 'Int',
        VarChar: (length: number) => length,
        NVarChar: (length: number) => length,
      }

      await expect(transitionSqlServerFinanceEntry({}, sql, 12, 'reconcile', 'bookkeeper@example.org'))
        .resolves.toEqual({ kind: 'updated', status: 'Reconciled' })

      expect(committed).toBe(true)
      expect(statements[1].statement).toContain("ReconciledBy = CASE WHEN @status = 'Reconciled'")
      expect(statements[1].statement).toContain('INSERT INTO dbo.FinancialEntryAudit')
      expect(statements[1].values.get('status')).toBe('Reconciled')
      expect(statements[1].values.get('changedBy')).toBe('bookkeeper@example.org')
      expect(statements[1].values.get('actionName')).toBe('reconcile')
    })
  })

  it('returns not found for a missing entry and rejects malformed IDs', async () => {
    const api = createApi(null)

    const missingResponse = await fetch(`${api.url}/api/admin/operations/finance/999/submit`, { method: 'POST' })
    const invalidResponse = await fetch(`${api.url}/api/admin/operations/finance/1x/submit`, { method: 'POST' })

    expect(missingResponse.status).toBe(404)
    expect(invalidResponse.status).toBe(400)
  })
})
