// routes/adminReports.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// Helper: today YYYY-MM-DD
const today = () => new Date().toISOString().slice(0, 10);

/**
 * ADMIN REPORTS — CLEAN & CANONICAL VERSION
 *
 * Fully updated for canonical repayment_schedule structure:
 *   - day_number
 *   - expected_amount
 *   - due_date
 *   - status: 'pending' | 'paid' | 'overdue'
 *   - paid_at
 *
 * All obsolete columns (paid, overdue boolean, installment_number) removed.
 */

// ===============================================================
//      DAILY REPORT — Payments, disbursements, revenue
// ===============================================================
router.get("/daily", auth, admin, async (req, res) => {
  try {
    const date = req.query.date || today();
    console.log(`📊 DAILY REPORT for ${date}`);

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

    return res.json({
      date,
      payments: Number(payments.rows[0].total_payments),
      disbursed: Number(disbursed.rows[0].total_disbursed),
      lateFees: Number(latefees.rows[0].total_late_fees),
    });
  } catch (err) {
    console.error("❌ adminReports/daily ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
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

    console.log(`📅 MONTHLY REPORT for ${ym}`);

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

    return res.json({
      month: ym,
      payments: Number(row.payments),
      disbursed: Number(row.disbursed),
      late_fees: Number(row.late_fees),
    });
  } catch (err) {
    console.error("❌ adminReports/monthly ERROR:", err);
    return res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// ===============================================================
//      INTEREST & PROFIT SUMMARY
// ===============================================================
router.get("/interest-summary", auth, admin, async (req, res) => {
  try {
    console.log("📈 INTEREST SUMMARY");

    const q = await db.query(
      `
      SELECT
        COALESCE(SUM(total_payable - principal),0) AS total_interest
      FROM loans
      WHERE status = 'completed'
      `
    );

    return res.json({ total_interest: Number(q.rows[0].total_interest) });
  } catch (err) {
    console.error("❌ interest-summary ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//      OVERDUE LOANS SUMMARY (UPDATED FOR CANONICAL SCHEMA)
// ===============================================================
router.get("/overdue", auth, admin, async (req, res) => {
  try {
    console.log("📌 GENERATING OVERDUE LOAN SUMMARY");

    /**
     * OLD LOGIC: used columns like rs.overdue & rs.paid (deprecated)
     *
     * NEW LOGIC:
     *  Overdue installment = repayment_schedule.status = 'overdue'
     *
     * We count overdue installments PER LOAN.
     */

    const overdueQ = await db.query(
      `
      SELECT 
        l.id AS loan_id,
        l.user_id,
        l.principal,
        l.remaining_balance,

        -- Count of overdue schedule rows
        COUNT(rs.id) FILTER (WHERE rs.status = 'overdue') AS overdue_days

      FROM loans l
      JOIN repayment_schedule rs ON rs.loan_id = l.id
      WHERE l.status = 'active'
      GROUP BY l.id, l.user_id, l.principal, l.remaining_balance
      ORDER BY overdue_days DESC
      `
    );

    return res.json(overdueQ.rows);
  } catch (err) {
    console.error("❌ adminReports/overdue ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
