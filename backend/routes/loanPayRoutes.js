// routes/loanPayRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");
const axios = require("axios");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5001";

/**
 * POST /api/repayments/pay
 * Body:
 *  - loan_id (UUID string)
 *  - amount (number)
 *  - payment_method (string, optional)
 *
 * Behavior:
 *  - Validates loan exists and belongs to authenticated user
 *  - Prevents double-payments on completed loans
 *  - Inserts transaction and repayment_history inside a DB transaction
 *  - Updates loans.remaining_balance and status (completed if remaining <= 0)
 *  - Sends notifications:
 *      • loan_payment
 *      • loan_completed (if remaining <= 0)
 */

router.post("/pay", auth, async (req, res) => {
  const userId = req.user?.id;

  console.log("🔔 /api/repayments/pay called by user:", userId);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { loan_id: loanId, amount, payment_method } = req.body || {};

  // Basic validation
  if (!loanId) {
    return res.status(400).json({ error: "loan_id is required" });
  }
  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const payAmount = Number(amount);

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    console.log(`🔍 Verifying loan ownership and status for loanId=${loanId} user=${userId}`);

    // Verify loan exists and belongs to the user
    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
      [loanId, userId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("⚠️ Loan not found or not owned by user:", { loanId, userId });
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Determine remaining balance
    const remainingBefore = Number(
      loan.remaining_balance != null ? loan.remaining_balance : loan.total_payable || 0
    );

    if (remainingBefore <= 0) {
      await client.query("ROLLBACK");
      console.log("ℹ️ Loan already fully paid:", loanId);
      return res.json({
        success: true,
        message: "Loan already fully paid",
        remaining_balance: 0,
        loan,
      });
    }

    // If payment amount is greater than remaining, allow but cap
    const appliedAmount = Math.min(payAmount, remainingBefore);

    console.log(
      `💳 Applying payment: loanId=${loanId} amount=${appliedAmount} (requested=${payAmount}) remainingBefore=${remainingBefore}`
    );

    // 1) Insert transaction
    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1, $2, 'loan_payment', $3, $4, NOW())
      RETURNING id, loan_id, amount, payment_method, created_at
      `,
      [userId, loanId, appliedAmount, payment_method || "cash"]
    );

    const transaction = txRes.rows[0];
    console.log("✅ Transaction inserted:", transaction.id);

    // 2) Insert repayment_history
    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, amount, created_at
      `,
      [loanId, userId, appliedAmount]
    );

    const repayment = rhRes.rows[0];
    console.log("✅ Repayment history inserted:", repayment.id);

    // 3) Recalculate remaining
    const newRemaining = await recalcLoanRemainingBalance(loanId);

    console.log(`🔁 Remaining balance recalculated: ${newRemaining} (loanId=${loanId})`);

    // 4) Fetch updated loan row
    const updatedLoanRes = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    const updatedLoan = updatedLoanRes.rows[0];

    await client.query("COMMIT");

    console.log("✅ Payment flow COMMIT complete for loanId=", loanId);

    // ------------------------------------------------------------------
    // 🔔 NOTIFICATION #1 — Payment Successful
    // ------------------------------------------------------------------
    try {
      await axios.post(`${BASE_URL}/api/notifications/push`, {
        user_id: userId,
        loan_id: loanId,
        type: "loan_payment",
        title: "Payment Received",
        message: `Your payment of ₱${appliedAmount.toLocaleString()} has been posted.`,
      });
    } catch (err) {
      console.error("❌ Payment notification failed:", err);
    }

    // ------------------------------------------------------------------
    // 🔔 NOTIFICATION #2 — Loan Fully Paid (if remaining <= 0)
    // ------------------------------------------------------------------
    if (newRemaining <= 0) {
      try {
        await axios.post(`${BASE_URL}/api/notifications/push`, {
          user_id: userId,
          loan_id: loanId,
          type: "loan_completed",
          title: "Loan Completed",
          message: "Congratulations! Your loan is now fully paid.",
        });
      } catch (err) {
        console.error("❌ Loan completed notification failed:", err);
      }
    }

    return res.json({
      success: true,
      message: "Payment successful",
      payment: {
        transaction_id: transaction.id,
        repayment_id: repayment.id,
        loan_id: transaction.loan_id,
        amount_paid: Number(transaction.amount),
        payment_method: transaction.payment_method,
        paid_at: transaction.created_at,
        requested_amount: payAmount,
        applied_amount: appliedAmount,
      },
      remaining_balance: newRemaining,
      loan: updatedLoan,
    });
  } catch (err) {
    console.error("❌ Payment Error:", err);
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ Error rolling back payment transaction:", rbErr);
    }
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client after payment:", releaseErr);
    }
  }
});

module.exports = router;
