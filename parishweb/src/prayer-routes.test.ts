// @vitest-environment node

import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPrayerRouter } from './prayer-routes.js'

const servers: Array<ReturnType<express.Express['listen']>> = []

function createTestApi(query: (
  statement: string,
  inputs: Map<string, unknown>,
) => { recordset: Array<Record<string, unknown>> } | Promise<{ recordset: Array<Record<string, unknown>> }>) {
  const app = express()
  app.use(express.json())
  app.use(createPrayerRouter({
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
    sql: { Int: 'Int', NVarChar: (length: unknown) => length, Bit: 'Bit', MAX: 'MAX' },
    requireAdmin: (_req, _res, next) => next(),
    requireRole: () => (_req, _res, next) => next(),
    logError: vi.fn(),
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

describe('prayer API routes', () => {
  it('lists only approved, community-shared prayers and hides anonymous names', async () => {
    const api = createTestApi(async statement => {
      expect(statement).toMatch(/IsApproved\s*=\s*1/i)
      expect(statement).toMatch(/ShareWithCommunity\s*=\s*1/i)
      return {
        recordset: [
          { PrayerId: 7, Name: 'Private name', Category: 'healing', Request: 'Please pray for healing.', Anonymous: true, CreatedAt: '2026-10-28' },
        ],
      }
    })

    const response = await fetch(`${api}/api/prayers`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([
      {
        id: 7,
        name: 'Anonymous',
        category: 'healing',
        request: 'Please pray for healing.',
        createdAt: '2026-10-28',
      },
    ])
  })

  it('rejects invalid prayer requests before writing to the database', async () => {
    const query = vi.fn(async () => ({ recordset: [] }))
    const api = createTestApi(query)

    const response = await fetch(`${api}/api/prayers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam', category: 'unknown', request: 'Please pray for me.' }),
    })

    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })

  it('creates prayer requests as pending approval', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/INSERT INTO dbo\.PrayerRequests/i)
      expect(statement).toMatch(/IsApproved/i)
      expect(inputs.get('name')).toBe('Sam')
      return { recordset: [{ PrayerId: 12 }] }
    })

    const response = await fetch(`${api}/api/prayers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sam',
        category: 'healing',
        request: 'Please pray for my recovery.',
        anonymous: false,
        shareWithCommunity: true,
      }),
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 12, message: 'Prayer request received.' })
  })

  it('approves a prayer request through the staff route', async () => {
    const api = createTestApi(async (statement, inputs) => {
      expect(statement).toMatch(/UPDATE dbo\.PrayerRequests/i)
      expect(inputs.get('prayerId')).toBe(12)
      return { recordset: [{ PrayerId: 12 }] }
    })

    const response = await fetch(`${api}/api/prayers/12/approve`, { method: 'POST' })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
  })
})
