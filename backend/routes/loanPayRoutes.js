// routes/loanPayRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

// ================================================================
//        BORROWER PAYS FOR LOAN
// ================================================================
router.post("/pay", auth, async (req, res) => {
  try {
    const { loan_id, amount, payment_method } = req.body;
    const userId = req.user.id;

    if (!loan_id || !amount) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // ============================================================
    // 0. VERIFY LOAN
    // ============================================================
    const loanRes = await db.query(
      `
      SELECT *
      FROM loans
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [loan_id, userId]
    );

    if (loanRes.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanRes.rows[0];
    const remaining = Number(loan.remaining_balance || loan.total_payable);

    if (remaining <= 0) {
      return res.json({
        message: "Loan already fully paid",
        loan,
        remaining_balance: 0
      });
    }

    // ============================================================
    // 1. INSERT TRANSACTION RECORD
    // ============================================================
    const txRes = await db.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method)
      VALUES ($1, $2, 'loan_payment', $3, $4)
      RETURNING id, loan_id, amount, payment_method, created_at
      `,
      [userId, loan_id, amount, payment_method || "cash"]
    );

    const transaction = txRes.rows[0];

    // ============================================================
    // 2. INSERT REPAYMENT HISTORY
    // ============================================================
    const rhRes = await db.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount)
      VALUES ($1, $2, $3)
      RETURNING id, amount, created_at
      `,
      [loan_id, userId, amount]
    );

    const repayment = rhRes.rows[0];

    // ============================================================
    // 3. UPDATE LOAN
    // ============================================================
    const newRemaining = Math.max(remaining - amount, 0);

    const updateRes = await db.query(
      `
      UPDATE loans
      SET remaining_balance = $1,
          status = CASE 
            WHEN $1 <= 0 THEN 'completed'
            ELSE status
          END
      WHERE id = $2
      RETURNING *
      `,
      [newRemaining, loan_id]
    );

    const updatedLoan = updateRes.rows[0];

    // ============================================================
    // 4. SEND COMPLETE RECEIPT DATA BACK TO FRONTEND
    // ============================================================
    return res.json({
      success: true,
      message: "Payment successful",

      payment: {
        transaction_id: transaction.id,
        repayment_id: repayment.id,
        loan_id: transaction.loan_id,
        amount_paid: transaction.amount,
        payment_method: transaction.payment_method,
        paid_at: transaction.created_at,
      },

      remaining_balance: newRemaining,
      loan: updatedLoan,
    });

  } catch (err) {
    console.error("❌ Payment Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
