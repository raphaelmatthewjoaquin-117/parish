import type { PostgresPool } from '../db/postgres-pool.js'

export interface FinancePeriod {
  type: 'Weekly' | 'Monthly'
  start: string
  end: string
}

export function previousCompletedFinancePeriods(now?: Date): FinancePeriod[]
export function generatePostgresFinanceSnapshots(
  pool: Pick<PostgresPool, 'query'>,
  now?: Date,
): Promise<number>
