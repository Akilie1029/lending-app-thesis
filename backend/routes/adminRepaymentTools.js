// routes/adminRepaymentTools.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const { recalcLoanRemainingBalance } = require("../services/repaymentEngine");

/**
 * ADMIN: Repayment tools
 *
 * Endpoints:
 *  - POST /installment/:scheduleId/mark-paid
 *  - POST /installment/:scheduleId/mark-unpaid
 *  - POST /installment/:scheduleId/adjust
 *
 * Notes:
 *  - repayment_schedule uses canonical columns: id (PK), loan_id, day_number, expected_amount, due_date, status, paid_at
 *  - repayment_history has at least: id, loan_id, user_id, amount, created_at, is_late_fee (is_late_fee optional)
 *  - We do DB transactions for atomic operations.
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
    console.log(`🔧 mark-paid called for scheduleId=${scheduleId} by admin=${req.user?.id || "unknown"}`);
    await client.query("BEGIN");

    // 1) Fetch schedule item and related loan + user
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
      console.warn("⚠️ mark-paid: schedule item not found:", scheduleId);
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const schedule = sq.rows[0];
    const loanId = schedule.loan_id;
    const userId = schedule.user_id;
    const amount = Number(schedule.expected_amount || 0);

    if (schedule.status === "paid") {
      await client.query("ROLLBACK");
      console.log(`ℹ️ mark-paid: schedule ${scheduleId} already marked as paid.`);
      return res.json({ message: "Installment already marked as paid", scheduleId, loan_id: loanId });
    }

    // 2) Insert into repayment_history and return inserted row
    const insertRhSql = `
      INSERT INTO repayment_history (loan_id, user_id, amount, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, loan_id, user_id, amount, created_at
    `;
    const rhRes = await client.query(insertRhSql, [loanId, userId, amount]);
    const repaymentRow = rhRes.rows[0];

    // 3) Update repayment_schedule: status='paid', paid_at = NOW()
    await client.query(
      `UPDATE repayment_schedule SET status = 'paid', paid_at = NOW() WHERE id = $1`,
      [scheduleId]
    );

    // 4) Recalculate remaining balance for the loan
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    console.log(`✅ mark-paid: scheduleId=${scheduleId} loanId=${loanId} amount=${amount} repayment_id=${repaymentRow.id}`);
    return res.json({
      message: "Installment marked as PAID",
      scheduleId,
      loan_id: loanId,
      repayment: repaymentRow,
      remaining_balance: remaining,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ mark-paid rollback error:", rbErr);
    }
    console.error("❌ admin mark-paid error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client (mark-paid):", releaseErr);
    }
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
    console.log(`🔧 mark-unpaid called for scheduleId=${scheduleId} by admin=${req.user?.id || "unknown"}`);
    await client.query("BEGIN");

    // Fetch schedule item
    const sq = await client.query(
      `SELECT id AS schedule_id, loan_id, expected_amount, status FROM repayment_schedule WHERE id = $1 LIMIT 1`,
      [scheduleId]
    );

    if (sq.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("⚠️ mark-unpaid: schedule not found:", scheduleId);
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const schedule = sq.rows[0];
    const loanId = schedule.loan_id;
    const expectedAmount = Number(schedule.expected_amount || 0);

    // Delete the most recent repayment_history matching loan_id + amount
    // We use a CTE to ensure we delete a single targeted row (the latest one)
    const deleteSql = `
      WITH to_delete AS (
        SELECT id FROM repayment_history
        WHERE loan_id = $1 AND amount = $2
        ORDER BY created_at DESC
        LIMIT 1
      )
      DELETE FROM repayment_history WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    `;
    const delRes = await client.query(deleteSql, [loanId, expectedAmount]);
    const deletedRhId = delRes.rows[0]?.id || null;

    // Reset schedule entry: status -> 'pending', paid_at -> NULL
    await client.query(
      `UPDATE repayment_schedule SET status = 'pending', paid_at = NULL WHERE id = $1`,
      [scheduleId]
    );

    // Recalc remaining balance
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    console.log(`✅ mark-unpaid: scheduleId=${scheduleId} loanId=${loanId} deleted_repayment_id=${deletedRhId}`);
    return res.json({
      message: "Installment marked as UNPAID",
      scheduleId,
      loan_id: loanId,
      deleted_repayment_id: deletedRhId,
      remaining_balance: remaining,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ mark-unpaid rollback error:", rbErr);
    }
    console.error("❌ admin mark-unpaid error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client (mark-unpaid):", releaseErr);
    }
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
    console.log(`🔧 adjust called for scheduleId=${scheduleId} new_amount=${new_amount} by admin=${req.user?.id || "unknown"}`);

    // Update the expected_amount
    const upd = await db.query(
      `UPDATE repayment_schedule SET expected_amount = $1 WHERE id = $2 RETURNING id, loan_id, expected_amount`,
      [new_amount, scheduleId]
    );

    if (upd.rows.length === 0) {
      console.warn("⚠️ adjust: schedule not found:", scheduleId);
      return res.status(404).json({ error: "Schedule item not found" });
    }

    const updated = upd.rows[0];

    // Recalculate remaining balance for the loan
    const remaining = await recalcLoanRemainingBalance(updated.loan_id);

    console.log(`✅ adjust: scheduleId=${scheduleId} updated_expected_amount=${updated.expected_amount}`);
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
