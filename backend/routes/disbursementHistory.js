// routes/disbursementHistory.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");


// ===============================================================
//              BORROWER VIEW: My Disbursements
// ===============================================================
router.get("/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const q = await db.query(
      `
      SELECT loan_id, amount, payout_method, payout_reference, disbursed_at
      FROM disbursement_history
      WHERE user_id = $1
      ORDER BY disbursed_at DESC
      `,
      [userId]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ disbursement/my error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===============================================================
//                 ADMIN VIEW: All Disbursements
// ===============================================================
router.get("/all", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT dh.id,
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
      `
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ admin disbursement/all error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ===============================================================
//                ADMIN SEARCH BY DATE RANGE
// ===============================================================
router.get("/filter", auth, admin, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to dates required" });
    }

    const q = await db.query(
      `
      SELECT dh.*, u.full_name
      FROM disbursement_history dh
      JOIN users u ON u.id = dh.user_id
      WHERE dh.disbursed_at::date >= $1
        AND dh.disbursed_at::date <= $2
      ORDER BY dh.disbursed_at DESC
      `,
      [from, to]
    );

    res.json(q.rows);
  } catch (err) {
    console.error("❌ disbursement/filter error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
