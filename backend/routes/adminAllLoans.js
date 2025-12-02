// routes/adminAllLoans.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — GET ALL LOANS (ALL STATUSES)
 *
 * Notes:
 * - UUID-safe (NO numeric conversion)
 * - Returns canonical fields + user info
 * - Includes debugging logs
 * - Intended for AdminAllLoansScreen
 */

router.get("/admin/all-loans", auth, admin, async (req, res) => {
  try {
    console.log("📊 [ADMIN] GET /admin/all-loans triggered by:", req.user?.id);

    const sql = `
      SELECT 
        l.id,
        l.user_id,
        u.full_name,
        u.email,

        l.principal,
        l.total_payable,
        l.remaining_balance,
        l.days,
        l.purpose,

        l.status,
        l.created_at,
        l.approved_at,
        l.disbursed_at,
        l.completed_at,
        l.rejected_at,
        l.rejection_reason,

        l.payout_method,
        l.payout_details,

        -- canonical document fields
        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri

      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 2000
    `;

    const result = await db.query(sql);

    console.log(`📌 All loans fetched successfully. Count=${result.rows.length}`);

    return res.json({
      count: result.rows.length,
      loans: result.rows,
    });
  } catch (err) {
    console.error("❌ [ADMIN] /admin/all-loans ERROR:", err);
    return res.status(500).json({
      error: "Failed to load loans",
      details: err.message,
    });
  }
});

module.exports = router;
