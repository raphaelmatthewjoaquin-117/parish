import type { RequestHandler, Router } from 'express'

interface BlockedSlotRequest {
  input(name: string, type: unknown, value: unknown): BlockedSlotRequest
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>>; rowsAffected?: number[] }>
}

interface BlockedSlotsRouteOptions {
  getPool: () => { request: () => BlockedSlotRequest }
  sql: {
    Date: unknown
    Int: unknown
    VarChar(length: number): unknown
    NVarChar(length: number): unknown
  }
  requireAdmin: RequestHandler
  requireRole(roles: string[]): RequestHandler
  logError(error: unknown, metadata: { context: string }): void
}

export function createBlockedSlotsRouter(options: BlockedSlotsRouteOptions): Router
export function cleanupExpiredBlockedSlots(getPool: () => { request: () => BlockedSlotRequest }): Promise<number>
