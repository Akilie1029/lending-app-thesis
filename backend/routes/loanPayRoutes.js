// routes/loanPayRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");

// --------------------------------------------------------
// NOTIFICATIONS DISABLED (safe no-op)
// --------------------------------------------------------
async function pushNotification() {
  return;
}

/**
 * POST /api/repayments/pay
 * Body:
 *  - loan_id (UUID string)
 *  - amount (number)
 *  - payment_method (string, optional)
 *
 * Borrower repayment flow:
 *  ✓ Insert transaction
 *  ✓ Insert repayment_history (type = 'payment')
 *  ✓ Recalculate remaining_balance
 *  ✓ Mark loan as completed if paid
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
    console.log(`🔍 Verifying loan for loanId=${loanId} user=${userId}`);

    // Validate loan ownership
    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
      [loanId, userId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("⚠️ Loan not found or unauthorized:", { loanId, userId });
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    const remainingBefore = Number(
      loan.remaining_balance != null
        ? loan.remaining_balance
        : loan.total_payable || 0
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

    const appliedAmount = Math.min(payAmount, remainingBefore);

    console.log(
      `💳 Applying payment: loan=${loanId} pay=${appliedAmount} requested=${payAmount} remaining=${remainingBefore}`
    );

    // --------------------------------------------------------
    // Insert into transactions
    // --------------------------------------------------------
    const txRes = await client.query(
      `
      INSERT INTO transactions (
        user_id, loan_id, type, amount, payment_method, created_at
      )
      VALUES (
        $1, $2, 'loan_payment', $3, $4, NOW()
      )
      RETURNING id, loan_id, amount, payment_method, created_at
      `,
      [userId, loanId, appliedAmount, payment_method || "cash"]
    );

    const transaction = txRes.rows[0];
    console.log("✅ Transaction inserted:", transaction.id);

    // --------------------------------------------------------
    // Insert into repayment_history (NEW REQUIRED FIELD → type = 'payment')
    // --------------------------------------------------------
    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (
        loan_id, user_id, amount, type, created_at
      )
      VALUES (
        $1, $2, $3, 'payment', NOW()
      )
      RETURNING id, amount, created_at, type
      `,
      [loanId, userId, appliedAmount]
    );

    const repayment = rhRes.rows[0];
    console.log("✅ Repayment history inserted:", repayment.id, "type=", repayment.type);

    // --------------------------------------------------------
    // Update loan remaining balance
    // --------------------------------------------------------
    const newRemaining = await recalcLoanRemainingBalance(loanId);

    console.log(`🔁 New remaining balance: ${newRemaining}`);

    // Fetch updated loan
    const updatedLoanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    const updatedLoan = updatedLoanRes.rows[0];

    await client.query("COMMIT");

    console.log("✅ Payment complete for loanId=", loanId);

    pushNotification(); // (no-op)

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
        type: repayment.type,
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
      console.error("❌ Error rolling back:", rbErr);
    }
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client:", releaseErr);
    }
  }
});

module.exports = router;
