// routes/loanDashboard.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

// ---------------------------------------------
//  CLEAN DASHBOARD: home stats & quick queries
//  - /api/dashboard/summary        -> user summary (balance, active loan, recent tx)
//  - /api/dashboard/global-stats   -> admin/global stats (requires admin in frontend if needed)
// ---------------------------------------------

// User dashboard summary (Home screen)
router.get("/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Wallet balance
    const balRes = await db.query(
      `
      SELECT COALESCE(SUM(
        CASE
          WHEN LOWER(type) IN ('deposit', 'cash_deposit', 'cash deposit') THEN amount
          WHEN LOWER(type) IN ('withdrawal', 'cash_withdrawal', 'withdraw') THEN -amount
          WHEN LOWER(type) IN ('loan_disbursement', 'loan_issued') THEN amount
          WHEN LOWER(type) IN ('loan_payment', 'loan payment') THEN -amount
          WHEN LOWER(type) IN ('late_fee') THEN -amount
          ELSE 0
        END
      ), 0) AS balance
      FROM transactions
      WHERE user_id = $1
      `,
      [userId]
    );

    const balance = Number(balRes.rows[0]?.balance || 0);

    // 2) Active loan (if any)
    const activeRes = await db.query(
      `
      SELECT id, principal, total_payable, remaining_balance, days, status, disbursed_at
      FROM loans
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );
    const activeLoan = activeRes.rows[0] || null;

    // 3) Recent transactions (10)
    const txRes = await db.query(
      `
      SELECT id, type, amount, payment_method, loan_id, created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    res.json({
      balance,
      activeLoan,
      recentTransactions: txRes.rows || [],
    });
  } catch (err) {
    console.error("❌ Dashboard summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Public/global stats (useful for admin home)
router.get("/global-stats", auth, async (req, res) => {
  try {
    // basic aggregation: total users, total loans, active loans, pending loans, total disbursed
    const statsPromise = Promise.all([
      db.query(`SELECT COUNT(*) AS total_users FROM users`),
      db.query(`SELECT COUNT(*) AS total_loans FROM loans`),
      db.query(`SELECT COUNT(*) AS active_loans FROM loans WHERE status = 'active'`),
      db.query(`SELECT COUNT(*) AS pending_loans FROM loans WHERE status = 'pending'`),
      db.query(`SELECT COALESCE(SUM(amount),0) AS total_disbursed FROM transactions WHERE LOWER(type) IN ('loan_disbursement','loan_issued')`),
    ]);

    const [usersRes, loansRes, activeRes, pendingRes, disbRes] = await statsPromise;

    res.json({
      totalUsers: Number(usersRes.rows[0].total_users || 0),
      totalLoans: Number(loansRes.rows[0].total_loans || 0),
      activeLoans: Number(activeRes.rows[0].active_loans || 0),
      pendingLoans: Number(pendingRes.rows[0].pending_loans || 0),
      totalDisbursed: Number(disbRes.rows[0].total_disbursed || 0),
    });
  } catch (err) {
    console.error("❌ Global stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
