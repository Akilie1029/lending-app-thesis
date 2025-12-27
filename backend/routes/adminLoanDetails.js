// routes/adminLoanDetails.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * FULL ADMIN LOAN DETAILS
 *
 * Returns:
 *  - Loan info (joined with user info)
 *  - Repayment schedule
 *  - Repayment history
 *  - Transactions
 *  - Late fee transparency (AUTHORITATIVE)
 */

router.get("/loan/:loanId/details", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log("🔎 [AdminLoanDetails] Fetching details for loanId =", loanId);

  if (!loanId || typeof loanId !== "string") {
    return res.status(400).json({ error: "Invalid loanId" });
  }

  try {
    // ============================================================
    // 1) LOAN + USER
    // ============================================================
    const loanQ = await db.query(
      `
      SELECT 
        l.*,
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

    if (!loanQ.rows.length) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // ============================================================
    // 2) REPAYMENT SCHEDULE
    // ============================================================
    const scheduleQ = await db.query(
      `
      SELECT 
        id,
        loan_id,
        day_number,
        expected_amount,
        due_date,
        status,
        paid_at
      FROM repayment_schedule
      WHERE loan_id = $1
      ORDER BY day_number ASC
      `,
      [loanId]
    );

    // ============================================================
    // 3) REPAYMENT HISTORY
    // ============================================================
    const historyQ = await db.query(
      `
      SELECT 
        id,
        loan_id,
        user_id,
        amount,
        is_late_fee,
        created_at
      FROM repayment_history
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    // ============================================================
    // 4) TRANSACTIONS
    // ============================================================
    const txQ = await db.query(
      `
      SELECT 
        id,
        type,
        amount,
        payment_method,
        reference_no,
        created_at
      FROM transactions
      WHERE loan_id = $1
      ORDER BY created_at DESC
      `,
      [loanId]
    );

    // ============================================================
    // 5) LATE FEE TRANSPARENCY (AUTHORITATIVE)
    // ============================================================
    const lateFeeEntries = historyQ.rows.filter(h => h.is_late_fee === true);
    const totalLateFees = lateFeeEntries.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    // ============================================================
    // 6) PAYLOAD
    // ============================================================
    return res.json({
      loan,
      schedule: scheduleQ.rows || [],
      repayment_history: historyQ.rows || [],
      transactions: txQ.rows || [],
      late_fees: {
        total: totalLateFees,
        entries: lateFeeEntries.map(e => ({
          id: e.id,
          amount: Number(e.amount),
          created_at: e.created_at,
        })),
      },
    });

  } catch (err) {
    console.error("❌ AdminLoanDetails ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;
