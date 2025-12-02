// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

// ===============================================================
//  APPLY FOR LOAN (UPDATED TO MATCH FRONTEND FIELD NAMES)
// ===============================================================
router.post("/apply", auth, async (req, res) => {
  try {
    const userId = req.user.id;

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

      // === UPDATED FIELD NAMES (from frontend) ===
      valid_id_url,          // was government_id_url
      selfie_id_url,         // was selfie_with_id_url
      proof_income_url,      // was proof_of_funds_url

      // Local fallback
      valid_id_local_uri,        // was government_id_local_uri
      selfie_id_local_uri,       // was selfie_with_id_local_uri
      proof_income_local_uri,    // was proof_of_funds_local_uri
    } = req.body;

    if (!principal || !days || !purpose) {
      return res.status(400).json({ error: "Missing loan details" });
    }

    // Insert loan
    const loanRes = await db.query(
      `
      INSERT INTO loans (
        user_id, full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        principal, days, purpose,
        payout_method, payout_details,

        /* UPDATED FIELD NAMES */
        government_id_url, selfie_with_id_url, proof_of_funds_url,
        government_id_local_uri, selfie_with_id_local_uri, proof_of_funds_local_uri,

        status
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,$11,
        $12,$13,

        /* MAP FRONTEND NAMES TO DATABASE COLUMNS */
        $14,$15,$16,
        $17,$18,$19,

        'pending'
      )
      RETURNING *
      `,
      [
        userId,
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

        // CLOUD URLs mapped to old DB column names
        valid_id_url,
        selfie_id_url,
        proof_income_url,

        // LOCAL fallback URLs
        valid_id_local_uri,
        selfie_id_local_uri,
        proof_income_local_uri,
      ]
    );

    res.json({
      message: "Loan submitted successfully",
      loan: loanRes.rows[0],
    });
  } catch (err) {
    console.error("❌ Loan Apply Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//  FETCH ALL USER LOANS
// ===============================================================
router.get("/my-loans", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ my-loans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//  FETCH LATEST LOAN
// ===============================================================
router.get("/my-latest", auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT * FROM loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id]
    );

    res.json({ latestLoan: result.rows[0] || null });
  } catch (err) {
    console.error("❌ my-latest error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//  FETCH ACTIVE LOAN
// ===============================================================
router.get("/my-active", auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM loans
      WHERE user_id = $1
      AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [req.user.id]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error("❌ my-active error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================================================
//  SINGLE LOAN BY ID
// ===============================================================
router.get("/:loanId", auth, async (req, res) => {
  try {
    const id = Number(req.params.loanId);

    const result = await db.query(
      `
      SELECT *
      FROM loans
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [id, req.user.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Loan not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Get Loan Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
