// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN DISBURSEMENT
 *
 * Converts a loan from "approved" -> "active"
 * Adds:
 *   - Loan disbursement transaction
 *   - disbursement_history entry
 * Updates:
 *   - loans.disbursed_at
 *   - loans.remaining_balance = total_payable
 *
 * MUST treat loanId as UUID (string) — NO Number()!!
 */

router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  console.log("💼 /api/admin/disburse called…");

  const loanId = req.params.loanId; // keep as UUID string
  const { payout_reference = null } = req.body;

  if (!loanId) {
    return res.status(400).json({ error: "loanId is required" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    console.log(`🔍 Fetching loan for disbursement loanId=${loanId}`);

    // 1. Fetch loan (FOR UPDATE to prevent race conditions)
    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn(`⚠️ Loan not found for disburse: ${loanId}`);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Only allow disbursement if loan is strictly "approved"
    if ((loan.status || "").toLowerCase() !== "approved") {
      await client.query("ROLLBACK");
      console.warn(`⚠️ Loan ${loanId} is not approved. Current status = ${loan.status}`);
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

    // 2. Create disbursement transaction
    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, reference_no, created_at)
      VALUES ($1, $2, 'loan_disbursement', $3, $4, $5, $6)
      RETURNING id, amount, created_at
      `,
      [userId, loanId, principal, payoutMethod, payout_reference, disbursedAt]
    );

    console.log("📘 Disbursement transaction created:", txRes.rows[0]);

    // 3. Insert into disbursement_history
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

    // 4. Update loan: active + set remaining_balance = total_payable
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

    console.log(`✅ Loan ${loanId} activated. remaining_balance=${updatedLoan.remaining_balance}`);

    await client.query("COMMIT");

    return res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoan,
      transaction: txRes.rows[0],
      disbursement_history: dhRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Disbursement ERROR:", err);

    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("❌ ROLLBACK ERROR:", rollbackErr);
    }

    return res.status(500).json({
      error: "Server error",
      details: err.message,
      hint: "See backend logs for more details (adminDisbursement.js)",
    });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client in disbursement:", releaseErr);
    }
  }
});

module.exports = router;
