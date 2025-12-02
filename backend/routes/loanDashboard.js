// routes/loanDashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

/**
 * Dashboard routes:
 *
 *  - GET /api/dashboard/summary
 *      → User HomeScreen summary
 *        Includes:
 *          ✔ balance
 *          ✔ active loan
 *          ✔ latest pending loan (used for lockout)
 *          ✔ recent transactions
 *
 *  - GET /api/dashboard/global-stats
 *      → Admin-only summary (basic stats)
 *
 * Notes:
 *  - All IDs are treated as UUID strings
 *  - Includes debug logs for easier troubleshooting
 */

// ============================================================================
// USER DASHBOARD SUMMARY
// ============================================================================
router.get("/summary", auth, async (req, res) => {
  const userId = req.user?.id;

  console.log("📱 [Dashboard] /summary called by user:", userId);

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // ----------------------------------------------------------
    // 1) USER BALANCE
    // ----------------------------------------------------------
    console.log("💰 Fetching wallet balance for user:", userId);

    const balRes = await db.query(
      `
      SELECT COALESCE(SUM(
        CASE
          WHEN LOWER(type) IN ('deposit','cash_deposit','cash deposit') THEN amount
          WHEN LOWER(type) IN ('withdrawal','withdraw','cash_withdrawal') THEN -amount
          WHEN LOWER(type) IN ('loan_disbursement','loan_issued') THEN amount
          WHEN LOWER(type) IN ('loan_payment','loan payment') THEN -amount
          WHEN LOWER(type) = 'late_fee' THEN -amount
          ELSE 0
        END
      ),0) AS balance
      FROM transactions
      WHERE user_id = $1
      `,
      [userId]
    );

    const balance = Number(balRes.rows[0]?.balance || 0);
    console.log("💰 User balance:", balance);

    // ----------------------------------------------------------
    // 2) ACTIVE LOAN (if any)
    // ----------------------------------------------------------
    console.log("🔍 Checking for active loan…");

    const activeRes = await db.query(
      `
      SELECT 
        id,
        principal,
        total_payable,
        remaining_balance,
        days,
        status,
        disbursed_at,
        created_at
      FROM loans
      WHERE user_id = $1
        AND LOWER(status) = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    const activeLoan = activeRes.rows[0] || null;
    if (activeLoan) console.log("📌 Active Loan found:", activeLoan.id);
    else console.log("ℹ️ No active loan for user.");

    // ----------------------------------------------------------
    // 3) PENDING LOAN (used for lockout on HomeScreen)
    // ----------------------------------------------------------
    console.log("🔍 Checking for pending loan…");

    const pendingRes = await db.query(
      `
      SELECT id, status, created_at
      FROM loans
      WHERE user_id = $1
        AND LOWER(status) = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    const pendingLoan = pendingRes.rows[0] || null;
    if (pendingLoan) console.log("⏳ Pending loan found:", pendingLoan.id);
    else console.log("ℹ️ No pending loan.");

    // ----------------------------------------------------------
    // 4) RECENT TRANSACTIONS (latest 10)
    // ----------------------------------------------------------
    console.log("📄 Fetching recent transactions");

    const txRes = await db.query(
      `
      SELECT 
        id,
        type,
        amount,
        payment_method,
        loan_id,
        created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    const recentTransactions = txRes.rows || [];
    console.log("📄 Recent transactions count:", recentTransactions.length);

    return res.json({
      balance,
      activeLoan,
      pendingLoan,
      recentTransactions,
    });
  } catch (err) {
    console.error("❌ Dashboard summary error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// ============================================================================
// ADMIN — GLOBAL STATS (lightweight)
// ============================================================================
router.get("/global-stats", auth, async (req, res) => {
  const userId = req.user?.id;
  const role = req.user?.role?.toLowerCase();

  console.log(`🌎 [Dashboard] /global-stats by user=${userId} role=${role}`);

  try {
    // Not all admins screens require admin middleware — some only check role on frontend
    const statsPromise = Promise.all([
      db.query(`SELECT COUNT(*) AS total_users FROM users`),
      db.query(`SELECT COUNT(*) AS total_loans FROM loans`),
      db.query(`SELECT COUNT(*) AS active_loans FROM loans WHERE LOWER(status) = 'active'`),
      db.query(`SELECT COUNT(*) AS pending_loans FROM loans WHERE LOWER(status) = 'pending'`),
      db.query(
        `
        SELECT COALESCE(SUM(amount),0) AS total_disbursed
        FROM transactions 
        WHERE LOWER(type) IN ('loan_disbursement','loan_issued')
        `
      ),
    ]);

    const [u, l, a, p, d] = await statsPromise;

    const result = {
      totalUsers: Number(u.rows[0].total_users || 0),
      totalLoans: Number(l.rows[0].total_loans || 0),
      activeLoans: Number(a.rows[0].active_loans || 0),
      pendingLoans: Number(p.rows[0].pending_loans || 0),
      totalDisbursed: Number(d.rows[0].total_disbursed || 0),
    };

    console.log("🌎 Global Stats:", result);
    return res.json(result);
  } catch (err) {
    console.error("❌ Global stats error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;
