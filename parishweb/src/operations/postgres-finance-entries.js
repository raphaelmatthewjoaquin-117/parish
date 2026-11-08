import { financeActionForStatus, financeTransition } from '../../server-rules.js';

export async function listPostgresFinanceEntries(pool) {
  const result = await pool.query(`
    SELECT *
    FROM "public"."FinancialEntries"
    ORDER BY "EntryDate" DESC, "FinancialEntryId" DESC
    LIMIT 200
  `);
  return result.rows.map(entry => ({ ...entry, Amount: Number(entry.Amount) }));
}

export async function createPostgresFinanceEntry(pool, entry) {
  const result = await pool.query(`
    INSERT INTO "public"."FinancialEntries"
      ("EntryDate", "EntryType", "Description", "Amount", "EnteredBy")
    VALUES ($1, $2, $3, $4, $5)
    RETURNING "FinancialEntryId"
  `, [entry.date, entry.entryType, entry.description, entry.amount, entry.enteredBy]);
  if (!result.rows[0]) throw new Error('PostgreSQL did not return the created finance entry ID.');
  return result.rows[0];
}

export async function updatePostgresFinanceEntry(pool, id, entry) {
  const result = await pool.query(`
    UPDATE "public"."FinancialEntries"
    SET "EntryDate" = $2, "EntryType" = $3, "Description" = $4, "Amount" = $5,
      "Status" = $6, "UpdatedAt" = timezone('UTC', now())
    WHERE "FinancialEntryId" = $1
  `, [id, entry.date, entry.entryType, entry.description, entry.amount, entry.status]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function deletePostgresFinanceEntry(pool, id) {
  const result = await pool.query(`
    DELETE FROM "public"."FinancialEntries"
    WHERE "FinancialEntryId" = $1
  `, [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function transitionPostgresFinanceEntry(pool, id, action, changedBy) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const currentResult = await client.query(`
      SELECT "Status"
      FROM "public"."FinancialEntries"
      WHERE "FinancialEntryId" = $1
      FOR UPDATE
    `, [id]);
    const currentStatus = currentResult.rows[0]?.Status;
    if (!currentStatus) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { kind: 'not-found' };
    }

    const nextStatus = financeTransition(currentStatus, action);
    if (!nextStatus || !['submit', 'reject', 'approve', 'reconcile'].includes(action)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return { kind: 'invalid-transition', currentStatus };
    }

    const statusFields = action === 'approve'
      ? ', "ApprovedBy" = $3, "ApprovedAt" = timezone(\'UTC\', now())'
      : action === 'reconcile'
        ? ', "ReconciledBy" = $3, "ReconciledAt" = timezone(\'UTC\', now())'
        : '';
    const values = action === 'approve' || action === 'reconcile'
      ? [id, nextStatus, changedBy]
      : [id, nextStatus];

    const updated = await client.query(`
      UPDATE "public"."FinancialEntries"
      SET "Status" = $2, "UpdatedAt" = timezone('UTC', now())${statusFields}
      WHERE "FinancialEntryId" = $1
    `, values);
    if (updated.rowCount !== 1) throw new Error('Finance entry changed while its workflow transition was locked.');
    const audited = await client.query(`
      INSERT INTO "public"."FinancialEntryAudit"
        ("FinancialEntryId", "ActionName", "ChangedBy")
      VALUES ($1, $2, $3)
    `, [id, financeActionForStatus(nextStatus), changedBy]);
    if (audited.rowCount !== 1) throw new Error('PostgreSQL did not record the finance workflow audit event.');
    await client.query('COMMIT');
    transactionStarted = false;
    return { kind: 'updated', status: nextStatus };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Finance workflow update and rollback failed.');
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
