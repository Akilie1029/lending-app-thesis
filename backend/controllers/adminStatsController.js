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
      db.query(`
        SELECT COUNT(*)::int AS count
        FROM loans
        WHERE LOWER(status) IN ('approved','approved_for_disbursement')
      `),
    ]);

    const borrowerCount = num(borrowerCountRes.rows[0]?.count);
    const activeLoanCount = num(activeLoanCountRes.rows[0]?.count);
    const rejectedCount = num(rejectedCountRes.rows[0]?.count);
    const pendingLoanApproval = num(pendingLoanApprovalRes.rows[0]?.count);
    const pendingDisbursement = num(pendingDisbursementRes.rows[0]?.count);

    // ---------------------------
    // 2) TOTAL DISBURSED (legacy)
    // ---------------------------
    const totalDisbursedLoanRes = await db.query(`
      SELECT COALESCE(SUM(COALESCE(disbursed_amount, amount_requested, total_payable, 0)), 0) AS total
      FROM loans
      WHERE disbursed_at IS NOT NULL
    `);

    const totalDisbursedLoan = num(totalDisbursedLoanRes.rows[0]?.total);

    // ---------------------------
    // 3) LOAN STATUS DISTRIBUTION (LEGACY)
    // ---------------------------
    const loanDistRes = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN LOWER(status) = 'completed' THEN COALESCE(disbursed_amount, total_payable, 0) END), 0) AS paid_amount,
        COALESCE(SUM(CASE WHEN LOWER(status) = 'active' THEN COALESCE(remaining_balance, 0) END), 0) AS unpaid_amount,
        0::numeric AS overdue_amount
      FROM loans
    `);

    const paidAmount = num(loanDistRes.rows[0]?.paid_amount);
    const unpaidAmount = num(loanDistRes.rows[0]?.unpaid_amount);
    const legacyOverdueAmount = 0;

    // ---------------------------
    // 4) PERFORMANCE (lifetime)
    // ---------------------------
    const totalRepaidRes = await db.query(`
      SELECT COALESCE(SUM(amount),0) AS total_repaid
      FROM repayment_history
      WHERE LOWER(type) = 'payment'
    `);

    const totalPayableRes = await db.query(`
      SELECT COALESCE(SUM(total_payable),0) AS total_payable
      FROM loans
      WHERE disbursed_at IS NOT NULL
    `);

    const totalRepaid = num(totalRepaidRes.rows[0]?.total_repaid);
    const totalPayable = num(totalPayableRes.rows[0]?.total_payable);

    const performancePercent =
      totalPayable === 0 ? 0 : Math.round((totalRepaid / totalPayable) * 100);

    // ---------------------------
    // 5) PORTFOLIO (current)
    // ---------------------------
    const principalRes = await db.query(`
      SELECT
        COALESCE(SUM(COALESCE(approved_principal, disbursed_amount, 0)),0) AS total_principal,
        COALESCE(SUM(
          CASE WHEN LOWER(status) = 'active'
          THEN COALESCE(approved_principal, disbursed_amount, 0)
          END
        ),0) AS active_principal
      FROM loans
      WHERE disbursed_at IS NOT NULL
    `);

    const totalPrincipal = num(principalRes.rows[0]?.total_principal);
    const activePrincipal = num(principalRes.rows[0]?.active_principal);

    const portfolioPercent =
      totalPrincipal === 0 ? 0 : Math.round((activePrincipal / totalPrincipal) * 100);

    // ---------------------------
    // 6) RISK EXPOSURE (KAURta-correct)
    // ---------------------------
    const riskRes = await db.query(`
      SELECT COALESCE(SUM(l.remaining_balance), 0) AS risk_exposure
      FROM loans l
      WHERE LOWER(l.status) = 'active'
        AND EXISTS (
          SELECT 1
          FROM repayment_schedule rs
          WHERE rs.loan_id = l.id
            AND rs.overdue = TRUE
        )
    `);

    const riskExposure = num(riskRes.rows[0]?.risk_exposure);

    // ✅ Risk must be measured against ACTIVE capital only
    const riskPercent =
      activePrincipal === 0 ? 0 : Math.round((riskExposure / activePrincipal) * 100);

    // ---------------------------
    // 7) LIFETIME CAPITAL DEPLOYED
    // ---------------------------
    const lifetimeCapitalRes = await db.query(`
      SELECT COALESCE(SUM(COALESCE(approved_principal, disbursed_amount, 0)), 0) AS lifetime_capital
      FROM loans
      WHERE disbursed_at IS NOT NULL
    `);

    const lifetimeCapitalDeployed = num(
      lifetimeCapitalRes.rows[0]?.lifetime_capital
    );

    // ---------------------------
    // FINAL RESPONSE
    // ---------------------------
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
        overdueAmount: legacyOverdueAmount, // legacy, always 0
      },

      performance: {
        totalPayable,
        totalRepaid,
        percent: performancePercent,
      },

      portfolio: {
        activePrincipal,
        totalPrincipal,
        percent: portfolioPercent,
      },

      risk: {
        overdueAmount: riskExposure,
        activePortfolioBalance: activePrincipal,
        percent: riskPercent,
      },

      lifetimeCapitalDeployed,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = {
  getDashboardStats,
};
