// routes/adminAllLoans.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG = "[ADMIN_ALL_LOANS]";

/**
 * ADMIN — GET ALL LOANS (ALL STATUSES)
 * Fully compatible with AdminAllLoansScreen
 * Status Flow:
 *   pending
 *   approved_pending_disburse
 *   approved
 *   active
 *   completed
 *   rejected
 *   borrower_rejected
 */

router.get("/all-loans", auth, admin, async (req, res) => {
  try {
    console.log(LOG, "📡 Request by admin:", req.user?.id);

    const sql = `
      SELECT 
        l.id,
        l.user_id,
        u.full_name AS user_full_name,
        u.email,

        -- canonical display amount
        COALESCE(l.approved_principal, l.principal, 0) AS amount,

        -- full loan numbers
        l.principal,
        l.interest,
        l.total_payable,
        l.remaining_balance,
        l.days,
        l.purpose,

        -- approved fields
        l.approved_principal,
        l.approved_interest,
        l.approved_total_payable,
        l.approved_daily_payment,
        l.approved_at,

        -- borrower actions
        l.borrower_accepted_at,
        l.borrower_rejected_at,

        -- life cycle timestamps
        l.created_at,
        l.disbursed_at,
        l.completed_at,
        l.rejected_at,

        -- payout
        l.payout_method,
        l.payout_details,

        -- docs
        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri,

        -- FINAL STATUS
        l.status

      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT 2000
    `;

    const rs = await db.query(sql);

    console.log(LOG, "➡ Total loans:", rs.rows.length);

    return res.json({
      count: rs.rows.length,
      loans: rs.rows,
    });
  } catch (err) {
    console.error(LOG, "❌ ERROR:", err);
    return res.status(500).json({
      error: "Failed to load loans",
      details: err.message,
    });
  }
});

module.exports = router;
