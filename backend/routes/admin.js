// routes/admin.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ===============================================================
//                   GET ALL USERS
// ===============================================================
router.get("/users", auth, admin, async (req, res) => {
  try {
    const rs = await db.query(
      `
      SELECT id, full_name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
      `
    );
    res.json(rs.rows);
  } catch (err) {
    console.error("❌ admin/users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//                   SEARCH USER BY EMAIL
// ===============================================================
router.get("/users/search", auth, admin, async (req, res) => {
  try {
    const q = (req.query.q || "").trim().toLowerCase();
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
    res.json(rs.rows);
  } catch (err) {
    console.error("❌ admin search users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//                   GET USER DETAILS
// ===============================================================
router.get("/user/:userId", auth, admin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const rs = await db.query(
      `SELECT id, full_name, email, role, created_at FROM users WHERE id = $1`,
      [userId]
    );

    if (rs.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(rs.rows[0]);
  } catch (err) {
    console.error("❌ admin get user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//                GET ALL LOANS OF USER
// ===============================================================
router.get("/user/:userId/loans", auth, admin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    const q = await db.query(
      `
      SELECT *
      FROM loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ admin user loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//                GET TRANSACTIONS OF USER
// ===============================================================
router.get("/user/:userId/transactions", auth, admin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);

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

    res.json(q.rows);
  } catch (err) {
    console.error("❌ admin user transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//      FORCE COMPLETE A LOAN (Admin Emergency Only)
// ===============================================================
router.post("/loan/:loanId/force-complete", auth, admin, async (req, res) => {
  try {
    const loanId = Number(req.params.loanId);

    const loanRes = await db.query(`SELECT * FROM loans WHERE id = $1`, [loanId]);
    if (loanRes.rows.length === 0)
      return res.status(404).json({ error: "Loan not found" });

    const loan = loanRes.rows[0];

    if (loan.status === "completed") {
      return res.json({ message: "Loan already completed" });
    }

    await db.query(
      `
      UPDATE loans
      SET status = 'completed',
          completed_at = $1,
          remaining_balance = 0
      WHERE id = $2
      `,
      [new Date().toISOString(), loanId]
    );

    res.json({ message: "Loan force-completed", loanId });
  } catch (err) {
    console.error("❌ admin force-complete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
