// routes/adminRepaymentTools.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");

/**
 * ADMIN Repayment Tools
 *
 * repayment_history now requires:
 *  - type NOT NULL
 *
 * Types used:
 *  - "manual"  → admin marked installment as paid
 *  - "payment" → borrower payment (handled in loanPayRoutes)
 */

// ================================================================
//   ADMIN: Mark installment as PAID manually
// ================================================================
router.post("/installment/:scheduleId/mark-paid", auth, admin, async (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  if (!scheduleId || Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid scheduleId" });
  }

  const client = await db.connect();
  try {
    console.log(`🔧 mark-paid called for scheduleId=${scheduleId} by admin=${req.user?.id}`);
    await client.query("BEGIN");

    // 1) Fetch schedule + loan + user
    const sq = await client.query(
      `SELECT rs.id AS schedule_id, rs.loan_id, rs.expected_amount, rs.status, l.user_id
       FROM repayment_schedule rs
       JOIN loans l ON l.id = rs.loan_id
       WHERE rs.id = $1
       LIMIT 1`,
      [scheduleId]
    );

    if (sq.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const schedule = sq.rows[0];
    const loanId = schedule.loan_id;
    const userId = schedule.user_id;
    const amount = Number(schedule.expected_amount || 0);

    if (schedule.status === "paid") {
      await client.query("ROLLBACK");
      return res.json({ message: "Installment already marked as paid", scheduleId });
    }

    // 2) Insert repayment_history with type="manual"
    const insertRhSql = `
      INSERT INTO repayment_history (loan_id, user_id, amount, type, created_at)
      VALUES ($1, $2, $3, 'manual', NOW())
      RETURNING id, amount, type, created_at
    `;
    const rhRes = await client.query(insertRhSql, [loanId, userId, amount]);
    const repaymentRow = rhRes.rows[0];

    console.log("📝 repayment_history inserted →", repaymentRow);

    // 3) Update schedule entry
    await client.query(
      `UPDATE repayment_schedule SET status='paid', paid_at=NOW() WHERE id=$1`,
      [scheduleId]
    );

    // 4) Update loan balance
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    return res.json({
      message: "Installment marked as PAID",
      scheduleId,
      repayment: repaymentRow,
      remaining_balance: remaining,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ admin mark-paid error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ================================================================
//   ADMIN: Mark installment as UNPAID
// ================================================================
router.post("/installment/:scheduleId/mark-unpaid", auth, admin, async (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  if (!scheduleId || Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid scheduleId" });
  }

  const client = await db.connect();

  try {
    console.log(`🔧 mark-unpaid called for scheduleId=${scheduleId} by admin=${req.user?.id}`);
    await client.query("BEGIN");

    // Fetch schedule
    const sq = await client.query(
      `SELECT id AS schedule_id, loan_id, expected_amount, status
       FROM repayment_schedule WHERE id=$1 LIMIT 1`,
      [scheduleId]
    );

    if (sq.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const schedule = sq.rows[0];
    const loanId = schedule.loan_id;
    const amount = Number(schedule.expected_amount || 0);

    // Reverse: delete latest repayment_history for this loan + amount
    const deleteSql = `
      WITH to_delete AS (
        SELECT id FROM repayment_history
        WHERE loan_id=$1 AND amount=$2
        ORDER BY created_at DESC
        LIMIT 1
      )
      DELETE FROM repayment_history WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    `;
    const delRes = await client.query(deleteSql, [loanId, amount]);
    const deletedId = delRes.rows[0]?.id || null;

    // Reset schedule entry
    await client.query(
      `UPDATE repayment_schedule SET status='pending', paid_at=NULL WHERE id=$1`,
      [scheduleId]
    );

    // Recompute balance
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    return res.json({
      message: "Installment marked as UNPAID",
      scheduleId,
      deleted_repayment_id: deletedId,
      remaining_balance: remaining,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ admin mark-unpaid error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ================================================================
//   ADMIN: Adjust installment expected amount
// ================================================================
router.post("/installment/:scheduleId/adjust", auth, admin, async (req, res) => {
  const scheduleId = Number(req.params.scheduleId);
  const { new_amount } = req.body;

  if (!scheduleId || Number.isNaN(scheduleId)) {
    return res.status(400).json({ error: "Invalid scheduleId" });
  }
  if (new_amount == null || Number.isNaN(Number(new_amount)) || Number(new_amount) <= 0) {
    return res.status(400).json({ error: "Invalid new_amount" });
  }

  try {
    console.log(`🔧 adjust called for scheduleId=${scheduleId} new_amount=${new_amount}`);

    const upd = await db.query(
      `UPDATE repayment_schedule 
       SET expected_amount=$1 
       WHERE id=$2 
       RETURNING id, loan_id, expected_amount`,
      [new_amount, scheduleId]
    );

    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const updated = upd.rows[0];

    const remaining = await recalcLoanRemainingBalance(updated.loan_id);

    return res.json({
      message: "Installment amount updated",
      scheduleId,
      new_amount: Number(updated.expected_amount),
      remaining_balance: remaining,
    });
  } catch (err) {
    console.error("❌ admin installment adjust error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
