const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

// Import normalizeLoan utility (YOU ALREADY HAVE THIS FILE)
const { normalizeLoan } = require("../utils/normalizeLoan");

const LOG_PREFIX = "[LOAN_ROUTES]";

/**
 * Loan routes (borrower-facing)
 *
 * Endpoints:
 *  - POST /apply
 *  - GET  /my-loans
 *  - GET  /my-latest
 *  - GET  /my-active
 *  - GET  /:loanId
 *  - POST /:loanId/accept
 *  - POST /:loanId/reject
 */

// ----------------------------------------------------------------------
// APPLY FOR LOAN
// ----------------------------------------------------------------------
router.post("/apply", auth, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "🚀 /api/loans/apply by", req.user?.id);

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

    // Compute financial values
    const interest = Number((principal * 0.20).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));
    const remaining_balance = total_payable;

    // Insert loan
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

    console.log(LOG_PREFIX, "✅ Loan INSERT:", loanRes.rows[0]?.id);

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: normalizeLoan(loanRes.rows[0]),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Apply Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------
// GET ALL LOANS OF USER — normalized
// ----------------------------------------------------------------------
router.get("/my-loans", auth, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "📡 /my-loans by", req.user.id);

    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    const normalized = result.rows.map((l) => normalizeLoan(l));

    return res.json(normalized);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ my-loans error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------
// GET MOST RECENT LOAN — normalized
// ----------------------------------------------------------------------
router.get("/my-latest", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      latestLoan: result.rows[0] ? normalizeLoan(result.rows[0]) : null,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ my-latest error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------
// GET ACTIVE LOAN — normalized
// ----------------------------------------------------------------------
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

    return res.json(result.rows[0] ? normalizeLoan(result.rows[0]) : null);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ my-active error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------
// GET SINGLE LOAN — normalized
// ----------------------------------------------------------------------
router.get("/:loanId", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.loanId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Loan not found" });
    }

    return res.json(normalizeLoan(result.rows[0]));
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Get Loan Error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------
// ACCEPT APPROVED AMOUNT
// ----------------------------------------------------------------------
router.post("/:loanId/accept", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user?.id;

  console.log(LOG_PREFIX, "Borrower ACCEPT:", { loanId, userId });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );
    if (!loanQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if (String(loan.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if ((loan.status || "").toLowerCase() !== "approved_pending_disburse") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved_pending_disburse to accept",
        currentStatus: loan.status,
      });
    }

    const now = new Date().toISOString();

    const upd = await client.query(
      `UPDATE loans SET status = 'approved', borrower_accepted_at = $1 WHERE id = $2 RETURNING *`,
      [now, loanId]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan accepted");

    return res.json({
      message: "Loan accepted",
      loan: normalizeLoan(upd.rows[0]),
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Borrower accept error:", err);
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------------------------
// REJECT APPROVED AMOUNT
// ----------------------------------------------------------------------
router.post("/:loanId/reject", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user?.id;

  console.log(LOG_PREFIX, "Borrower REJECT:", { loanId, userId });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );

    if (!loanQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if (String(loan.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if ((loan.status || "").toLowerCase() !== "approved_pending_disburse") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved_pending_disburse to reject",
        currentStatus: loan.status,
      });
    }

    const now = new Date().toISOString();

    await client.query(
      `UPDATE loans SET status = 'borrower_rejected', borrower_rejected_at = $1 WHERE id = $2`,
      [now, loanId]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan rejected");

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Borrower reject error:", err);
    try { await client.query("ROLLBACK"); } catch {}
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
