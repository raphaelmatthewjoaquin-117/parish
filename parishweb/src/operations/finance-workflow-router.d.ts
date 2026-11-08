import type { Request, RequestHandler, Router } from 'express'

type FinanceTransitionResult =
  | { kind: 'updated'; status: string }
  | { kind: 'invalid-transition'; currentStatus: string }
  | { kind: 'not-found' }

interface SqlServerRequest {
  input(name: string, type: unknown, value: unknown): SqlServerRequest
  query(statement: string): Promise<{
    recordset: Array<Record<string, unknown>>
    rowsAffected?: number[]
  }>
}

interface SqlServerTransaction {
  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  request(): SqlServerRequest
}

interface SqlServerTypes {
  Transaction: new (pool: unknown) => SqlServerTransaction
  Int: unknown
  VarChar(length: number): unknown
  NVarChar(length: number): unknown
}

export function createFinanceWorkflowRouter(options: {
  transitionFinanceEntry(id: number, action: string, changedBy: string): Promise<FinanceTransitionResult>
  requireAdmin: RequestHandler
  requireRole(roles: string[]): RequestHandler
  logError(error: unknown, metadata: { context: string }): void
  staffName(req: Request): string
}): Router

export function transitionSqlServerFinanceEntry(
  pool: unknown,
  sql: SqlServerTypes,
  id: number,
  action: string,
  changedBy: string,
): Promise<FinanceTransitionResult>
