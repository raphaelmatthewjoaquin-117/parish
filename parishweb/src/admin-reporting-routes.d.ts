import type { RequestHandler, Router } from 'express'

interface SqlRequest {
  input(name: string, type: unknown, value: unknown): SqlRequest
  query(statement: string): Promise<{ recordset: Array<Record<string, unknown>> }>
}

interface SqlTypes {
  Date: unknown
  Int: unknown
  MAX: unknown
  VarChar(length: number): unknown
  NVarChar(length: number): unknown
}

interface ArchiveUploadFile {
  path: string
  filename: string
  originalname: string
  mimetype: string
  size: number
}

export function createAdminReportingRouter(options: {
  getPool: () => { request: () => SqlRequest }
  sql: SqlTypes
  requireAdmin: RequestHandler
  requireRole: (roles: string[]) => RequestHandler
  logError: (error: unknown, metadata: { context: string }) => void
  uploadDirectory?: string
  uploadArchive?: RequestHandler
  saveArchiveFile?: (file: ArchiveUploadFile) => Promise<string>
  requireAdminWithQueryToken?: RequestHandler
  getArchiveFile?: (fileUrl: string) => Promise<{
    contents: Buffer
    contentType: string
    filename: string
  }>
  deleteArchiveFile?: (fileUrl: string) => Promise<void>
}): Router
