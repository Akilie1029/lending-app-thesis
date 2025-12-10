// controllers/adminStatsController.js
const db = require("../db");

// Helper to safely convert DB values to number
const num = (v) => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const LOG_PREFIX = "[ADMIN_STATS]";

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
 * Added: performance, portfolio, risk sections for RadialRings:
 *  - performance: totalPayable, totalRepaid, percent
 *  - portfolio: activePrincipal, totalPrincipalLent, percent
 *  - risk: overdueAmount, activePortfolioBalance, percent
 *
 * Notes:
 *  - Uses canonical repayment_schedule columns: day_number, expected_amount, due_date, status, paid_at
 *  - All date math uses Postgres intervals (server timezone)
 *  - Includes verbose console logs for debugging
 */
async function getDashboardStats(req, res) {
  try {
    console.log(LOG_PREFIX, "getDashboardStats called by admin:", req.user?.id || "unknown");

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
      // Only count loans that are truly READY for admin disbursement.
      // Exclude intermediate states like 'approved_pending_disburse' which require borrower acceptance.
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

    console.log(LOG_PREFIX, "Counts:", { borrowerCount, activeLoanCount, rejectedCount, pendingLoanApproval, pendingDisbursement });
    console.log(LOG_PREFIX, "Total disbursed:", totalDisbursedLoan);

    // ---------------------------
    // 2) LOAN STATUS DISTRIBUTION
    // ---------------------------
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
// NEW: PERFORMANCE (Total Repaid)
// ---------------------------
console.log(LOG_PREFIX, "Calculating performance metrics...");

// authoritative repayment ledger = repayment_history.type='payment'
const totalRepaidRes = await db.query(
  `
  SELECT COALESCE(SUM(amount),0) AS total_repaid_sum
  FROM repayment_history
  WHERE LOWER(type) = 'payment'
  `
);

const totalRepaidSum = num(totalRepaidRes.rows[0]?.total_repaid_sum);

// total payable across all deployed loans
const totalPayableRes = await db.query(
  `
  SELECT COALESCE(SUM(total_payable),0) AS total_payable_sum
  FROM loans
  WHERE disbursed_at IS NOT NULL
  `
);

const totalPayableSum = num(totalPayableRes.rows[0]?.total_payable_sum);
const performancePercent =
  totalPayableSum === 0
    ? 0
    : Math.round((totalRepaidSum / totalPayableSum) * 100);

console.log(LOG_PREFIX, "Performance:", {
  totalPayableSum,
  totalRepaidSum,
  performancePercent,
});

// ---------------------------
// NEW: PORTFOLIO (Capital Deployed)
// ---------------------------
console.log(LOG_PREFIX, "Calculating portfolio metrics...");

const activePrincipalRes = await db.query(
  `
  SELECT COALESCE(SUM(
    COALESCE(approved_principal, disbursed_amount, 0)
  ),0) AS active_principal
  FROM loans
  WHERE LOWER(status) = 'active'
     OR disbursed_at IS NOT NULL
  `
);

const activePrincipal = num(activePrincipalRes.rows[0]?.active_principal);

// total principal ever deployed (sum of approved_principal for all disbursed loans)
const totalPrincipalLentRes = await db.query(
  `
  SELECT COALESCE(SUM(
    COALESCE(approved_principal, disbursed_amount, 0)
  ),0) AS total_principal_lent
  FROM loans
  WHERE disbursed_at IS NOT NULL
  `
);

const totalPrincipalLent = num(totalPrincipalLentRes.rows[0]?.total_principal_lent);

const portfolioPercent =
  totalPrincipalLent === 0
    ? 0
    : Math.round((activePrincipal / totalPrincipalLent) * 100);

console.log(LOG_PREFIX, "Portfolio:", {
  activePrincipal,
  totalPrincipalLent,
  portfolioPercent,
});

// ---------------------------
// RISK (unchanged)
// ---------------------------


    // ---------------------------
    // NEW: RISK (Overdue Amount vs Active Portfolio Balance)
    // ---------------------------
    console.log(LOG_PREFIX, "Calculating risk metrics...");
    // overdueAmount: sum of remaining_balance where status = 'overdue'
    // activePortfolioBalance: sum of remaining_balance for active + overdue (what's owed on currently live portfolio)
    const overdueAmountRes = await db.query(
      `
      SELECT COALESCE(SUM(COALESCE(remaining_balance, 0)), 0) AS overdue_amount_sum
      FROM loans
      WHERE LOWER(status) = 'overdue'
      `
    );

    const activePortfolioBalanceRes = await db.query(
      `
      SELECT COALESCE(SUM(COALESCE(remaining_balance, 0)), 0) AS active_portfolio_balance
      FROM loans
      WHERE LOWER(status) IN ('active','overdue')
      `
    );

    const overdueAmountSum = num(overdueAmountRes.rows[0]?.overdue_amount_sum);
    const activePortfolioBalance = num(activePortfolioBalanceRes.rows[0]?.active_portfolio_balance);
    const riskPercent = activePortfolioBalance === 0 ? 0 : Math.round((overdueAmountSum / activePortfolioBalance) * 100);

    console.log(LOG_PREFIX, "Risk:", { overdueAmountSum, activePortfolioBalance, riskPercent });

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

      // legacy loan status distribution (kept for backward compatibility)
      loanStatusDistribution: {
        paidAmount,
        unpaidAmount,
        overdueAmount,
      },

      // NEW: metrics for RadialRings (business-friendly)
      performance: {
        totalPayable: totalPayableSum,
        totalRepaid: totalRepaidSum,
        percent: performancePercent,
      },

      portfolio: {
        activePrincipal,
        totalPrincipal: totalPrincipalLent,
        percent: portfolioPercent,
      },

      risk: {
        overdueAmount: overdueAmountSum,
        activePortfolioBalance,
        percent: riskPercent,
      },

      paymentOverview4,
      weeklyCollections,
      paymentBehavior,
      cashflow,
    };

    console.log(LOG_PREFIX, "✅ getDashboardStats: payload prepared");
    return res.json(payload);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ getDashboardStats ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = {
  getDashboardStats,
};
