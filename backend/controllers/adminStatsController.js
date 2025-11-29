// backend/controllers/adminStatsController.js
const db = require("../db");

// Helper to safely parse numeric
const num = (v) => (v == null ? 0 : Number(v));

// GET /api/admin/dashboard-stats
async function getDashboardStats(req, res) {
  try {
    // 1) Core counts
    const borrowerRow = (await db.query("SELECT COUNT(*)::int AS count FROM users WHERE LOWER(COALESCE(role,'')) = 'borrower'")).rows[0] || { count: 0 };
    const borrowerCount = borrowerRow.count || 0;

    const activeLoanRow = (await db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(COALESCE(status,'')) = 'active'")).rows[0] || { count: 0 };
    const activeLoanCount = activeLoanRow.count || 0;

    const rejectedRow = (await db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(COALESCE(status,'')) = 'rejected'")).rows[0] || { count: 0 };
    const rejectedCount = rejectedRow.count || 0;

    const pendingLoanApproval = (await db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(COALESCE(status,'')) = 'pending'")).rows[0].count || 0;

    const pendingDisbursement = (await db.query(`
      SELECT COUNT(*)::int AS count FROM loans
      WHERE LOWER(COALESCE(status,'')) IN ('approved','approved_pending_disburse','approved_pending_disbursement','approved_for_disbursement')
    `)).rows[0].count || 0;

    // total disbursed amount
    const totalDisbursedRow = (await db.query(`
      SELECT COALESCE(SUM(COALESCE(disbursed_amount,0)),0) AS total FROM loans WHERE disbursed_at IS NOT NULL
    `)).rows[0] || { total: 0 };
    const totalDisbursedLoan = num(totalDisbursedRow.total);

    // loan status distribution
    const loanDist = (await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(status) = 'paid' THEN COALESCE(disbursed_amount, amount_requested,0) ELSE 0 END),0) AS paid_amount,
        COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN COALESCE(disbursed_amount, amount_requested,0) ELSE 0 END),0) AS unpaid_amount,
        COALESCE(SUM(CASE WHEN LOWER(status) = 'overdue' THEN COALESCE(disbursed_amount, amount_requested,0) ELSE 0 END),0) AS overdue_amount
      FROM loans
    `)).rows[0] || { paid_amount: 0, unpaid_amount: 0, overdue_amount: 0 };

    const paidAmount = num(loanDist.paid_amount);
    const unpaidAmount = num(loanDist.unpaid_amount);
    const overdueAmount = num(loanDist.overdue_amount);

    // payment overview: payments today (transactions) & collectibles today from repayment_schedule
    const actualPaymentsTodayRow = (await db.query(`
      SELECT COALESCE(SUM(amount),0) AS total FROM transactions
      WHERE (type = 'loan_payment' OR type = 'repayment') AND (date_paid::date = current_date OR created_at::date = current_date)
    `)).rows[0] || { total: 0 };
    const actualPayments = num(actualPaymentsTodayRow.total);

    const collectiblesTodayRow = (await db.query(`
      SELECT COALESCE(SUM(expected_amount),0) AS total FROM repayment_schedule
      WHERE due_date::date = current_date
    `)).rows[0] || { total: 0 };
    const collectiblesToday = num(collectiblesTodayRow.total);

    // weekly collections (last 7 days)
    const weeklyCollectionRows = (await db.query(`
      SELECT to_char(d::date,'Dy') AS label,
             COALESCE((SELECT SUM(amount) FROM transactions t WHERE (t.type='loan_payment' OR t.type='repayment') AND (date_trunc('day', COALESCE(t.date_paid, t.created_at))::date = d::date)),0) AS total
      FROM generate_series(current_date - INTERVAL '6 days', current_date, INTERVAL '1 day') AS d
      ORDER BY d
    `)).rows || [];
    const weeklyCollectionsLabels = weeklyCollectionRows.map(r => r.label);
    const weeklyCollectionsValues = weeklyCollectionRows.map(r => num(r.total));

    // payments 4 weeks (transactions) and collectibles 4 weeks (schedule)
    const payments4Row = (await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN (COALESCE(date_paid, created_at) >= NOW() - INTERVAL '7 days') THEN amount ELSE 0 END),0) AS week1,
        COALESCE(SUM(CASE WHEN (COALESCE(date_paid, created_at) < NOW() - INTERVAL '7 days' AND COALESCE(date_paid, created_at) >= NOW() - INTERVAL '14 days') THEN amount ELSE 0 END),0) AS week2,
        COALESCE(SUM(CASE WHEN (COALESCE(date_paid, created_at) < NOW() - INTERVAL '14 days' AND COALESCE(date_paid, created_at) >= NOW() - INTERVAL '21 days') THEN amount ELSE 0 END),0) AS week3,
        COALESCE(SUM(CASE WHEN (COALESCE(date_paid, created_at) < NOW() - INTERVAL '21 days' AND COALESCE(date_paid, created_at) >= NOW() - INTERVAL '28 days') THEN amount ELSE 0 END),0) AS week4
      FROM transactions
      WHERE type = 'loan_payment' OR type = 'repayment'
    `)).rows[0] || { week1: 0, week2: 0, week3: 0, week4: 0 };

    const weeklyPayments4 = [num(payments4Row.week1), num(payments4Row.week2), num(payments4Row.week3), num(payments4Row.week4)];

    const collectibles4Rows = (await db.query(`
      WITH sched AS (
        SELECT l.id AS loan_id, COALESCE(l.disbursed_amount, l.amount_requested, 0) AS principal, l.disbursed_at
        FROM loans l WHERE l.disbursed_at IS NOT NULL
      ), installments AS (
        SELECT loan_id, (principal / 4.0) AS installment_amount, (disbursed_at + (n * INTERVAL '7 days'))::timestamp AS due_dt
        FROM sched CROSS JOIN generate_series(1,4) AS n
      )
      SELECT
        COALESCE(SUM(CASE WHEN due_dt >= NOW() - INTERVAL '7 days' THEN installment_amount ELSE 0 END),0) AS week1,
        COALESCE(SUM(CASE WHEN due_dt < NOW() - INTERVAL '7 days' AND due_dt >= NOW() - INTERVAL '14 days' THEN installment_amount ELSE 0 END),0) AS week2,
        COALESCE(SUM(CASE WHEN due_dt < NOW() - INTERVAL '14 days' AND due_dt >= NOW() - INTERVAL '21 days' THEN installment_amount ELSE 0 END),0) AS week3,
        COALESCE(SUM(CASE WHEN due_dt < NOW() - INTERVAL '21 days' AND due_dt >= NOW() - INTERVAL '28 days' THEN installment_amount ELSE 0 END),0) AS week4
      FROM installments;
    `)).rows[0] || { week1: 0, week2: 0, week3: 0, week4: 0 };

    const weeklyCollectibles4 = [num(collectibles4Rows.week1), num(collectibles4Rows.week2), num(collectibles4Rows.week3), num(collectibles4Rows.week4)];

    // payment behavior on-time/late (4 weeks) — best-effort using transactions + repayment_schedule
    const behaviorRows = (await db.query(`
      WITH payments AS (
        SELECT t.id, t.loan_id, COALESCE(t.date_paid, t.created_at) AS paid_at, s.due_date, s.expected_amount
        FROM transactions t
        LEFT JOIN repayment_schedule s ON s.loan_id = t.loan_id AND s.expected_amount = t.amount
        WHERE (t.type = 'loan_payment' OR t.type = 'repayment') AND COALESCE(t.date_paid, t.created_at) >= NOW() - INTERVAL '28 days'
      ), with_week AS (
        SELECT *, (FLOOR(EXTRACT(EPOCH FROM (paid_at - COALESCE(due_date, paid_at))) / (7*24*3600)) + 1)::int AS week_number
        FROM payments
      )
      SELECT COALESCE(week_number,1) AS week_number,
             COALESCE(SUM(CASE WHEN (due_date IS NOT NULL AND (paid_at::date <= due_date::date)) OR (due_date IS NULL) THEN 1 ELSE 0 END),0) AS on_time,
             COALESCE(SUM(CASE WHEN (due_date IS NOT NULL AND paid_at::date > due_date::date) THEN 1 ELSE 0 END),0) AS late
      FROM with_week
      WHERE (COALESCE(week_number,1) BETWEEN 1 AND 4)
      GROUP BY week_number
      ORDER BY week_number;
    `)).rows || [];

    const onTimeMap = {};
    const lateMap = {};
    behaviorRows.forEach(r => {
      const wk = Number(r.week_number) || 1;
      onTimeMap[wk] = num(r.on_time);
      lateMap[wk] = num(r.late);
    });
    const onTimeCounts4 = [1,2,3,4].map(i => onTimeMap[i] || 0);
    const lateCounts4 = [1,2,3,4].map(i => lateMap[i] || 0);

    // cashflow 12 weeks (repayments & disbursements)
    const cashflowRows = (await db.query(`
      WITH weeks AS (
        SELECT generate_series(11, 0, -1) AS idx
      )
      SELECT
        w.idx,
        (current_date - (w.idx * INTERVAL '7 days'))::date AS week_start,
        COALESCE((
          SELECT SUM(COALESCE(disbursed_amount, amount_requested,0))
          FROM loans
          WHERE disbursed_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date
            AND disbursed_at::date <  (current_date - (w.idx * INTERVAL '7 days'))::date
        ),0) AS disbursed,
        COALESCE((
          SELECT SUM(amount) FROM transactions t
          WHERE (t.type = 'loan_payment' OR t.type = 'repayment') AND t.created_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date
            AND t.created_at::date < (current_date - (w.idx * INTERVAL '7 days'))::date
        ),0) AS repaid
      FROM weeks w
      ORDER BY w.idx;
    `)).rows || [];

    const cashflowLabels = cashflowRows.map((r,i) => `Week ${i+1}`);
    const cashflowDisbursed = cashflowRows.map(r => num(r.disbursed));
    const cashflowRepaid = cashflowRows.map(r => num(r.repaid));
    const cashflowNet = cashflowDisbursed.map((v,i) => num(cashflowRepaid[i] || 0) - num(v || 0));

    // Build final
    return res.json({
      borrowerCount,
      activeLoanCount,
      rejectedCount,
      pendingLoanApproval,
      pendingDisbursement,
      totalDisbursedLoan,
      loanStatusDistribution: { unpaidAmount, paidAmount, overdueAmount },
      paymentOverview: { collectiblesToday, actualPayments },
      weeklyCollections: { labels: weeklyCollectionsLabels, values: weeklyCollectionsValues },
      weeklyPayments4,
      weeklyCollectibles4,
      onTimeCounts4,
      lateCounts4,
      weeklyRepayments12: cashflowRepaid,
      weeklyDisbursements12: cashflowDisbursed,
      weeklyNet12: cashflowNet
    });
  } catch (err) {
    console.error('getDashboardStats error', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}

module.exports = { getDashboardStats };
