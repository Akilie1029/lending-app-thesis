// routes/adminManualAdjustments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const {
  recalcLoanRemainingBalance,
} = require("../services/repaymentEngine");

/**
 * ADMIN — Manual Adjustments
 *
 * Endpoints:
 *  - POST /loan/:loanId/set-remaining
 *  - POST /loan/:loanId/waive-late-fees
 *  - POST /loan/:loanId/set-principal
 *  - POST /loan/:loanId/set-total-payable
 *  - POST /loan/:loanId/set-disbursement-date
 *
 * Notes:
 *  - LoanId is UUID string (NEVER Number())
 *  - All updates include strong validation & debug logs
 *  - recalcLoanRemainingBalance called when needed
 */

// ======================================================================
//  ADMIN: Adjust remaining balance manually
// ======================================================================
router.post("/loan/:loanId/set-remaining", auth, admin, async (req, res) => {
  const loanId = req.params.loanId; // UUID string
  const { new_balance } = req.body;

  console.log(`🔧 set-remaining called loanId=${loanId} new_balance=${new_balance}`);

  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  if (new_balance == null || Number.isNaN(Number(new_balance)) || Number(new_balance) < 0) {
    return res.status(400).json({ error: "new_balance must be a non-negative number" });
  }

  try {
    const client = await db.connect();
    await client.query("BEGIN");

    const loanQ = await client.query(`SELECT id FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    await client.query(
      `UPDATE loans SET remaining_balance = $1 WHERE id = $2`,
      [Number(new_balance), loanId]
    );

    await client.query("COMMIT");

    console.log(`✅ Remaining balance updated for loanId=${loanId}`);
    return res.json({ message: "Remaining balance updated", new_balance: Number(new_balance) });
  } catch (err) {
    console.error("❌ set-remaining ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ======================================================================
//  ADMIN: Waive late fees for a loan
// ======================================================================
router.post("/loan/:loanId/waive-late-fees", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log(`🔧 waive-late-fees called loanId=${loanId}`);

  if (!loanId) return res.status(400).json({ error: "loanId is required" });

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Verify loan exists
    const loanQ = await client.query(`SELECT id FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    // Remove late-fee transactions
    const txDel = await client.query(
      `DELETE FROM transactions WHERE loan_id = $1 AND type = 'late_fee'`,
      [loanId]
    );

    // Remove late-fee repayment history
    const rhDel = await client.query(
      `DELETE FROM repayment_history WHERE loan_id = $1 AND is_late_fee = TRUE`,
      [loanId]
    );

    console.log(
      `🧹 Late fees waived: tx_removed=${txDel.rowCount}, rh_removed=${rhDel.rowCount}`
    );

    // Recompute remaining balance
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    return res.json({
      message: "Late fees waived",
      remaining_balance: remaining,
      removed_transactions: txDel.rowCount,
      removed_history_records: rhDel.rowCount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ waive-late-fees ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ======================================================================
//  ADMIN: Adjust principal (rare but important)
// ======================================================================
router.post("/loan/:loanId/set-principal", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { new_principal } = req.body;

  console.log(`🔧 set-principal loanId=${loanId} new_principal=${new_principal}`);

  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  if (!new_principal || Number(new_principal) <= 0) {
    return res.status(400).json({ error: "Invalid new_principal" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT id, total_payable FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    await client.query(
      `UPDATE loans SET principal = $1 WHERE id = $2`,
      [new_principal, loanId]
    );

    console.log(`🏷 Principal updated for loanId=${loanId}`);

    // Recalculate remaining balance
    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    return res.json({
      message: "Principal updated",
      new_principal: Number(new_principal),
      remaining_balance: remaining,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ set-principal ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ======================================================================
//  ADMIN: Change total payable
// ======================================================================
router.post("/loan/:loanId/set-total-payable", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { new_total } = req.body;

  console.log(`🔧 set-total-payable loanId=${loanId} new_total=${new_total}`);

  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  if (!new_total || Number(new_total) <= 0) {
    return res.status(400).json({ error: "Invalid total payable amount" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT id FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    await client.query(
      `UPDATE loans SET total_payable = $1 WHERE id = $2`,
      [new_total, loanId]
    );

    console.log(`💷 Total payable updated for loanId=${loanId}`);

    const remaining = await recalcLoanRemainingBalance(loanId);

    await client.query("COMMIT");

    return res.json({
      message: "Total payable updated",
      new_total: Number(new_total),
      remaining_balance: remaining,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ set-total-payable ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ======================================================================
//  ADMIN: Modify disbursement date
// ======================================================================
router.post("/loan/:loanId/set-disbursement-date", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { disbursed_at } = req.body;

  console.log(`🔧 set-disbursement-date loanId=${loanId} disbursed_at=${disbursed_at}`);

  if (!loanId) return res.status(400).json({ error: "loanId is required" });
  if (!disbursed_at) {
    return res.status(400).json({ error: "Missing disbursed_at date" });
  }

  try {
    const result = await db.query(
      `UPDATE loans SET disbursed_at = $1 WHERE id = $2 RETURNING id, disbursed_at`,
      [disbursed_at, loanId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    console.log(`📅 Disbursement date updated for loanId=${loanId}`);

    return res.json({
      message: "Disbursement date updated",
      disbursed_at,
    });
  } catch (err) {
    console.error("❌ set-disbursement-date ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
