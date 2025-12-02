// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

/**
 * Loan routes (borrower-facing)
 *
 * Endpoints:
 *  - POST /apply              -> apply for a loan (Cloudinary URLs only)
 *  - GET  /my-loans           -> fetch all loans for the authenticated user
 *  - GET  /my-latest          -> fetch latest loan for the authenticated user
 *  - GET  /my-active          -> fetch active loan for the authenticated user
 *  - GET  /:loanId            -> fetch a single loan by id (must belong to authenticated user)
 *
 * Notes:
 *  - Loan IDs are UUID strings (do NOT cast to Number)
 *  - Cloudinary URL fields are mapped to canonical DB columns:
 *      valid_id_url     -> gov_id_uri
 *      selfie_id_url    -> selfie_id_uri
 *      proof_income_url -> proof_uri
 */

// Apply for loan (Cloudinary-based payload)
router.post("/apply", auth, async (req, res) => {
  try {
    console.log("🚀 /api/loans/apply called by user:", req.user?.id || "unknown");

    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      full_name,
      date_of_birth,
      address,
      phone_number,
      employment_status,
      company_name,
      monthly_income_range,
      principal,
      days,
      purpose,
      payout_method,
      payout_details,
      // Cloudinary-only fields
      valid_id_url,
      selfie_id_url,
      proof_income_url,
    } = req.body || {};

    // Basic validation
    if (!principal || !days || !purpose) {
      return res.status(400).json({ error: "Missing loan details", details: "principal, days and purpose are required" });
    }

    // Prevent active loan duplication
    const existing = await db.query(
      "SELECT id FROM loans WHERE user_id = $1 AND LOWER(COALESCE(status,'')) = 'active' LIMIT 1",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    // Insert into DB (canonical columns)
    const loanRes = await db.query(
      `
      INSERT INTO loans (
        id, user_id, full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        principal, days, purpose,
        payout_method, payout_details,
        gov_id_uri, selfie_id_uri, proof_uri,
        status, created_at
      )
      VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, $15, $16,
        'pending', NOW()
      )
      RETURNING *
      `,
      [
        userId,
        full_name || null,
        date_of_birth || null,
        address || null,
        phone_number || null,
        employment_status || null,
        company_name || null,
        monthly_income_range || null,
        principal,
        days,
        purpose,
        payout_method || null,
        payout_details || null,
        // map cloudinary URLs into canonical DB fields
        valid_id_url || null,
        selfie_id_url || null,
        proof_income_url || null,
      ]
    );

    console.log("✅ Loan INSERT Success for user:", userId, "loanId:", loanRes.rows[0]?.id);
    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: loanRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Loan Apply Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Fetch all user loans
router.get("/my-loans", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ my-loans error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Fetch latest loan
router.get("/my-latest", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.query(
      `
      SELECT * FROM loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    res.json({ latestLoan: result.rows[0] || null });
  } catch (err) {
    console.error("❌ my-latest error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Fetch active loan
router.get("/my-active", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.query(
      `
      SELECT * FROM loans
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("❌ my-active error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// SINGLE LOAN BY ID (must belong to authenticated user)
// Note: loanId is a UUID string
router.get("/:loanId", auth, async (req, res) => {
  try {
    const loanId = req.params.loanId;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    if (!loanId) {
      return res.status(400).json({ error: "loanId required" });
    }

    const result = await db.query(
      `
      SELECT *
      FROM loans
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [loanId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Get Loan Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
