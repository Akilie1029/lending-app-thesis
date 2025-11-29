// routes/adminRepaymentTools.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const {
  recalcLoanRemainingBalance,
  markOverdueInstallments,
} = require("../services/repaymentEngine");

// ======================================================================
//   ADMIN: Mark an installment as PAID manually
// ======================================================================
router.post("/installment/:scheduleId/mark-paid", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);

    // Get schedule details
    const sq = await db.query(
      `SELECT loan_id, amount_due, installment_number FROM repayment_schedule WHERE id = $1`,
      [scheduleId]
    );
    if (sq.rows.length === 0) return res.status(404).json({ error: "Schedule item not found" });

    const schedule = sq.rows[0];

    // Insert into repayment_history
    await db.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount)
      SELECT loan_id, loans.user_id, amount_due
      FROM repayment_schedule
      JOIN loans ON loans.id = repayment_schedule.loan_id
      WHERE repayment_schedule.id = $1
      `,
      [scheduleId]
    );

    // Mark the schedule item paid
    await db.query(
      `UPDATE repayment_schedule SET paid = TRUE WHERE id = $1`,
      [scheduleId]
    );

    // Recalculate loan remaining balance
    await recalcLoanRemainingBalance(schedule.loan_id);

    res.json({
      message: "Installment marked as paid",
      installment: schedule.installment_number,
      loan_id: schedule.loan_id,
    });

  } catch (err) {
    console.error("❌ admin mark-paid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//   ADMIN: Mark installment as UNPAID
// ======================================================================
router.post("/installment/:scheduleId/mark-unpaid", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);

    // Remove repayment history entry for this installment
    await db.query(
      `
      DELETE FROM repayment_history
      WHERE id IN (
        SELECT rh.id
        FROM repayment_history rh
        JOIN repayment_schedule rs ON rs.loan_id = rh.loan_id
        WHERE rs.id = $1 AND rh.amount = rs.amount_due
      )
      `,
      [scheduleId]
    );

    // Reset schedule state
    await db.query(
      `
      UPDATE repayment_schedule
      SET paid = FALSE, overdue = FALSE
      WHERE id = $1
      `,
      [scheduleId]
    );

    // Recalculate whole loan
    const loanQ = await db.query(
      `SELECT loan_id FROM repayment_schedule WHERE id = $1`,
      [scheduleId]
    );
    const loanId = loanQ.rows[0]?.loan_id;

    if (loanId) {
      await recalcLoanRemainingBalance(loanId);
      await markOverdueInstallments(loanId);
    }

    res.json({ message: "Installment marked as unpaid", scheduleId });
  } catch (err) {
    console.error("❌ admin mark-unpaid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//   ADMIN: Override amount_due for a single installment
// ======================================================================
router.post("/installment/:scheduleId/adjust", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const { new_amount } = req.body;

    if (!new_amount || new_amount <= 0)
      return res.status(400).json({ error: "Invalid new_amount" });

    await db.query(
      `UPDATE repayment_schedule SET amount_due = $1 WHERE id = $2`,
      [new_amount, scheduleId]
    );

    // Recalculate loan
    const q = await db.query(
      `SELECT loan_id FROM repayment_schedule WHERE id = $1`,
      [scheduleId]
    );
    const loanId = q.rows[0].loan_id;

    await recalcLoanRemainingBalance(loanId);

    res.json({
      message: "Installment amount updated",
      scheduleId,
      new_amount,
    });
  } catch (err) {
    console.error("❌ admin installment adjust error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
