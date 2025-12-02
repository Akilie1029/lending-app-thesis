// routes/transaction.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");

/**
 * Transactions routes (user-facing)
 *
 * Routes:
 *  - GET /api/transactions/my           -> latest 10 transactions for authenticated user
 *  - GET /api/transactions/my-payments  -> full payment history (loan_payment, late_fee)
 *  - GET /api/transactions/loan/:id     -> all transactions for a specific loan (must belong to user)
 *
 * Notes:
 *  - All IDs are treated as UUID strings (NO Number() conversions)
 *  - Includes debug logs for easier tracing during development
 *  - Responses are consistent JSON arrays / objects
 */

// ------------------------------------------------------------------
// GET /api/transactions/my
// Recent transactions (for HomeScreen)
// ------------------------------------------------------------------
router.get("/my", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log(`📄 [TRANSACTIONS] /my called by user=${userId}`);

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

    console.log(`📊 /my returned ${result.rows.length} records for user=${userId}`);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /transactions/my:", err);
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/transactions/my-payments
// Full payment history for PaymentHistoryScreen
// Only returns loan_payment and late_fee transactions
// ------------------------------------------------------------------
router.get("/my-payments", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log(`📄 [TRANSACTIONS] /my-payments called by user=${userId}`);

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

    console.log(`📊 /my-payments returned ${result.rows.length} records for user=${userId}`);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Payment history error:", err);
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/transactions/loan/:id
// All transactions for one loan (must belong to authenticated user)
// ------------------------------------------------------------------
router.get("/loan/:id", authMiddleware, async (req, res) => {
  try {
    const loanId = req.params.id;
    const userId = req.user?.id;

    console.log(`💳 [TRANSACTIONS] /loan/${loanId} requested by user=${userId}`);

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!loanId) return res.status(400).json({ error: "Missing loan id" });

    // Verify loan belongs to user (or exists)
    const loanCheck = await db.query(
      `SELECT id, user_id FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );

    if (loanCheck.rows.length === 0) {
      console.warn(`⚠️ /transactions/loan: loan not found loanId=${loanId}`);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanCheck.rows[0];
    if (String(loan.user_id) !== String(userId)) {
      console.warn(`⚠️ /transactions/loan: user ${userId} tried to access loan ${loanId} owned by ${loan.user_id}`);
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await db.query(
      `
      SELECT id, type, amount, payment_method, reference_no, created_at
      FROM transactions
      WHERE loan_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      `,
      [loanId, userId]
    );

    console.log(`📊 /loan/${loanId} returned ${result.rows.length} transactions`);
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /transactions/loan/:id:", err);
    return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
});

module.exports = router;
