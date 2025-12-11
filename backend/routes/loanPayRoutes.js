// routes/loanPayRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");

// Notifications disabled
async function pushNotification() { return; }

/**
 * Borrower Payment Flow
 *  ✓ Validate ownership
 *  ✓ Determine correct approved totals
 *  ✓ Insert transaction
 *  ✓ Insert repayment_history
 *  ✓ Recalculate remaining balance using SAME client
 *  ✓ Return updated loan
 */
router.post("/pay", auth, async (req, res) => {
  const userId = req.user?.id;
  const { loan_id: loanId, amount, payment_method } = req.body || {};

  console.log("🔔 /api/repayments/pay by:", userId);

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!loanId) return res.status(400).json({ error: "loan_id is required" });

  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0)
    return res.status(400).json({ error: "Invalid amount" });

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    console.log("🔍 Locking loan:", loanId);

    // Fetch loan WITH approved_* values
    const loanQ = await client.query(
      `SELECT *
       FROM loans
       WHERE id = $1 AND user_id = $2
       LIMIT 1
       FOR UPDATE`,
      [loanId, userId]
    );

    if (!loanQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Choose correct totals
    const approvedTotal = Number(
      loan.approved_total_payable ??
      loan.total_payable ??
      0
    );

    const remainingBefore = Number(
      loan.remaining_balance ?? approvedTotal
    );

    console.log("💰 Loan approved_total:", approvedTotal);
    console.log("💰 Remaining before payment:", remainingBefore);

    if (remainingBefore <= 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: true,
        message: "Loan already fully paid",
        remaining_balance: 0,
        loan
      });
    }

    const appliedAmount = Math.min(payAmount, remainingBefore);
    console.log(`💳 Applying ${appliedAmount} to loan ${loanId}`);

    // ---------------------------------------------------------
    // Insert into transactions
    // ---------------------------------------------------------
    const txRes = await client.query(
      `
      INSERT INTO transactions (
        user_id, loan_id, type, amount, payment_method, created_at
      )
      VALUES ($1, $2, 'loan_payment', $3, $4, NOW())
      RETURNING *
      `,
      [userId, loanId, appliedAmount, payment_method || "cash"]
    );

    // ---------------------------------------------------------
    // Insert repayment_history
    // ---------------------------------------------------------
    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (
        loan_id, user_id, amount, type, created_at
      )
      VALUES ($1, $2, $3, 'payment', NOW())
      RETURNING *
      `,
      [loanId, userId, appliedAmount]
    );

    // ---------------------------------------------------------
    // Recalculate using SAME client
    // ---------------------------------------------------------
    const newRemaining = await recalcLoanRemainingBalance(loanId, client);

    console.log("🔁 New remaining after payment:", newRemaining);

    // Fetch updated loan
    const updatedLoanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );

    const updatedLoan = updatedLoanRes.rows[0];

    await client.query("COMMIT");

    pushNotification(); // (no-op)

    return res.json({
      success: true,
      message: "Payment successful",
      payment: {
        transaction_id: txRes.rows[0].id,
        repayment_id: rhRes.rows[0].id,
        loan_id: loanId,
        amount_paid: appliedAmount,
        requested_amount: payAmount,
        payment_method: payment_method,
        paid_at: txRes.rows[0].created_at,
        type: "payment"
      },
      remaining_balance: newRemaining,
      loan: updatedLoan
    });

  } catch (err) {
    console.error("❌ Payment Error:", err);

    try { await client.query("ROLLBACK"); } catch {}

    return res.status(500).json({
      error: "Server error",
      details: err.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
