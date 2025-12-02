// routes/admin.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// Controllers
const { getDashboardStats } = require("../controllers/adminStatsController");
const { getAllPayments } = require("../controllers/adminPaymentsController");

/**
 * Admin Main Routes
 *
 * This file provides:
 *  - Dashboard Stats
 *  - User Management
 *  - Search Users
 *  - Get User Details
 *  - Get User Loans
 *  - Get User Transactions
 *  - Force Complete Loan
 *
 * All IDs are UUID strings.
 * Includes debug logs for tracing backend behavior.
 */

// ===============================================================
//                     ADMIN DASHBOARD STATS
// ===============================================================
router.get("/dashboard-stats", auth, admin, async (req, res) => {
  console.log(`📊 [ADMIN] dashboard-stats requested by admin=${req.user?.id}`);
  return getDashboardStats(req, res);
});

// ===============================================================
//                     GET ALL PAYMENTS
// ===============================================================
router.get("/all-payments", auth, admin, async (req, res) => {
  console.log(`💰 [ADMIN] all-payments requested by admin=${req.user?.id}`);
  return getAllPayments(req, res);
});

// ===============================================================
//                     GET ALL USERS
// ===============================================================
router.get("/users", auth, admin, async (req, res) => {
  try {
    console.log(`👥 [ADMIN] get all users`);

    const rs = await db.query(
      `
      SELECT id, full_name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      `
    );

    return res.json(rs.rows);
  } catch (err) {
    console.error("❌ admin/users ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//                   SEARCH USER BY EMAIL
// ===============================================================
router.get("/users/search", auth, admin, async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
    console.log(`🔎 [ADMIN] search users: query="${q}"`);

    if (!q) return res.json([]);

    const rs = await db.query(
      `
      SELECT id, full_name, email, role
      FROM users
      WHERE LOWER(email) LIKE $1
      LIMIT 20
      `,
      [`%${q}%`]
    );

    return res.json(rs.rows);
  } catch (err) {
    console.error("❌ admin search users ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//                   GET USER DETAILS
// ===============================================================
router.get("/user/:userId", auth, admin, async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      console.warn("⚠️ Missing userId");
      return res.status(400).json({ error: "userId is required" });
    }

    console.log(`👤 [ADMIN] get user details userId=${userId}`);

    const rs = await db.query(
      `SELECT id, full_name, email, role, created_at FROM users WHERE id = $1`,
      [userId]
    );

    if (rs.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(rs.rows[0]);
  } catch (err) {
    console.error("❌ admin get user ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//                GET ALL LOANS OF USER
// ===============================================================
router.get("/user/:userId/loans", auth, admin, async (req, res) => {
  try {
    const userId = req.params.userId;

    console.log(`📄 [ADMIN] get loans for userId=${userId}`);

    const q = await db.query(
      `
      SELECT *
      FROM loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ admin user loans ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//                GET TRANSACTIONS OF USER
// ===============================================================
router.get("/user/:userId/transactions", auth, admin, async (req, res) => {
  try {
    const userId = req.params.userId;

    console.log(`💸 [ADMIN] get transactions for userId=${userId}`);

    const q = await db.query(
      `
      SELECT id, type, amount, loan_id, payment_method, created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [userId]
    );

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ admin user transactions ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ===============================================================
//      FORCE COMPLETE A LOAN (Admin Emergency Only)
// ===============================================================
router.post("/loan/:loanId/force-complete", auth, admin, async (req, res) => {
  try {
    const loanId = req.params.loanId;
    console.log(`⚠️ [ADMIN] force-complete loanId=${loanId}`);

    if (!loanId) return res.status(400).json({ error: "loanId is required" });

    const loanRes = await db.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
    if (loanRes.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanRes.rows[0];

    if (loan.status === "completed") {
      console.log(`ℹ️ Loan already completed loanId=${loanId}`);
      return res.json({ message: "Loan already completed" });
    }

    await db.query(
      `
      UPDATE loans
      SET status = 'completed',
          completed_at = NOW(),
          remaining_balance = 0
      WHERE id = $1
      `,
      [loanId]
    );

    console.log(`✅ Loan force-completed loanId=${loanId}`);

    return res.json({ message: "Loan force-completed", loanId });
  } catch (err) {
    console.error("❌ admin force-complete ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
