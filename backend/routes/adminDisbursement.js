// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ============================================================
//   ADMIN DISBURSEMENT: Mark loan as active + add transaction
// ============================================================

router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);
    const { payout_reference = null } = req.body;

    // 1. Fetch loan
    const q = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (q.rows.length === 0) return res.status(404).json({ error: "Loan not found" });

    const loan = q.rows[0];

    if (loan.status !== "approved") {
      return res.status(400).json({ error: "Loan must be approved before disbursement" });
    }

    const disbursedAt = new Date().toISOString();

    // 2. Record disbursement transaction
    await db.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, reference_no)
      VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)
      `,
      [
        loan.user_id,
        loan.id,
        loan.principal,
        loan.payout_method || "bank",
        payout_reference,
      ]
    );

    // 3. Insert into disbursement_history (optional but useful)
    await db.query(
      `
      INSERT INTO disbursement_history (loan_id, user_id, amount, payout_method, payout_reference, disbursed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        loan.id,
        loan.user_id,
        loan.principal,
        loan.payout_method || "bank",
        payout_reference,
        disbursedAt,
      ]
    );

    // 4. Activate loan
    const result = await db.query(
      `
      UPDATE loans
      SET status = 'active',
          disbursed_at = $1,
          remaining_balance = total_payable
      WHERE id = $2
      RETURNING *
      `,
      [disbursedAt, loanId]
    );

    const updatedLoan = result.rows[0];

    res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoan,
    });
  } catch (err) {
    console.error("❌ Disbursement error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
