import type { RequestHandler, Router } from 'express'

interface PrayerRequest {
  input(name: string, type: unknown, value: unknown): PrayerRequest
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>> }>
}

interface PrayerRouteOptions {
  getPool: () => {
    request: () => PrayerRequest
  }
  sql: {
    Int: unknown
    Bit: unknown
    MAX: unknown
    NVarChar(length: unknown): unknown
  }
  requireAdmin: RequestHandler
  requireRole(roles: string[]): RequestHandler
  logError(error: unknown, metadata: { context: string }): void
}

export function createPrayerRouter(options: PrayerRouteOptions): Router
