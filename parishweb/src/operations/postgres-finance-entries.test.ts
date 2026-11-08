import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresFinanceEntry,
  deletePostgresFinanceEntry,
  listPostgresFinanceEntries,
  transitionPostgresFinanceEntry,
  updatePostgresFinanceEntry,
} from './postgres-finance-entries.js';
import { generatePostgresFinanceSnapshots } from './finance-snapshots.js';

describe('PostgreSQL finance entries repository', () => {
  it('upserts weekly and monthly snapshots from approved and reconciled entries', async () => {
    const calls: Array<{ statement: string; values?: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (statement: string, values?: unknown[]) => {
        calls.push({ statement, values });
        if (statement.includes('SUM(CASE')) {
          return {
            rows: [{ income: '100.00', expenses: '25.00' }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };

    await expect(generatePostgresFinanceSnapshots(pool, new Date('2026-11-08T12:00:00Z')))
      .resolves.toBe(2);

    const totalsQueries = calls.filter(call => call.statement.includes('SUM(CASE'));
    const snapshotQueries = calls.filter(call => call.statement.includes('INSERT INTO "public"."FinanceReportSnapshots"'));
    expect(totalsQueries).toHaveLength(2);
    expect(totalsQueries[0].statement).toContain('"Status" IN (\'Approved\', \'Reconciled\')');
    expect(totalsQueries[0].values).toEqual(['2026-10-26', '2026-11-01']);
    expect(totalsQueries[1].values).toEqual(['2026-10-01', '2026-10-31']);
    expect(snapshotQueries.map(call => call.values)).toEqual([
      ['Weekly', '2026-10-26', '2026-11-01', 100, 25, 75, '{"generatedAutomatically":true}', 'System'],
      ['Monthly', '2026-10-01', '2026-10-31', 100, 25, 75, '{"generatedAutomatically":true}', 'System'],
    ]);
    expect(snapshotQueries[0].statement).toMatch(/ON CONFLICT \("ReportType", "PeriodStart", "PeriodEnd"\)\s+DO UPDATE/);
  });

  it('fails when PostgreSQL does not persist a generated snapshot', async () => {
    let upsertAttempt = 0;
    const pool = {
      query: vi.fn(async (statement: string) => {
        if (statement.includes('SUM(CASE')) {
          return { rows: [{ income: '0', expenses: '0' }], rowCount: 1 };
        }
        upsertAttempt += 1;
        return { rows: [], rowCount: 0 };
      }),
    };

    await expect(generatePostgresFinanceSnapshots(pool, new Date('2026-11-08T12:00:00Z')))
      .rejects.toThrow('PostgreSQL did not persist the finance snapshot.');
    expect(upsertAttempt).toBe(1);
  });

  it('lists the latest 200 entries and returns numeric amounts', async () => {
    const entries = [{
      FinancialEntryId: 7,
      EntryDate: '2026-11-08',
      EntryType: 'Donation',
      Description: 'Clearly labeled test donation',
      Amount: '125.50',
      EnteredBy: 'test-staff@example.org',
      Status: 'Draft',
    }];
    const pool = { query: vi.fn().mockResolvedValue({ rows: entries, rowCount: 1 }) };

    await expect(listPostgresFinanceEntries(pool)).resolves.toEqual([{
      ...entries[0],
      Amount: 125.5,
    }]);
  });

  it('creates a draft entry and returns the legacy ID field', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ FinancialEntryId: 12 }], rowCount: 1 }) };

    await expect(createPostgresFinanceEntry(pool, {
      date: '2026-11-08',
      entryType: 'Donation',
      description: 'Clearly labeled test donation',
      amount: 125.5,
      enteredBy: 'test-staff@example.org',
    })).resolves.toEqual({ FinancialEntryId: 12 });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      '2026-11-08',
      'Donation',
      'Clearly labeled test donation',
      125.5,
      'test-staff@example.org',
    ]);
  });

  it('updates entry fields by parameterized ID', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) };

    await expect(updatePostgresFinanceEntry(pool, 12, {
      date: '2026-11-09',
      entryType: 'Expense',
      description: 'Clearly labeled test expense',
      amount: 40,
      status: 'Draft',
    })).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      12,
      '2026-11-09',
      'Expense',
      'Clearly labeled test expense',
      40,
      'Draft',
    ]);
  });

  it('deletes an entry by parameterized ID and reports whether it existed', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };

    await expect(deletePostgresFinanceEntry(pool, 12)).resolves.toBe(false);
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [12]);
  });

  it('approves a submitted entry and records the approver and audit event atomically', async () => {
    const queries: Array<{ statement: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (statement: string, values?: unknown[]) => {
        queries.push({ statement, values });
        if (statement.includes('SELECT "Status"')) return { rows: [{ Status: 'Submitted' }], rowCount: 1 };
        if (statement.includes('UPDATE "public"."FinancialEntries"')) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };

    await expect(transitionPostgresFinanceEntry(pool, 12, 'approve', 'priest@example.org'))
      .resolves.toEqual({ kind: 'updated', status: 'Approved' });

    expect(queries.map(query => query.statement.trim().split(/\s+/)[0])).toEqual([
      'BEGIN',
      'SELECT',
      'UPDATE',
      'INSERT',
      'COMMIT',
    ]);
    expect(queries[2].statement).toContain('"ApprovedBy" = $3');
    expect(queries[2].statement).toContain('"ApprovedAt" = timezone');
    expect(queries[2].values).toEqual([12, 'Approved', 'priest@example.org']);
    expect(queries[3].statement).toContain('INSERT INTO "public"."FinancialEntryAudit"');
    expect(queries[3].values).toEqual([12, 'approve', 'priest@example.org']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects illegal finance transitions without writing an audit event', async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (statement: string) => {
        statements.push(statement);
        if (statement.includes('SELECT "Status"')) return { rows: [{ Status: 'Draft' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    await expect(transitionPostgresFinanceEntry({ connect: async () => client }, 12, 'approve', 'priest@example.org'))
      .resolves.toEqual({ kind: 'invalid-transition', currentStatus: 'Draft' });
    expect(statements.some(statement => statement.includes('UPDATE "public"."FinancialEntries"'))).toBe(false);
    expect(statements.some(statement => statement.includes('INSERT INTO "public"."FinancialEntryAudit"'))).toBe(false);
    expect(statements.at(-1)).toBe('ROLLBACK');
  });

  it('records who reconciled an approved entry and when', async () => {
    const queries: Array<{ statement: string; values?: unknown[] }> = [];
    const client = {
      query: vi.fn(async (statement: string, values?: unknown[]) => {
        queries.push({ statement, values });
        if (statement.includes('SELECT "Status"')) return { rows: [{ Status: 'Approved' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    await expect(transitionPostgresFinanceEntry({ connect: async () => client }, 12, 'reconcile', 'bookkeeper@example.org'))
      .resolves.toEqual({ kind: 'updated', status: 'Reconciled' });

    const update = queries.find(query => query.statement.includes('UPDATE "public"."FinancialEntries"'));
    expect(update?.statement).toContain('"ReconciledBy" = $3');
    expect(update?.statement).toContain('"ReconciledAt" = timezone');
    expect(update?.values).toEqual([12, 'Reconciled', 'bookkeeper@example.org']);
  });

  it('reports a missing finance entry without attempting an update', async () => {
    const statements: string[] = [];
    const client = {
      query: vi.fn(async (statement: string) => {
        statements.push(statement);
        if (statement.includes('SELECT "Status"')) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };

    await expect(transitionPostgresFinanceEntry({ connect: async () => client }, 999, 'submit', 'staff@example.org'))
      .resolves.toEqual({ kind: 'not-found' });
    expect(statements.some(statement => statement.includes('UPDATE "public"."FinancialEntries"'))).toBe(false);
    expect(statements.at(-1)).toBe('ROLLBACK');
  });
});
