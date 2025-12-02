// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN DISBURSEMENT WORKFLOW
 *
 * 1. /disburse/pending  → list approved loans
 * 2. /disburse/:loanId  → activate & record transaction
 */

// ------------------------------------------------------
// NEW: List all loans waiting for disbursement
// ------------------------------------------------------
router.get("/disburse/pending", auth, admin, async (req, res) => {
  try {
    console.log("📡 Fetching pending disbursements...");

    const q = await db.query(
      `
      SELECT 
        id, user_id, full_name, principal, total_payable,
        daily_payment, payout_method, payout_details,
        created_at, approved_at
      FROM loans
      WHERE status = 'approved'
      ORDER BY approved_at ASC
      `
    );

    console.log(`📦 Found ${q.rows.length} loans pending disbursement`);
    return res.json({ loans: q.rows });
  } catch (err) {
    console.error("❌ Pending disbursement fetch error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------
// POST /disburse/:loanId → Convert approved → active
// ------------------------------------------------------
router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  console.log("💼 /api/admin/disburse called…");

  const loanId = req.params.loanId;
  const { payout_reference = null } = req.body;

  if (!loanId) return res.status(400).json({ error: "loanId is required" });

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    console.log(`🔍 Fetching loan for disbursement loanId=${loanId}`);

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Loan must be approved before disbursement",
        current_status: loan.status,
      });
    }

    const userId = loan.user_id;
    const principal = loan.principal;
    const payoutMethod = loan.payout_method || "bank";
    const disbursedAt = new Date().toISOString();

    console.log(`💰 Creating loan_disbursement transaction for loanId=${loanId}`);

    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, reference_no, created_at)
      VALUES ($1, $2, 'loan_disbursement', $3, $4, $5, $6)
      RETURNING id, amount, created_at
      `,
      [userId, loanId, principal, payoutMethod, payout_reference, disbursedAt]
    );

    console.log("📘 Disbursement transaction created:", txRes.rows[0]);

    const dhRes = await client.query(
      `
      INSERT INTO disbursement_history
        (loan_id, user_id, amount, payout_method, payout_reference, disbursed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, disbursed_at
      `,
      [loanId, userId, principal, payoutMethod, payout_reference, disbursedAt]
    );

    console.log("🗂 disbursement_history entry:", dhRes.rows[0]);

    const updatedLoanQ = await client.query(
      `
      UPDATE loans
      SET
        status = 'active',
        disbursed_at = $1,
        remaining_balance = total_payable
      WHERE id = $2
      RETURNING *
      `,
      [disbursedAt, loanId]
    );

    const updatedLoan = updatedLoanQ.rows[0];

    console.log(`✅ Loan activated: remaining_balance=${updatedLoan.remaining_balance}`);

    await client.query("COMMIT");

    return res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoan,
      transaction: txRes.rows[0],
      disbursement_history: dhRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Disbursement ERROR:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
