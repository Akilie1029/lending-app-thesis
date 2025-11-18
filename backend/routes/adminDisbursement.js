// backend/routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

// Normalize allowed disbursement statuses (use everywhere)
const ALLOWED_PENDING = [
  "approved",
  "approved_pending_disburse",
  "approved_pending_disbursement",
  "approved_for_disbursement"
];

// GET /api/admin/disbursements
router.get(
  "/disbursements",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const result = await db.query(
        `
        SELECT 
          l.id, l.user_id, u.full_name,
          l.amount_requested, l.purpose, l.repayment_term_months,
          l.status, l.created_at
        FROM loans l
        JOIN users u ON u.id = l.user_id
        WHERE LOWER(l.status) IN (${ALLOWED_PENDING.map((s, i) => `$${i + 1}`).join(",")})
        ORDER BY l.created_at ASC
        `,
        ALLOWED_PENDING
      );

      res.json(result.rows);
    } catch (err) {
      console.error("❌ Fetch Disbursements Error:", err.message);
      res.status(500).json({ msg: "Server Error", error: err.message });
    }
  }
);

// POST /api/admin/disburse/:loanId
router.post("/disburse/:loanId", authMiddleware, adminMiddleware, async (req, res) => {
  const loanId = req.params.loanId;

  try {
    // 1. Get loan info
    const loanRes = await db.query(
      "SELECT * FROM loans WHERE id = $1",
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      return res.status(404).json({ msg: "Loan not found" });
    }

    const loan = loanRes.rows[0];
    const status = (loan.status || "").toLowerCase();

    const allowed = [
      "approved",
      "approved_pending_disburse",
      "approved_pending_disbursement",
      "approved_for_disbursement"
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        msg: "Loan is not approved for disbursement",
        currentStatus: loan.status,
      });
    }

    const userId = loan.user_id;
    const amount = Number(loan.amount_requested) || 0;

    // 2. Insert transaction record
    await db.query(
      `INSERT INTO transactions (user_id, type, amount, loan_id, created_at)
       VALUES ($1, 'loan_disbursement', $2, $3, NOW())`,
      [userId, amount, loanId]
    );

    // 3. Update loan status → active
    const updatedLoan = await db.query(
      `UPDATE loans
       SET status = 'active', disbursed_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, amount_requested, status, disbursed_at`,
      [loanId]
    );

    return res.json({
      msg: "Loan disbursed successfully!",
      loan: updatedLoan.rows[0],
    });

  } catch (err) {
    console.error("❌ Disbursement Error:", err.message);
    return res.status(500).json({ msg: "Server Error", error: err.message });
  }
});


module.exports = router;
