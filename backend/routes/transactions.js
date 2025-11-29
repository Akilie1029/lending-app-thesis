// backend/routes/transaction.js

const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");

/**
 * ==========================================================
 * GET /api/transactions/my
 * Recent transactions (for HomeScreen)
 * ==========================================================
 *
 * Returns the latest 10 transactions for the user.
 * Includes loan_payment, late_fee, loan_disbursement, etc.
 */
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `
      SELECT id, type, amount, payment_method, created_at, loan_id
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /transactions/my:", err.message);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * ==========================================================
 * GET /api/transactions/my-payments
 * Full payment history for PaymentHistoryScreen
 * ==========================================================
 *
 * Only returns:
 * - loan_payment transactions
 * - late_fee transactions
 */
router.get("/my-payments", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `
      SELECT id, type, amount, payment_method, created_at, loan_id
      FROM transactions
      WHERE user_id = $1
      AND (type = 'loan_payment' OR type = 'late_fee')
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Payment history error:", err.message);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

/**
 * ==========================================================
 * GET /api/transactions/loan/:id
 * All transactions for one loan
 * ==========================================================
 */
router.get("/loan/:id", authMiddleware, async (req, res) => {
  try {
    const loanId = req.params.id;
    const userId = req.user.id;

    const result = await db.query(
      `
      SELECT id, type, amount, payment_method, created_at
      FROM transactions
      WHERE loan_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      `,
      [loanId, userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /transactions/loan/:id:", err.message);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

module.exports = router;
