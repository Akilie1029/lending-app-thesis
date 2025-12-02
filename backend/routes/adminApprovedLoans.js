// routes/adminApprovedLoans.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — Approved / Active / Completed / Rejected Loans endpoints
 *
 * Notes:
 * - loan IDs are UUID strings (NO Number() conversions)
 * - responses use canonical loan fields (principal, total_payable, remaining_balance, days, status, disbursed_at, approved_at, completed_at, rejected_at)
 * - includes debug logging for easier tracing
 */

// ============================================================
//       LIST APPROVED LOANS (NOT DISBURSED YET)
// ============================================================
router.get("/approved", auth, admin, async (req, res) => {
  try {
    console.log("🔍 GET /api/admin/approved called by admin:", req.user?.id || "unknown");

    const q = await db.query(
      `
      SELECT 
        id,
        user_id,
        principal,
        days,
        total_payable,
        remaining_balance,
        purpose,
        approved_at,
        payout_method,
        payout_details,
        status,
        gov_id_uri,
        selfie_id_uri,
        proof_uri,
        created_at
      FROM loans
      WHERE LOWER(status) = 'approved'
      ORDER BY approved_at ASC
      LIMIT 1000
      `
    );

    console.log(`📋 Approved loans returned: count=${q.rows.length}`);
    return res.json(q.rows);
  } catch (err) {
    console.error("❌ /admin/approved error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//          LIST ACTIVE LOANS FOR ADMIN
// ============================================================
router.get("/active", auth, admin, async (req, res) => {
  try {
    console.log("🔍 GET /api/admin/active called by admin:", req.user?.id || "unknown");

    const q = await db.query(
      `
      SELECT
        id,
        user_id,
        principal,
        total_payable,
        remaining_balance,
        days,
        purpose,
        disbursed_at,
        payout_method,
        status,
        gov_id_uri,
        selfie_id_uri,
        proof_uri,
        created_at
      FROM loans
      WHERE LOWER(status) = 'active'
      ORDER BY disbursed_at DESC
      LIMIT 1000
      `
    );

    console.log(`📋 Active loans returned: count=${q.rows.length}`);
    return res.json(q.rows);
  } catch (err) {
    console.error("❌ /admin/active error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//          LIST COMPLETED LOANS (PAID)
// ============================================================
router.get("/completed", auth, admin, async (req, res) => {
  try {
    console.log("🔍 GET /api/admin/completed called by admin:", req.user?.id || "unknown");

    const q = await db.query(
      `
      SELECT
        id,
        user_id,
        principal,
        total_payable,
        days,
        remaining_balance,
        completed_at,
        purpose,
        status,
        gov_id_uri,
        selfie_id_uri,
        proof_uri,
        created_at
      FROM loans
      WHERE LOWER(status) = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1000
      `
    );

    console.log(`📋 Completed loans returned: count=${q.rows.length}`);
    return res.json(q.rows);
  } catch (err) {
    console.error("❌ /admin/completed error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//          LIST REJECTED LOANS
// ============================================================
router.get("/rejected", auth, admin, async (req, res) => {
  try {
    console.log("🔍 GET /api/admin/rejected called by admin:", req.user?.id || "unknown");

    const q = await db.query(
      `
      SELECT
        id,
        user_id,
        principal,
        days,
        purpose,
        rejected_at,
        rejection_reason,
        status,
        gov_id_uri,
        selfie_id_uri,
        proof_uri,
        created_at
      FROM loans
      WHERE LOWER(status) = 'rejected'
      ORDER BY rejected_at DESC
      LIMIT 1000
      `
    );

    console.log(`📋 Rejected loans returned: count=${q.rows.length}`);
    return res.json(q.rows);
  } catch (err) {
    console.error("❌ /admin/rejected error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
