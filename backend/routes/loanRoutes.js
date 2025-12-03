// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

const LOG_PREFIX = "[LOAN_ROUTES]";

/**
 * Borrower Loan Routes
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

// ------------------------------------------------------------
// APPLY FOR LOAN
// ------------------------------------------------------------
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

    // Check existing active loan
    const existing = await db.query(
      "SELECT id FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1",
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    // compute values
    const interest = Number((principal * 0.20).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));
    const remaining_balance = total_payable;

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

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: loanRes.rows[0],
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Loan apply error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------------
// GET ALL LOANS OF USER
// ------------------------------------------------------------
router.get("/my-loans", auth, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ my-loans error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------------
// GET LATEST LOAN
// ------------------------------------------------------------
router.get("/my-latest", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json({ latestLoan: result.rows[0] || null });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ my-latest error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------------
// GET ACTIVE LOAN
// ------------------------------------------------------------
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
    console.error(LOG_PREFIX, "❌ my-active error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------------
// GET ONE LOAN
// ------------------------------------------------------------
router.get("/:loanId", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.loanId, req.user.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Loan not found" });

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Get loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------------
// BORROWER ACCEPTS ADMIN APPROVAL
// ------------------------------------------------------------
router.post("/:loanId/accept", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user?.id;

  console.log(LOG_PREFIX, "Borrower accept:", { loanId, userId });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Validate ownership
    if (String(loan.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    // Must be in approved_pending_disburse
    if ((loan.status || "").toLowerCase() !== "approved_pending_disburse") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved_pending_disburse to accept",
      });
    }

    const now = new Date().toISOString();

    // Compute approved values
    const principal = Number(loan.principal);
    const total = Number(loan.total_payable);
    const daily = Number(loan.daily_payment);

    const upd = await client.query(
      `
      UPDATE loans
      SET 
        status = 'approved',
        borrower_accepted_at = $1,
        approved_principal = $2,
        approved_total_payable = $3,
        approved_daily_payment = $4
      WHERE id = $5
      RETURNING *
      `,
      [now, principal, total, daily, loanId]
    );

    await client.query("COMMIT");
    return res.json({ message: "Loan accepted", loan: upd.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG_PREFIX, "❌ Borrower accept error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ------------------------------------------------------------
// BORROWER REJECTS ADMIN APPROVAL
// ------------------------------------------------------------
router.post("/:loanId/reject", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user?.id;

  console.log(LOG_PREFIX, "Borrower reject:", { loanId, userId });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
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
      });
    }

    await client.query(
      `
      UPDATE loans
      SET status = 'borrower_rejected', borrower_rejected_at = NOW()
      WHERE id = $1
      `,
      [loanId]
    );

    await client.query("COMMIT");
    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG_PREFIX, "❌ Borrower reject error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
