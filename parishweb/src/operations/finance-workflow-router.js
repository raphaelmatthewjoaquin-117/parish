import express from 'express';
import { financeActionForStatus, financeTransition } from '../../server-rules.js';

const workflows = {
  submit: { roles: ['Bookkeeper'], verb: 'submitted', message: 'Finance entry submitted.' },
  approve: { roles: ['ParishPriest', 'Secretary'], verb: 'approved', message: 'Finance entry approved.' },
  reject: { roles: ['ParishPriest', 'Secretary'], verb: 'rejected', message: 'Finance entry rejected.' },
  reconcile: { roles: ['Bookkeeper'], verb: 'reconciled', message: 'Finance entry reconciled.' },
};

export function createFinanceWorkflowRouter({
  transitionFinanceEntry,
  requireAdmin,
  requireRole,
  logError,
  staffName,
}) {
  const router = express.Router();

  for (const [action, workflow] of Object.entries(workflows)) {
    router.post(
      `/api/admin/operations/finance/:id/${action}`,
      requireAdmin,
      requireRole(workflow.roles),
      async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ message: 'Invalid finance entry ID.' });
        }

        try {
          const result = await transitionFinanceEntry(id, action, staffName(req));
          if (result.kind === 'not-found') {
            return res.status(404).json({ message: 'Finance entry not found.' });
          }
          if (result.kind === 'invalid-transition') {
            return res.status(409).json({
              message: `Finance entry cannot be ${workflow.verb} from ${result.currentStatus}.`,
            });
          }
          return res.json({ message: workflow.message });
        } catch (error) {
          logError(error, { context: `finance${action[0].toUpperCase()}${action.slice(1)}` });
          return res.status(500).json({ message: `Unable to ${action} finance entry.` });
        }
      },
    );
  }

  return router;
}

export async function transitionSqlServerFinanceEntry(pool, sql, id, action, changedBy) {
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  try {
    await transaction.begin();
    transactionStarted = true;
    const currentResult = await transaction.request()
      .input('id', sql.Int, id)
      .query('SELECT Status FROM dbo.FinancialEntries WITH (UPDLOCK, ROWLOCK) WHERE FinancialEntryId = @id');
    const currentStatus = currentResult.recordset[0]?.Status;
    if (!currentStatus) {
      await transaction.rollback();
      transactionStarted = false;
      return { kind: 'not-found' };
    }

    const nextStatus = financeTransition(currentStatus, action);
    if (!nextStatus || !Object.prototype.hasOwnProperty.call(workflows, action)) {
      await transaction.rollback();
      transactionStarted = false;
      return { kind: 'invalid-transition', currentStatus };
    }

    await transaction.request()
      .input('id', sql.Int, id)
      .input('status', sql.VarChar(30), nextStatus)
      .input('changedBy', sql.NVarChar(256), changedBy)
      .input('actionName', sql.VarChar(30), financeActionForStatus(nextStatus))
      .query(`
        UPDATE dbo.FinancialEntries
        SET Status = @status, UpdatedAt = SYSUTCDATETIME(),
          ApprovedBy = CASE WHEN @status = 'Approved' THEN @changedBy ELSE ApprovedBy END,
          ApprovedAt = CASE WHEN @status = 'Approved' THEN SYSUTCDATETIME() ELSE ApprovedAt END,
          ReconciledBy = CASE WHEN @status = 'Reconciled' THEN @changedBy ELSE ReconciledBy END,
          ReconciledAt = CASE WHEN @status = 'Reconciled' THEN SYSUTCDATETIME() ELSE ReconciledAt END
        WHERE FinancialEntryId = @id;

        INSERT INTO dbo.FinancialEntryAudit (FinancialEntryId, ActionName, ChangedBy)
        VALUES (@id, @actionName, @changedBy);
      `);
    await transaction.commit();
    transactionStarted = false;
    return { kind: 'updated', status: nextStatus };
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Finance workflow update and rollback failed.');
      }
    }
    throw error;
  }
}
