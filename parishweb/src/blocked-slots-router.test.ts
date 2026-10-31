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

async function startApi() {
  const rows: Record<string, unknown>[] = []
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
})
