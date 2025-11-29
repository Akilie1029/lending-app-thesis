// routes/adminManualAdjustments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const {
  recalcLoanRemainingBalance,
} = require("../services/repaymentEngine");

// ======================================================================
//  ADMIN: Adjust remaining balance manually
// ======================================================================
router.post("/loan/:loanId/set-remaining", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);
    const { new_balance } = req.body;

    if (new_balance < 0)
      return res.status(400).json({ error: "new_balance cannot be negative" });

    await db.query(
      `UPDATE loans SET remaining_balance = $1 WHERE id = $2`,
      [new_balance, loanId]
    );

    res.json({ message: "Remaining balance updated", new_balance });
  } catch (err) {
    console.error("❌ admin set-remaining error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//  ADMIN: Waive late fees for a loan
// ======================================================================
router.post("/loan/:loanId/waive-late-fees", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);

    // Delete late-fee transactions
    await db.query(
      `DELETE FROM transactions WHERE loan_id = $1 AND type = 'late_fee'`,
      [loanId]
    );

    // Remove late-fee repayment history
    await db.query(
      `DELETE FROM repayment_history WHERE loan_id = $1 AND is_late_fee = TRUE`,
      [loanId]
    );

    const remaining = await recalcLoanRemainingBalance(loanId);

    res.json({
      message: "Late fees waived",
      remaining_balance: remaining,
    });
  } catch (err) {
    console.error("❌ admin waive-late-fees error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//  ADMIN: Adjust principal (rare but important)
// ======================================================================
router.post("/loan/:loanId/set-principal", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);
    const { new_principal } = req.body;

    if (new_principal <= 0)
      return res.status(400).json({ error: "Invalid principal" });

    // Update principal
    await db.query(
      `UPDATE loans SET principal = $1 WHERE id = $2`,
      [new_principal, loanId]
    );

    res.json({ message: "Principal updated", new_principal });
  } catch (err) {
    console.error("❌ admin set-principal error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//  ADMIN: Change total payable
// ======================================================================
router.post("/loan/:loanId/set-total-payable", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);
    const { new_total } = req.body;

    if (new_total <= 0) return res.status(400).json({ error: "Invalid amount" });

    await db.query(
      `UPDATE loans SET total_payable = $1 WHERE id = $2`,
      [new_total, loanId]
    );

    await recalcLoanRemainingBalance(loanId);

    res.json({ message: "Total payable updated", new_total });
  } catch (err) {
    console.error("❌ admin set-total-payable error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ======================================================================
//  ADMIN: Modify disbursement date
// ======================================================================
router.post("/loan/:loanId/set-disbursement-date", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);
    const { disbursed_at } = req.body;

    if (!disbursed_at)
      return res.status(400).json({ error: "Missing date" });

    await db.query(
      `UPDATE loans SET disbursed_at = $1 WHERE id = $2`,
      [disbursed_at, loanId]
    );

    res.json({ message: "Disbursement date updated", disbursed_at });
  } catch (err) {
    console.error("❌ admin set-disbursement-date error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
