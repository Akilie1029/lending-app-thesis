// backend/routes/adminApprovedLoans.js

const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

// GET all approved loans (waiting for disbursement)
router.get("/approved-loans", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        loans.id,
        loans.user_id,
        loans.amount_requested,
        loans.purpose,
        loans.created_at,
        users.full_name
      FROM loans
      JOIN users ON users.id = loans.user_id
      WHERE loans.status = 'approved'
      ORDER BY loans.created_at ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Approved Loans Error:", err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
