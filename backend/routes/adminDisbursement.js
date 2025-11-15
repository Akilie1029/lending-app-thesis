const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

// AUTO DISBURSE LOAN
router.post("/disburse/:loanId", authMiddleware, adminMiddleware, async (req, res) => {
  const loanId = req.params.loanId;

  try {
    // 1. Get loan
    const loanRes = await db.query(
      "SELECT * FROM loans WHERE id = $1",
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      return res.status(404).json({ msg: "Loan not found" });
    }

    const loan = loanRes.rows[0];

    // 2. Validate state
    if (loan.status !== "approved") {
      return res.status(400).json({ msg: "Loan is not approved for disbursement" });
    }

    const userId = loan.user_id;

    // 3. Credit balance
    await db.query(
      `INSERT INTO transactions (user_id, type, amount, loan_id)
       VALUES ($1, 'loan_disbursement', $2, $3)`,
      [userId, loan.amount_requested, loanId]
    );

    // 4. Activate loan
    await db.query(
      "UPDATE loans SET status = 'active' WHERE id = $1",
      [loanId]
    );

    res.json({ msg: "Loan disbursed successfully!" });

  } catch (err) {
    console.error("❌ Disbursement Error:", err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
