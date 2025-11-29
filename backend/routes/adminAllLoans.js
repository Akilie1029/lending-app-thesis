// routes/adminAllLoans.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

// ============================================================
//  ADMIN — GET ALL LOANS (ALL STATUSES)
// ============================================================
router.get("/admin/all-loans", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT 
        l.*,
        u.full_name,
        u.email
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
    `;

    const result = await db.query(sql);

    res.json({
      count: result.rows.length,
      loans: result.rows,
    });
  } catch (err) {
    console.error("❌ /admin/all-loans error:", err);
    res.status(500).json({ error: "Failed to load loans." });
  }
});

module.exports = router;
