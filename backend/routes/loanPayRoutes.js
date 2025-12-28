// routes/loanPayRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");

// Notifications disabled
async function pushNotification() { return; }

/**
 * Borrower Payment Flow (AUTHORITATIVE)
 */
router.post("/pay", auth, async (req, res) => {
  const userId = req.user?.id;
  const { loan_id: loanId, amount, payment_method } = req.body || {};

  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!loanId) return res.status(400).json({ error: "loan_id is required" });

  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------
    // Lock loan
    // --------------------------------------------------
    const loanQ = await client.query(
      `
      SELECT *
      FROM loans
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      FOR UPDATE
      `,
      [loanId, userId]
    );

    if (!loanQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    const approvedTotal = Number(
      loan.approved_total_payable ??
      loan.total_payable ??
      0
    );

    const remainingBefore = Number(
      loan.remaining_balance ?? approvedTotal
    );

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

    // --------------------------------------------------
    // Insert transaction
    // --------------------------------------------------
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

    // --------------------------------------------------
    // Insert repayment_history (PAYMENT)
    // --------------------------------------------------
    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (
        loan_id, user_id, amount, type, is_late_fee, created_at
      )
      VALUES ($1, $2, $3, 'payment', FALSE, NOW())
      RETURNING *
      `,
      [loanId, userId, appliedAmount]
    );

    // --------------------------------------------------
    // APPLY PAYMENT TO REPAYMENT SCHEDULE (FIXED)
    // --------------------------------------------------
    let remainingToApply = appliedAmount;

    const scheduleQ = await client.query(
      `
      SELECT id, due_date, expected_amount
      FROM repayment_schedule
      WHERE loan_id = $1
        AND status != 'paid'
      ORDER BY due_date ASC
      FOR UPDATE
      `,
      [loanId]
    );

    for (const row of scheduleQ.rows) {
      if (remainingToApply <= 0) break;

      const installmentAmount = Number(row.expected_amount);

      if (remainingToApply >= installmentAmount) {
        await client.query(
          `
          UPDATE repayment_schedule
          SET status = 'paid',
              overdue = FALSE,
              paid_at = NOW()
          WHERE id = $1
          `,
          [row.id]
        );

        remainingToApply -= installmentAmount;
      } else {
        break;
      }
    }

    // --------------------------------------------------
    // UPDATE latest_due_date
    // --------------------------------------------------
    const nextDueQ = await client.query(
      `
      SELECT MIN(due_date) AS next_due
      FROM repayment_schedule
      WHERE loan_id = $1
        AND status != 'paid'
      `,
      [loanId]
    );

    const nextDueDate = nextDueQ.rows[0]?.next_due || null;

    await client.query(
      `
      UPDATE loans
      SET latest_due_date = $1
      WHERE id = $2
      `,
      [nextDueDate, loanId]
    );

    // --------------------------------------------------
    // Recalculate remaining balance
    // --------------------------------------------------
    const newRemaining = await recalcLoanRemainingBalance(loanId, client);

    const updatedLoanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );

    await client.query("COMMIT");

    pushNotification();

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
      loan: updatedLoanRes.rows[0]
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
