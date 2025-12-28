// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const { applyLateFeesIfNeeded } = require("../services/repaymentEngine");

const LOG = "[LOAN_ROUTES]";

/* Notifications disabled */
async function pushNotification() { return; }

/* -------------------------------------------------------------
   HELPER: Apply approved_* overrides safely
------------------------------------------------------------- */
function applyApprovedOverrides(loan) {
  if (!loan) return loan;

  const out = { ...loan };

  if (loan.approved_principal != null)
    out.principal = Number(loan.approved_principal);

  if (loan.approved_interest != null)
    out.interest = Number(loan.approved_interest);

  if (loan.approved_total_payable != null)
    out.total_payable = Number(loan.approved_total_payable);

  if (loan.approved_daily_payment != null)
    out.daily_payment = Number(loan.approved_daily_payment);

  return out;
}

/* -------------------------------------------------------------
   APPLY FOR LOAN (unchanged)
------------------------------------------------------------- */
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
        error: "MISSING_FIELDS",
        message: "principal, days, and purpose are required",
      });
    }

    const existing = await db.query(
      `SELECT id FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1`,
      [userId]
    );

    if (existing.rows.length > 0)
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });

    const interest = Number((principal * 0.20).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));

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
        $9, $10, $11, $12, $11,
        $13, $14,
        $15, $16,
        $17, $18, $19,
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
    console.error(LOG, "❌ Loan apply error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

/* -------------------------------------------------------------
   GET Borrower's Loans
------------------------------------------------------------- */
router.get("/my-loans", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );

    const patched = result.rows.map(applyApprovedOverrides);
    return res.json(patched);
  } catch (err) {
    console.error(LOG, "❌ my-loans error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------
   GET latest loan
------------------------------------------------------------- */
router.get("/my-latest", auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    return res.json({
      latestLoan: applyApprovedOverrides(r.rows[0]) || null,
    });
  } catch (err) {
    console.error(LOG, "❌ my-latest error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------
   GET Active Loan (EVENT-DRIVEN LATE FEE APPLICATION)
------------------------------------------------------------- */
router.get("/my-active", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const r = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1`,
      [userId]
    );

    if (!r.rows.length) return res.json(null);

    const loan = r.rows[0];

    // --------------------------------------------------
    // APPLY LATE FEES (EVENT-DRIVEN, IDEMPOTENT)
    // --------------------------------------------------
    await applyLateFeesIfNeeded(loan.id, userId);

    // Re-fetch loan to reflect updates
    const refreshed = await db.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1`,
      [loan.id]
    );

    const finalLoan = applyApprovedOverrides(refreshed.rows[0]);

    // -------------------------------
    // LATE CALCULATION (READ-ONLY)
    // -------------------------------
    let is_late = false;
    let days_late = 0;

    if (finalLoan.latest_due_date) {
      const today = new Date();
      const due = new Date(finalLoan.latest_due_date);

      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((today - due) / 86400000);

      if (diffDays > 0) {
        is_late = true;
        days_late = diffDays;
      }
    }

    return res.json({
      ...finalLoan,
      is_late,
      days_late,
    });
  } catch (err) {
    console.error(LOG, "❌ my-active error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------
   GET Single Loan
------------------------------------------------------------- */
router.get("/:loanId", auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.loanId, req.user.id]
    );

    if (r.rows.length === 0)
      return res.status(404).json({ error: "Loan not found" });

    return res.json(applyApprovedOverrides(r.rows[0]));
  } catch (err) {
    console.error(LOG, "❌ Get loan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* -------------------------------------------------------------
   Accept Loan
------------------------------------------------------------- */
router.post("/:loanId/accept", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [loanId]);
    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = r.rows[0];

    if (String(loan.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if ((loan.status || "").toLowerCase() !== "approved_pending_disburse") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "INVALID_STATUS" });
    }

    const now = new Date().toISOString();

    const upd = await client.query(
      `
      UPDATE loans
      SET status = 'approved',
          borrower_accepted_at = $1
      WHERE id = $2
      RETURNING *
      `,
      [now, loanId]
    );

    await client.query("COMMIT");
    return res.json({ message: "Loan accepted", loan: applyApprovedOverrides(upd.rows[0]) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG, "❌ accept error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

/* -------------------------------------------------------------
   Reject Loan
------------------------------------------------------------- */
router.post("/:loanId/reject", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(`SELECT * FROM loans WHERE id = $1 FOR UPDATE`, [
      loanId,
    ]);

    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = r.rows[0];

    if (String(loan.user_id) !== String(userId)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Forbidden" });
    }

    if ((loan.status || "").toLowerCase() !== "approved_pending_disburse") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "INVALID_STATUS" });
    }

    await client.query(
      `
      UPDATE loans
      SET status = 'borrower_rejected',
          borrower_rejected_at = NOW()
      WHERE id = $1
      `,
      [loanId]
    );

    await client.query("COMMIT");

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG, "❌ reject error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
