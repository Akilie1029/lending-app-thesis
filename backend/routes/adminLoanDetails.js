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
 *  - Repayment schedule (canonical columns)
 *  - Repayment history
 *  - All loan transactions
 *
 * This route is used by ADMIN REVIEW SCREENS:
 *   - AdminLoanReviewScreen
 *   - AdminLoanDocumentsScreen
 *   - AdminLoanApprovalScreen (View Details)
 *
 * Must be 100% accurate because the frontend depends on it heavily.
 */

router.get("/loan/:loanId/details", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log("🔎 [AdminLoanDetails] Fetching details for loanId =", loanId);

  if (!loanId || typeof loanId !== "string") {
    console.warn("⚠️ AdminLoanDetails: invalid loanId", loanId);
    return res.status(400).json({ error: "Invalid loanId" });
  }

  try {
    // ============================================================
    // 1) FETCH LOAN + BORROWER INFO
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

    if (loanQ.rows.length === 0) {
      console.warn("⚠️ AdminLoanDetails: loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];
    console.log("📌 Loan found:", loan.id, "status =", loan.status);

    // ============================================================
    // 2) FETCH REPAYMENT SCHEDULE  (canonical)
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

    console.log(`📅 Schedule items found: ${scheduleQ.rows.length}`);

    // ============================================================
    // 3) FETCH REPAYMENT HISTORY
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

    console.log(`📘 Repayment history entries: ${historyQ.rows.length}`);

    // ============================================================
    // 4) FETCH TRANSACTIONS FOR THIS LOAN
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

    console.log(`💳 Transactions found: ${txQ.rows.length}`);

    // ============================================================
    // 5) BUILD PAYLOAD (structured & stable for the frontend)
    // ============================================================
    const payload = {
      loan,
      schedule: scheduleQ.rows || [],
      repayment_history: historyQ.rows || [],
      transactions: txQ.rows || [],
    };

    console.log("✅ AdminLoanDetails: returning full payload for loanId:", loanId);
    return res.json(payload);
  } catch (err) {
    console.error("❌ AdminLoanDetails ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
      hint: "Check server logs for SQL or syntax issues (adminLoanDetails.js)",
    });
  }
});

module.exports = router;
