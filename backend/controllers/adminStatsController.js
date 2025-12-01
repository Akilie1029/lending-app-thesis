// backend/controllers/adminStatsController.js
const db = require("../db");

// Helper to safely convert DB values to number
const num = (v) => (v == null ? 0 : Number(v));

// ====================================================================
//                           DASHBOARD STATS
// ====================================================================
async function getDashboardStats(req, res) {
  try {
    // ===============================================================
    // 1) BASIC COUNTS
    // ===============================================================
    const borrowerCount =
      (await db.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE LOWER(role) = 'borrower'"
      )).rows[0]?.count || 0;

    const activeLoanCount =
      (await db.query(
        "SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'active'"
      )).rows[0]?.count || 0;

    const rejectedCount =
      (await db.query(
        "SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'rejected'"
      )).rows[0]?.count || 0;

    const pendingLoanApproval =
      (await db.query(
        "SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'pending'"
      )).rows[0]?.count || 0;

    const pendingDisbursement =
      (await db.query(
        `
        SELECT COUNT(*)::int AS count FROM loans
        WHERE LOWER(status) IN (
          'approved',
          'approved_pending_disburse',
          'approved_pending_disbursement',
          'approved_for_disbursement'
        )
        `
      )).rows[0]?.count || 0;

    // Total disbursed amount
    const totalDisbursedLoan =
      (await db.query(
        `
        SELECT COALESCE(SUM(COALESCE(disbursed_amount, amount_requested, 0)), 0) AS total
        FROM loans
        WHERE disbursed_at IS NOT NULL
      `
      )).rows[0]?.total || 0;

    // ===============================================================
    // 2) LOAN STATUS DISTRIBUTION (Paid / Unpaid / Overdue)
    // ===============================================================
    const loanDist = (
      await db.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(status) = 'paid' THEN COALESCE(disbursed_amount, amount_requested, 0) END), 0) AS paid_amount,
          COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN remaining_balance END), 0) AS unpaid_amount,
          COALESCE(SUM(CASE WHEN LOWER(status) = 'overdue' THEN remaining_balance END), 0) AS overdue_amount
        FROM loans
      `
      )
    ).rows[0] || {
      paid_amount: 0,
      unpaid_amount: 0,
      overdue_amount: 0,
    };

    const paidAmount = num(loanDist.paid_amount);
    const unpaidAmount = num(loanDist.unpaid_amount);
    const overdueAmount = num(loanDist.overdue_amount);

    // ===============================================================
    // 3) "PAYMENT OVERVIEW (Last 4 Weeks)" → expected & actual
    // ===============================================================

    // Actual loan payments in 4 weekly windows using created_at timestamp
    const payments4 = (
      await db.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount END), 0) AS week1,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '7 days'
                                AND created_at >= NOW() - INTERVAL '14 days' THEN amount END), 0) AS week2,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '14 days'
                                AND created_at >= NOW() - INTERVAL '21 days' THEN amount END), 0) AS week3,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '21 days'
                                AND created_at >= NOW() - INTERVAL '28 days' THEN amount END), 0) AS week4
        FROM transactions
        WHERE type IN ('loan_payment','repayment')
        `
      )
    ).rows[0];

    const actual4 = [
      num(payments4.week1),
      num(payments4.week2),
      num(payments4.week3),
      num(payments4.week4),
    ];

    // Expected amounts (based on repayment_schedule: due_date)
    const expected4 = (
      await db.query(
        `
        SELECT
          COALESCE(SUM(CASE WHEN due_date >= NOW() - INTERVAL '7 days' THEN expected_amount END), 0) AS week1,
          COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '7 days'
                                AND due_date >= NOW() - INTERVAL '14 days' THEN expected_amount END), 0) AS week2,
          COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '14 days'
                                AND due_date >= NOW() - INTERVAL '21 days' THEN expected_amount END), 0) AS week3,
          COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '21 days'
                                AND due_date >= NOW() - INTERVAL '28 days' THEN expected_amount END), 0) AS week4
        FROM repayment_schedule
        `
      )
    ).rows[0];

    const expected4Arr = [
      num(expected4.week1),
      num(expected4.week2),
      num(expected4.week3),
      num(expected4.week4),
    ];

    const paymentOverview4 = {
      labels: ["W1", "W2", "W3", "W4"],
      expected: expected4Arr,
      actual: actual4,
    };

    // ===============================================================
    // 4) WEEKLY COLLECTIONS (Last 7 days)
    // ===============================================================
    const weeklyRows = (
      await db.query(
        `
        SELECT 
          to_char(d, 'Dy') AS label,
          COALESCE((
            SELECT SUM(amount) FROM transactions t
            WHERE t.type IN ('loan_payment','repayment')
              AND t.created_at::date = d
          ),0) AS total
        FROM generate_series(
          current_date - INTERVAL '6 days',
          current_date,
          INTERVAL '1 day'
        ) d
        ORDER BY d;
      `
      )
    ).rows;

    const weeklyCollections = {
      labels: weeklyRows.map((r) => r.label),
      values: weeklyRows.map((r) => num(r.total)),
    };

    // ===============================================================
    // 5) PAYMENT BEHAVIOR (On-time / Late for last 4 weeks)
    // ===============================================================
    const behavior = (
      await db.query(
        `
        WITH data AS (
          SELECT 
            t.amount,
            t.created_at AS paid_at,
            s.due_date
          FROM transactions t
          LEFT JOIN repayment_schedule s 
            ON s.loan_id = t.loan_id
          WHERE t.type IN ('loan_payment','repayment')
            AND t.created_at >= NOW() - INTERVAL '28 days'
        )
        SELECT
          CASE 
            WHEN paid_at >= NOW() - INTERVAL '7 days' THEN 1
            WHEN paid_at >= NOW() - INTERVAL '14 days' THEN 2
            WHEN paid_at >= NOW() - INTERVAL '21 days' THEN 3
            ELSE 4
          END AS week,
          SUM(CASE WHEN due_date IS NULL OR paid_at::date <= due_date::date THEN 1 ELSE 0 END) AS on_time,
          SUM(CASE WHEN due_date IS NOT NULL AND paid_at::date > due_date::date THEN 1 ELSE 0 END) AS late
        FROM data
        GROUP BY week
        ORDER BY week;
        `
      )
    ).rows;

    const weeks = [1, 2, 3, 4];
    const onTimeArr = weeks.map((w) => num(behavior.find((x) => x.week === w)?.on_time || 0));
    const lateArr = weeks.map((w) => num(behavior.find((x) => x.week === w)?.late || 0));

    const paymentBehavior = {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      onTime: onTimeArr,
      late: lateArr,
    };

    // ===============================================================
    // 6) CASHFLOW (Last 12 weeks)
    // ===============================================================
    const cashRows = (
      await db.query(
        `
        WITH weeks AS (
          SELECT generate_series(11, 0, -1) AS idx
        )
        SELECT 
          w.idx,
          (current_date - (w.idx * INTERVAL '7 days'))::date AS week_start,
          
          -- Disbursed this week
          COALESCE((
            SELECT SUM(COALESCE(disbursed_amount, amount_requested, 0))
            FROM loans
            WHERE disbursed_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date
              AND disbursed_at::date <  (current_date - (w.idx * INTERVAL '7 days'))::date
          ), 0) AS disbursed,

          -- Repaid this week
          COALESCE((
            SELECT SUM(amount)
            FROM transactions t
            WHERE t.type IN ('loan_payment','repayment')
              AND t.created_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date
              AND t.created_at::date < (current_date - (w.idx * INTERVAL '7 days'))::date
          ), 0) AS repaid

        FROM weeks w
        ORDER BY w.idx;
      `
      )
    ).rows;

    const cashflow = {
      labels: cashRows.map((_, i) => `W${i + 1}`),
      repaid: cashRows.map((r) => num(r.repaid)),
      disbursed: cashRows.map((r) => num(r.disbursed)),
    };

    // ===============================================================
    // SEND FINAL RESPONSE
    // ===============================================================
    return res.json({
      borrowerCount,
      activeLoanCount,
      rejectedCount,
      pendingLoanApproval,
      pendingDisbursement,
      totalDisbursedLoan,

      loanStatusDistribution: {
        paidAmount,
        unpaidAmount,
        overdueAmount,
      },

      paymentOverview4,
      weeklyCollections,
      paymentBehavior,
      cashflow,
    });
  } catch (err) {
    console.error("getDashboardStats ERROR:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = {
  getDashboardStats,
};
