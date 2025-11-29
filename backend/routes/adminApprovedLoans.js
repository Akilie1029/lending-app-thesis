// routes/adminApprovedLoans.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ============================================================
//       LIST APPROVED LOANS (NOT DISBURSED YET)
// ============================================================

router.get("/approved", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT id, user_id, principal, days, total_payable, remaining_balance,
             purpose, approved_at, payout_method, status
      FROM loans
      WHERE status = 'approved'
      ORDER BY approved_at ASC
      `
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ Approved loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//          LIST ACTIVE LOANS FOR ADMIN
// ============================================================

router.get("/active", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT id, user_id, principal, total_payable, remaining_balance,
             days, purpose, disbursed_at, status
      FROM loans
      WHERE status = 'active'
      ORDER BY disbursed_at DESC
      `
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ Active loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//          LIST COMPLETED LOANS (PAID)
// ============================================================

router.get("/completed", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT id, user_id, principal, total_payable, days, completed_at,
             purpose, status
      FROM loans
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      `
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ Completed loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//          LIST REJECTED LOANS
// ============================================================

router.get("/rejected", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT id, user_id, principal, days, purpose,
             rejected_at, rejection_reason
      FROM loans
      WHERE status = 'rejected'
      ORDER BY rejected_at DESC
      `
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ Rejected loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
