// routes/adminLoanDetails.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ===============================================================
//      FULL LOAN DETAILS FOR BACKOFFICE ADMIN REVIEW
// ===============================================================

router.get("/loan/:loanId/details", auth, admin, async (req, res) => {
  try {
    // FIXED — UUID must remain a string
    const loanId = req.params.loanId;

    // --------------------------
    // 1. Get loan + borrower info
    // --------------------------
    const loanQ = await db.query(
      `
      SELECT l.*,
             u.full_name AS user_full_name,
             u.email AS user_email,
             u.role AS user_role
      FROM loans l
      JOIN users u ON u.id = l.user_id
      WHERE l.id = $1
      LIMIT 1
      `,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // --------------------------
    // 2. Get repayment schedule
    // --------------------------
    const scheduleQ = await db.query(
      `
      SELECT installment_number, amount_due, paid, due_date, overdue
      FROM repayment_schedule
      WHERE loan_id = $1
      ORDER BY installment_number ASC
      `,
      [loanId]
    );

    // --------------------------
    // 3. Get repayment history
    // --------------------------
    const historyQ = await db.query(
      `
      SELECT id, amount, created_at, is_late_fee
      FROM repayment_history
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    // --------------------------
    // 4. Get loan transactions
    // --------------------------
    const txQ = await db.query(
      `
      SELECT id, type, amount, payment_method, reference_no, created_at
      FROM transactions
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    res.json({
      loan,
      schedule: scheduleQ.rows,
      repayment_history: historyQ.rows,
      transactions: txQ.rows,
    });

  } catch (err) {
    console.error("❌ Admin Loan Details Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
