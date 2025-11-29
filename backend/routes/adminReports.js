// routes/adminReports.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// Helper: today YYYY-MM-DD
const today = () => new Date().toISOString().slice(0, 10);

// ===============================================================
//      DAILY REPORT — Payments, disbursements, revenue
// ===============================================================
router.get("/daily", auth, admin, async (req, res) => {
  try {
    const date = req.query.date || today();

    const [payments, disbursed, latefees] = await Promise.all([
      db.query(
        `
        SELECT COALESCE(SUM(amount),0) AS total_payments
        FROM transactions
        WHERE type = 'loan_payment'
          AND created_at::date = $1
        `,
        [date]
      ),

      db.query(
        `
        SELECT COALESCE(SUM(amount),0) AS total_disbursed
        FROM transactions
        WHERE type = 'loan_disbursement'
          AND created_at::date = $1
        `,
        [date]
      ),

      db.query(
        `
        SELECT COALESCE(SUM(amount),0) AS total_late_fees
        FROM transactions
        WHERE type = 'late_fee'
          AND created_at::date = $1
        `,
        [date]
      ),
    ]);

    res.json({
      date,
      payments: Number(payments.rows[0].total_payments),
      disbursed: Number(disbursed.rows[0].total_disbursed),
      lateFees: Number(latefees.rows[0].total_late_fees),
    });
  } catch (err) {
    console.error("❌ adminReports/daily error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//      MONTHLY REPORT — Payments, interest, disbursements
// ===============================================================
router.get("/monthly", auth, admin, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const month = req.query.month || new Date().getMonth() + 1;

    const ym = `${year}-${String(month).padStart(2, "0")}`;

    const q = await db.query(
      `
      SELECT
        (SELECT COALESCE(SUM(amount),0)
           FROM transactions
           WHERE type='loan_payment'
             AND to_char(created_at, 'YYYY-MM') = $1) AS payments,

        (SELECT COALESCE(SUM(amount),0)
           FROM transactions
           WHERE type='loan_disbursement'
             AND to_char(created_at, 'YYYY-MM') = $1) AS disbursed,

        (SELECT COALESCE(SUM(amount),0)
           FROM transactions
           WHERE type='late_fee'
             AND to_char(created_at, 'YYYY-MM') = $1) AS late_fees
      `,
      [ym]
    );

    const row = q.rows[0];

    res.json({
      month: ym,
      payments: Number(row.payments),
      disbursed: Number(row.disbursed),
      late_fees: Number(row.late_fees),
    });
  } catch (err) {
    console.error("❌ adminReports/monthly error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//      INTEREST & PROFIT SUMMARY
// ===============================================================
router.get("/interest-summary", auth, admin, async (req, res) => {
  try {
    // interest = total_payable - principal for completed loans
    const q = await db.query(
      `
      SELECT
        COALESCE(SUM(total_payable - principal),0) AS total_interest
      FROM loans
      WHERE status = 'completed'
      `
    );

    res.json({ total_interest: Number(q.rows[0].total_interest) });
  } catch (err) {
    console.error("❌ adminReports/interest-summary error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//      OVERDUE LOANS SUMMARY
// ===============================================================
router.get("/overdue", auth, admin, async (req, res) => {
  try {
    const overdueQ = await db.query(
      `
      SELECT l.id, l.user_id, l.principal, l.remaining_balance,
             COUNT(rs.id) FILTER (WHERE rs.overdue = TRUE AND rs.paid = FALSE) AS overdue_days
      FROM loans l
      JOIN repayment_schedule rs ON rs.loan_id = l.id
      WHERE l.status = 'active'
      GROUP BY l.id
      `
    );

    res.json(overdueQ.rows);
  } catch (err) {
    console.error("❌ adminReports/overdue error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
