import type { ISqlType } from 'mssql'

interface ServiceRequestDeletionTransaction {
  begin(): Promise<unknown>
  commit(): Promise<unknown>
  rollback(): Promise<unknown>
  request(): {
    input(name: string, type: ISqlType | (() => ISqlType), value: number): {
      query(statement: string): Promise<unknown>
    }
  }
}

export function deleteServiceRequest(transaction: ServiceRequestDeletionTransaction, requestId: number): Promise<void>
