function dateOnly(value) {
  return value.toISOString().slice(0, 10);
}

export function previousCompletedFinancePeriods(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = today.getUTCDay() || 7;
  const currentMonday = new Date(today);
  currentMonday.setUTCDate(today.getUTCDate() - day + 1);
  const weekStart = new Date(currentMonday);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekEnd = new Date(currentMonday);
  weekEnd.setUTCDate(weekEnd.getUTCDate() - 1);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return [
    { type: 'Weekly', start: dateOnly(weekStart), end: dateOnly(weekEnd) },
    { type: 'Monthly', start: dateOnly(monthStart), end: dateOnly(monthEnd) },
  ];
}

export async function generatePostgresFinanceSnapshots(pool, now = new Date()) {
  const periods = previousCompletedFinancePeriods(now);
  for (const period of periods) {
    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN "EntryType" <> 'Expense' THEN "Amount" ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN "EntryType" = 'Expense' THEN "Amount" ELSE 0 END), 0) AS expenses
      FROM "public"."FinancialEntries"
      WHERE "EntryDate" BETWEEN $1 AND $2
        AND "Status" IN ('Approved', 'Reconciled')
    `, [period.start, period.end]);
    const row = totals.rows[0] || { income: 0, expenses: 0 };
    const income = Number(row.income || 0);
    const expenses = Number(row.expenses || 0);

    const saved = await pool.query(`
      INSERT INTO "public"."FinanceReportSnapshots"
        ("ReportType", "PeriodStart", "PeriodEnd", "TotalIncome", "TotalExpenses",
          "NetTotal", "Details", "GeneratedBy")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT ("ReportType", "PeriodStart", "PeriodEnd")
      DO UPDATE SET "TotalIncome" = EXCLUDED."TotalIncome",
        "TotalExpenses" = EXCLUDED."TotalExpenses",
        "NetTotal" = EXCLUDED."NetTotal",
        "Details" = EXCLUDED."Details",
        "GeneratedAt" = timezone('UTC', now()),
        "GeneratedBy" = EXCLUDED."GeneratedBy"
    `, [
      period.type,
      period.start,
      period.end,
      income,
      expenses,
      income - expenses,
      JSON.stringify({ generatedAutomatically: true }),
      'System',
    ]);
    if (saved.rowCount !== 1) throw new Error('PostgreSQL did not persist the finance snapshot.');
  }
  return periods.length;
}
