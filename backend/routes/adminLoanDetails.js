// routes/adminLoanDetails.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ===============================================================
//      FULL LOAN DETAILS FOR BACKOFFICE ADMIN REVIEW
// ===============================================================

/**
 * GET /api/admin/loan/:loanId/details
 * - loanId kept as string (UUID) — do NOT Number() it
 * - repayment_schedule query uses real table columns:
 *    id, loan_id, day_number, expected_amount, due_date, status, paid_at
 */
router.get("/loan/:loanId/details", auth, admin, async (req, res) => {
  try {
    const loanId = req.params.loanId; // KEEP AS STRING (UUID)

    console.log("🔎 AdminLoanDetails: fetching details for loanId =", loanId);

    // 1) Loan + borrower info
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
      console.warn("⚠️ AdminLoanDetails: loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // 2) Repayment schedule — using real column names (day_number, expected_amount, paid_at, status)
    const scheduleQ = await db.query(
      `
      SELECT id, loan_id, day_number, expected_amount, due_date, status, paid_at
      FROM repayment_schedule
      WHERE loan_id = $1
      ORDER BY day_number ASC
      `,
      [loanId]
    );

    // 3) Repayment history — select conservative set of columns (adjust if your schema differs)
    // If your table has extra columns (eg is_late_fee), you can add them here.
    const historyQ = await db.query(
      `
      SELECT id, loan_id, amount, created_at
      FROM repayment_history
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    // 4) Loan transactions — conservative column set (adjust if needed)
    const txQ = await db.query(
      `
      SELECT id, type, amount, payment_method, reference_no, created_at
      FROM transactions
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    // 5) Return unified response
    const payload = {
      loan,
      schedule: scheduleQ.rows,
      repayment_history: historyQ.rows,
      transactions: txQ.rows,
    };

    console.log("✅ AdminLoanDetails: returning payload for loanId:", loanId);
    return res.json(payload);
  } catch (err) {
    console.error("❌ Admin Loan Details Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
