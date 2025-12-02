// routes/adminRepaymentTools.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ================================================================
//   ADMIN: Mark installment as PAID manually
// ================================================================
router.post("/installment/:scheduleId/mark-paid", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);

    // Get schedule
    const sq = await db.query(
      `SELECT loan_id, expected_amount FROM repayment_schedule WHERE id = $1`,
      [scheduleId]
    );
    if (sq.rows.length === 0)
      return res.status(404).json({ error: "Schedule item not found" });

    const schedule = sq.rows[0];

    // Insert into repayment_history
    await db.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, created_at)
      SELECT rs.loan_id, l.user_id, rs.expected_amount, NOW()
      FROM repayment_schedule rs
      JOIN loans l ON l.id = rs.loan_id
      WHERE rs.id = $1
      `,
      [scheduleId]
    );

    // Mark as paid
    await db.query(
      `UPDATE repayment_schedule SET status = 'paid', paid_at = NOW() WHERE id = $1`,
      [scheduleId]
    );

    res.json({
      message: "Installment marked as PAID",
      scheduleId,
      loan_id: schedule.loan_id,
    });

  } catch (err) {
    console.error("❌ admin mark-paid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================================================================
//   ADMIN: Mark installment as UNPAID
// ================================================================
router.post("/installment/:scheduleId/mark-unpaid", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);

    // Delete repayment history records tied to this schedule's due date
    await db.query(
      `
      DELETE FROM repayment_history
      WHERE loan_id = (
        SELECT loan_id FROM repayment_schedule WHERE id = $1
      )
      AND amount = (
        SELECT expected_amount FROM repayment_schedule WHERE id = $1
      )
      `,
      [scheduleId]
    );

    // Reset schedule entry
    await db.query(
      `
      UPDATE repayment_schedule
      SET status = 'pending', paid_at = NULL
      WHERE id = $1
      `,
      [scheduleId]
    );

    res.json({
      message: "Installment marked as UNPAID",
      scheduleId
    });

  } catch (err) {
    console.error("❌ admin mark-unpaid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================================================================
//   ADMIN: Adjust installment expected amount
// ================================================================
router.post("/installment/:scheduleId/adjust", auth, admin, async (req, res) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const { new_amount } = req.body;

    if (!new_amount || new_amount <= 0)
      return res.status(400).json({ error: "Invalid new_amount" });

    await db.query(
      `UPDATE repayment_schedule SET expected_amount = $1 WHERE id = $2`,
      [new_amount, scheduleId]
    );

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
