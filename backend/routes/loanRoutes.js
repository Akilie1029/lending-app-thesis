// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

const INTEREST_RATE = 0.20;

// ============================================================
//  APPLY FOR LOAN (Backend computes interest & payments)
// ============================================================
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
      payout_details, // object
      valid_id_url,
      selfie_id_url,
      proof_income_url,
    } = req.body || {};

    // -------------------- BASIC VALIDATION --------------------
    if (!principal || !days || !purpose) {
      return res.status(400).json({
        error: "Missing loan details",
        details: "principal, days, and purpose are required",
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

    // -------------------- BACKEND COMPUTATIONS --------------------
    const interest = Number((principal * INTEREST_RATE).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));

    console.log("💰 Computed Loan Values:");
    console.log("interest:", interest);
    console.log("total_payable:", total_payable);
    console.log("daily_payment:", daily_payment);

    // -------------------- INSERT LOAN INTO DB --------------------
    const loanRes = await db.query(
      `
      INSERT INTO loans (
        id, user_id,
        full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        principal, interest, total_payable, daily_payment, days, purpose,
        payout_method, payout_details,
        gov_id_uri, selfie_id_uri, proof_uri,
        status, created_at, remaining_balance
      )
      VALUES (
        uuid_generate_v4(), $1,
        $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19,
        'pending', NOW(), $11
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
        days,
        purpose,

        payout_method || null,
        JSON.stringify(payout_details || {}), // important

        valid_id_url || null,
        selfie_id_url || null,
        proof_income_url || null,
      ]
    );

    console.log("✅ Loan INSERT Success for user:", userId, "loanId:", loanRes.rows[0].id);

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: loanRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Loan Apply Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//  OTHER ROUTES (unchanged)
// ============================================================

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

router.get("/my-active", auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await db.query(
      `
      SELECT *
      FROM loans
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

router.get("/:loanId", auth, async (req, res) => {
  try {
    const loanId = req.params.loanId;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!loanId) return res.status(400).json({ error: "loanId required" });

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

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Get Loan Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
