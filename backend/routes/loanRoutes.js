// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

/**
 * Loan routes (borrower-facing)
 *
 * Endpoints:
 *  - POST /apply
 *  - GET  /my-loans
 *  - GET  /my-latest
 *  - GET  /my-active
 *  - GET  /:loanId
 */

router.post("/apply", auth, async (req, res) => {
  try {
    console.log("🚀 /api/loans/apply called by user:", req.user?.id || "unknown");

    const userId = req.user?.id;
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
      valid_id_url,
      selfie_id_url,
      proof_income_url,
    } = req.body || {};

    if (!principal || !days || !purpose) {
      return res.status(400).json({
        error: "Missing loan details",
        details: "principal, days and purpose are required",
      });
    }

    // Prevent multiple active loans
    const existing = await db.query(
      "SELECT id FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1",
      [userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    // -------------------------------------------
    // Compute financial values
    // -------------------------------------------
    const interest = Number((principal * 0.20).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));
    const remaining_balance = total_payable;

    // -------------------------------------------
    // Insert loan
    // -------------------------------------------
    const loanRes = await db.query(
      `
      INSERT INTO loans (
        id, user_id, full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        principal, interest, total_payable, daily_payment, remaining_balance,
        days, purpose,
        payout_method, payout_details,
        gov_id_uri, selfie_id_uri, proof_uri,
        status, created_at
      )
      VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15,
        $16, $17,
        $18, $19, $20,
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
        interest,
        total_payable,
        daily_payment,
        remaining_balance,
        days,
        purpose,
        payout_method || null,
        payout_details || null,
        valid_id_url || null,
        selfie_id_url || null,
        proof_income_url || null,
      ]
    );

    console.log("✅ Loan INSERT Success:", loanRes.rows[0]?.id);

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: loanRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Loan Apply Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Fetch all loans for user
router.get("/my-loans", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error("❌ my-loans error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Latest loan
router.get("/my-latest", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ latestLoan: result.rows[0] || null });
  } catch (err) {
    console.error("❌ my-latest error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Active loan
router.get("/my-active", auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM loans
      WHERE user_id = $1 AND LOWER(status) = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("❌ my-active error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Single loan
router.get("/:loanId", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.loanId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Get Loan Error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
