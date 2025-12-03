// controllers/adminStatsController.js
const db = require("../db");

// Helper to safely convert DB values to number
const num = (v) => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

/**
 * GET /api/admin/dashboard-stats
 *
 * Returns a structured payload used by the admin dashboard:
 *  - basic counts (borrowers, active loans, rejected, pending approvals, pending disbursement)
 *  - total disbursed amount
 *  - loan status distribution (paid / unpaid / overdue)
 *  - payment overview over last 4 weeks (expected vs actual)
 *  - weekly collections (last 7 days)
 *  - payment behavior (on-time vs late for each of last 4 weeks)
 *  - cashflow (last 12 weeks)
 *
 * Notes:
 *  - Uses canonical repayment_schedule columns: day_number, expected_amount, due_date, status, paid_at
 *  - All date math uses Postgres intervals (server timezone)
 *  - Includes verbose console logs for debugging
 */
async function getDashboardStats(req, res) {
  try {
    console.log("📊 getDashboardStats called by admin:", req.user?.id || "unknown");

    // ---------------------------
    // 1) BASIC COUNTS
    // ---------------------------
    const [
      borrowerCountRes,
      activeLoanCountRes,
      rejectedCountRes,
      pendingLoanApprovalRes,
      pendingDisbursementRes,
    ] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS count FROM users WHERE LOWER(role) = 'borrower'"),
      db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'active'"),
      db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'rejected'"),
      db.query("SELECT COUNT(*)::int AS count FROM loans WHERE LOWER(status) = 'pending'"),
      // >>> FIX: Only count loans that are truly READY for admin disbursement.
      // We exclude intermediate states like 'approved_pending_disburse' which require borrower acceptance.
      db.query(
        `
        SELECT COUNT(*)::int AS count FROM loans
        WHERE LOWER(status) IN (
          'approved',
          'approved_for_disbursement' -- legacy alias (kept for backward compatibility)
        )
        `
      ),
    ]);

    const borrowerCount = Number(borrowerCountRes.rows[0]?.count || 0);
    const activeLoanCount = Number(activeLoanCountRes.rows[0]?.count || 0);
    const rejectedCount = Number(rejectedCountRes.rows[0]?.count || 0);
    const pendingLoanApproval = Number(pendingLoanApprovalRes.rows[0]?.count || 0);
    const pendingDisbursement = Number(pendingDisbursementRes.rows[0]?.count || 0);

    // Total disbursed amount
    const totalDisbursedLoanRes = await db.query(
      `
      SELECT COALESCE(SUM(COALESCE(disbursed_amount, amount_requested, total_payable, 0)), 0) AS total
      FROM loans
      WHERE disbursed_at IS NOT NULL
      `
    );
    const totalDisbursedLoan = num(totalDisbursedLoanRes.rows[0]?.total);

    console.log("Counts:", { borrowerCount, activeLoanCount, rejectedCount, pendingLoanApproval, pendingDisbursement });
    console.log("Total disbursed:", totalDisbursedLoan);

    // ---------------------------
    // 2) LOAN STATUS DISTRIBUTION
    // ---------------------------
    // paid_amount: sum of disbursed amounts for loans with status 'paid' (or completed)
    // unpaid_amount: sum of remaining_balance for loans with status 'active'
    // overdue_amount: sum of remaining_balance for loans with status 'overdue'
    const loanDistRes = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(status) = 'completed' THEN COALESCE(disbursed_amount, total_payable, 0) END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN COALESCE(remaining_balance, 0) END), 0) AS unpaid_amount,
        COALESCE(SUM(CASE WHEN LOWER(status) = 'overdue' THEN COALESCE(remaining_balance, 0) END), 0) AS overdue_amount
      FROM loans
      `
    );

    const paidAmount = num(loanDistRes.rows[0]?.paid_amount);
    const unpaidAmount = num(loanDistRes.rows[0]?.unpaid_amount);
    const overdueAmount = num(loanDistRes.rows[0]?.overdue_amount);

    // ---------------------------
    // 3) PAYMENT OVERVIEW (Last 4 Weeks)
    //    - actual: transactions (loan_payment / repayment) sum in 4 weekly windows
    //    - expected: repayment_schedule.expected_amount by due_date windows
    // ---------------------------
    const payments4Res = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN amount END), 0) AS week1,
        COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '7 days' AND created_at >= NOW() - INTERVAL '14 days' THEN amount END), 0) AS week2,
        COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '14 days' AND created_at >= NOW() - INTERVAL '21 days' THEN amount END), 0) AS week3,
        COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '21 days' AND created_at >= NOW() - INTERVAL '28 days' THEN amount END), 0) AS week4
      FROM transactions
      WHERE type IN ('loan_payment','repayment')
      `
    );

    const actual4 = [
      num(payments4Res.rows[0].week1),
      num(payments4Res.rows[0].week2),
      num(payments4Res.rows[0].week3),
      num(payments4Res.rows[0].week4),
    ];

    const expected4Res = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN due_date >= NOW() - INTERVAL '7 days' THEN expected_amount END), 0) AS week1,
        COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '7 days' AND due_date >= NOW() - INTERVAL '14 days' THEN expected_amount END), 0) AS week2,
        COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '14 days' AND due_date >= NOW() - INTERVAL '21 days' THEN expected_amount END), 0) AS week3,
        COALESCE(SUM(CASE WHEN due_date < NOW() - INTERVAL '21 days' AND due_date >= NOW() - INTERVAL '28 days' THEN expected_amount END), 0) AS week4
      FROM repayment_schedule
      `
    );

    const expected4 = [
      num(expected4Res.rows[0].week1),
      num(expected4Res.rows[0].week2),
      num(expected4Res.rows[0].week3),
      num(expected4Res.rows[0].week4),
    ];

    const paymentOverview4 = {
      labels: ["W1", "W2", "W3", "W4"],
      expected: expected4,
      actual: actual4,
    };

    // ---------------------------
    // 4) WEEKLY COLLECTIONS (Last 7 days)
    // ---------------------------
    const weeklyRowsRes = await db.query(
      `
      SELECT 
        to_char(d, 'Dy') AS label,
        COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.type IN ('loan_payment','repayment') AND t.created_at::date = d),0) AS total
      FROM generate_series(current_date - INTERVAL '6 days', current_date, INTERVAL '1 day') d
      ORDER BY d;
      `
    );

    const weeklyCollections = {
      labels: weeklyRowsRes.rows.map((r) => r.label),
      values: weeklyRowsRes.rows.map((r) => num(r.total)),
    };

    // ---------------------------
    // 5) PAYMENT BEHAVIOR (On-time / Late for last 4 weeks)
    //    We determine 'on-time' if paid_at <= due_date (or due_date null => on-time)
    // ---------------------------
    const behaviorRes = await db.query(
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
    );

    const weeks = [1, 2, 3, 4];
    const onTimeArr = weeks.map((w) => num(behaviorRes.rows.find((x) => x.week === w)?.on_time || 0));
    const lateArr = weeks.map((w) => num(behaviorRes.rows.find((x) => x.week === w)?.late || 0));

    const paymentBehavior = {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      onTime: onTimeArr,
      late: lateArr,
    };

    // ---------------------------
    // 6) CASHFLOW (Last 12 weeks)
    // ---------------------------
    const cashRowsRes = await db.query(
      `
      WITH weeks AS (SELECT generate_series(11, 0, -1) AS idx)
      SELECT 
        w.idx,
        (current_date - (w.idx * INTERVAL '7 days'))::date AS week_start,
        COALESCE((SELECT SUM(COALESCE(disbursed_amount, total_payable, 0)) FROM loans WHERE disbursed_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date AND disbursed_at::date <  (current_date - (w.idx * INTERVAL '7 days'))::date), 0) AS disbursed,
        COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.type IN ('loan_payment','repayment') AND t.created_at::date >= (current_date - ((w.idx + 1) * INTERVAL '7 days'))::date AND t.created_at::date < (current_date - (w.idx * INTERVAL '7 days'))::date), 0) AS repaid
      FROM weeks w
      ORDER BY w.idx;
      `
    );

    const cashflow = {
      labels: cashRowsRes.rows.map((_, i) => `W${i + 1}`),
      repaid: cashRowsRes.rows.map((r) => num(r.repaid)),
      disbursed: cashRowsRes.rows.map((r) => num(r.disbursed)),
    };

    // ---------------------------
    // FINAL RESPONSE
    // ---------------------------
    const payload = {
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
    };

    console.log("✅ getDashboardStats: payload prepared");
    return res.json(payload);
  } catch (err) {
    console.error("❌ getDashboardStats ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = {
  getDashboardStats,
};
