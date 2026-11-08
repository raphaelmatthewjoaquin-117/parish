// @vitest-environment node

import express from 'express'
import type { Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { createBlockedSlotsRouter } from './blocked-slots-router.js'
import { officeHourSlotTimes } from '../server-rules.js'

const servers: Server[] = []

function nextOfficeDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  while (!officeHourSlotTimes([
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')).length) {
    date.setDate(date.getDate() + 1)
  }
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parishDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const today = `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`
  const date = new Date(`${today}T00:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

async function startApi(
  initialRows: Record<string, unknown>[] = [],
  options: { postgresPool?: { query: (statement: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> } } = {},
) {
  const rows = [...initialRows]
  let nextId = 1
  const sql = {
    Int: 'Int',
    Date: 'Date',
    VarChar: (length: number) => `VarChar(${length})`,
    NVarChar: (length: number) => `NVarChar(${length})`,
  }
  const app = express()
  app.use(express.json())
  app.use(createBlockedSlotsRouter({
    postgresEnabled: Boolean(options.postgresPool),
    getPostgresPool: () => options.postgresPool!,
    sql,
    getPool: () => ({
      request: () => {
        const values: Record<string, unknown> = {}
        const request = {
          input(name: string, _type: unknown, value: unknown) {
            values[name] = value
            return request
          },
          query: async (statement: string) => {
            if (statement.includes('WHERE BlockDate <')) {
              const today = parishDate()
              const expired = rows.filter(row => String(row.BlockDate) < today)
              for (const row of expired) rows.splice(rows.indexOf(row), 1)
              return { recordset: [], rowsAffected: [expired.length] }
            }
            if (statement.includes('SELECT')) return { recordset: [...rows] }
            if (statement.includes('INSERT')) {
              const row = {
                BlockedSlotId: nextId++,
                BlockDate: values.date,
                BlockTime: values.time,
                Scope: values.scope,
                ServiceId: values.serviceId,
                ServiceName: null,
                Reason: values.reason,
              }
              rows.push(row)
              return { recordset: [{ BlockedSlotId: row.BlockedSlotId }] }
            }
            const id = Number(values.id)
            const index = rows.findIndex(row => row.BlockedSlotId === id)
            if (index < 0) return { recordset: [] }
            rows.splice(index, 1)
            return { recordset: [{ BlockedSlotId: id }] }
          },
        }
        return request
      },
    }),
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    logError: () => undefined,
  }))
  const server = app.listen(0, '127.0.0.1')
  servers.push(server)
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test server did not start.')
  return { baseUrl: `http://127.0.0.1:${address.port}/api/admin/blocked-slots`, rows }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })))
})

describe('admin blocked slots API', () => {
  it('automatically removes blocks before today and keeps today and future blocks', async () => {
    const { baseUrl, rows } = await startApi([
      { BlockedSlotId: 1, BlockDate: parishDate(-1), BlockTime: null, Scope: 'All', ServiceId: null, ServiceName: null, Reason: 'Expired' },
      { BlockedSlotId: 2, BlockDate: parishDate(), BlockTime: null, Scope: 'All', ServiceId: null, ServiceName: null, Reason: 'Today' },
      { BlockedSlotId: 3, BlockDate: parishDate(1), BlockTime: null, Scope: 'All', ServiceId: null, ServiceName: null, Reason: 'Future' },
    ])

    const listed = await fetch(baseUrl)

    expect(await listed.json()).toEqual([
      { id: 2, date: parishDate(), time: null, scope: 'All', serviceId: null, serviceName: null, reason: 'Today' },
      { id: 3, date: parishDate(1), time: null, scope: 'All', serviceId: null, serviceName: null, reason: 'Future' },
    ])
    expect(rows.map(row => row.BlockedSlotId)).toEqual([2, 3])
  })

  it('creates a slot, lists it, and deletes it', async () => {
    const { baseUrl } = await startApi()
    const date = nextOfficeDate()
    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: '09:00', scope: 'All', reason: 'Parish event' }),
    })
    expect(created.status).toBe(201)
    expect(await created.json()).toEqual({ id: 1 })

    const listed = await fetch(baseUrl)
    expect(await listed.json()).toEqual([{
      id: 1, date, time: '09:00', scope: 'All', serviceId: null, serviceName: null, reason: 'Parish event',
    }])

    const deleted = await fetch(`${baseUrl}/1`, { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ success: true })
  })

  it('rejects closed-day dates and times outside the selected day office hours', async () => {
    const { baseUrl, rows } = await startApi()
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-11-02', time: '09:00', scope: 'All' }),
    })
    expect(response.status).toBe(400)
    expect(rows).toHaveLength(0)
  })

  it('lists, creates, and deletes blocked slots through PostgreSQL when enabled', async () => {
    const date = nextOfficeDate()
    const postgresPool = {
      query: async (statement: string) => {
        if (statement.includes('"BlockDate" <')) return { rows: [], rowCount: 0 }
        if (statement.includes('INSERT INTO')) return { rows: [{ id: 17 }], rowCount: 1 }
        if (statement.includes('DELETE') && statement.includes('RETURNING')) return { rows: [{ id: 17 }], rowCount: 1 }
        return {
          rows: [{
            id: 17,
            date,
            time: '09:00',
            scope: 'All',
            serviceId: null,
            serviceName: null,
            reason: 'Parish event',
          }],
          rowCount: 1,
        }
      },
    }
    const { baseUrl } = await startApi([], { postgresPool })

    const listed = await fetch(baseUrl)
    expect(await listed.json()).toEqual([{
      id: 17,
      date,
      time: '09:00',
      scope: 'All',
      serviceId: null,
      serviceName: null,
      reason: 'Parish event',
    }])

    const created = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, time: '09:00', scope: 'All', reason: 'Parish event' }),
    })
    expect(created.status).toBe(201)
    expect(await created.json()).toEqual({ id: 17 })

    const deleted = await fetch(`${baseUrl}/17`, { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ success: true })
  })
})
