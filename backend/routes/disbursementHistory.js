// routes/disbursementHistory.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * Disbursement History Routes
 *
 * Endpoints:
 *  - GET /api/disbursement/my              (BORROWER VIEW)
 *  - GET /api/admin/disbursement/all      (ADMIN)
 *  - GET /api/admin/disbursement/filter   (ADMIN filtered view)
 *
 * Notes:
 *  - IDs are UUID strings (NO Number() casting)
 *  - Includes debug logs for each request
 *  - Output is consistent and safe for the frontend
 */

// ===============================================================
//              BORROWER VIEW: My Disbursements
// ===============================================================
router.get("/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`📦 [BORROWER] /api/disbursement/my userId=${userId}`);

    const q = await db.query(
      `
      SELECT 
        loan_id,
        amount,
        payout_method,
        payout_reference,
        disbursed_at
      FROM disbursement_history
      WHERE user_id = $1
      ORDER BY disbursed_at DESC
      LIMIT 100
      `,
      [userId]
    );

    console.log(`📄 User disbursement history rows=${q.rows.length}`);

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ disbursement/my ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// ===============================================================
//                 ADMIN VIEW: All Disbursements
// ===============================================================
router.get("/all", auth, admin, async (req, res) => {
  try {
    console.log(`📦 [ADMIN] /api/admin/disbursement/all by admin=${req.user.id}`);

    const q = await db.query(
      `
      SELECT 
        dh.id,
        dh.loan_id,
        dh.user_id,
        u.full_name,
        dh.amount,
        dh.payout_method,
        dh.payout_reference,
        dh.disbursed_at
      FROM disbursement_history dh
      JOIN users u ON u.id = dh.user_id
      ORDER BY dh.disbursed_at DESC
      LIMIT 2000
      `
    );

    console.log(`📊 Admin fetched all disbursements count=${q.rows.length}`);

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ admin disbursement/all ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// ===============================================================
//                ADMIN SEARCH BY DATE RANGE
// ===============================================================
router.get("/filter", auth, admin, async (req, res) => {
  try {
    const { from, to } = req.query;

    console.log(
      `📅 [ADMIN] disbursement/filter from=${from} to=${to} admin=${req.user.id}`
    );

    if (!from || !to) {
      console.warn("⚠️ Missing from/to parameters in disbursement/filter");
      return res.status(400).json({ error: "from and to dates are required" });
    }

    const q = await db.query(
      `
      SELECT 
        dh.id,
        dh.loan_id,
        dh.user_id,
        u.full_name,
        dh.amount,
        dh.payout_method,
        dh.payout_reference,
        dh.disbursed_at
      FROM disbursement_history dh
      JOIN users u ON u.id = dh.user_id
      WHERE dh.disbursed_at::date >= $1
        AND dh.disbursed_at::date <= $2
      ORDER BY dh.disbursed_at DESC
      `,
      [from, to]
    );

    console.log(
      `📊 Filtered disbursements count=${q.rows.length} date-range=${from}→${to}`
    );

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ disbursement/filter ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;
