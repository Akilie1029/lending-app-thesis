// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_APPROVAL]";

// -----------------------------
// Utility: ensure loans table has approved_* and borrower_* columns
// (defensive: will run only when missing columns are detected)
// -----------------------------
async function ensureApprovedColumns(client) {
  const colRes = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'loans'`
  );
  const existing = new Set(colRes.rows.map((r) => r.column_name));

  const needed = [
    { name: "approved_principal", sql: "approved_principal numeric NULL" },
    { name: "approved_interest", sql: "approved_interest numeric NULL" },
    { name: "approved_total_payable", sql: "approved_total_payable numeric NULL" },
    { name: "approved_daily_payment", sql: "approved_daily_payment numeric NULL" },
    { name: "borrower_accepted_at", sql: "borrower_accepted_at timestamp NULL" },
    { name: "borrower_rejected_at", sql: "borrower_rejected_at timestamp NULL" },
  ];

  const toAdd = needed.filter((n) => !existing.has(n.name));
  if (toAdd.length === 0) {
    console.log(LOG_PREFIX, "approved_* and borrower_* columns present - no ALTER needed");
    return;
  }

  console.log(LOG_PREFIX, "Missing columns detected:", toAdd.map((t) => t.name).join(", "));
  const alterSql = "ALTER TABLE loans " + toAdd.map((t) => `ADD COLUMN ${t.sql}`).join(", ");

  console.log(LOG_PREFIX, "Executing ALTER TABLE to add missing columns");
  await client.query(alterSql);
  console.log(LOG_PREFIX, "ALTER TABLE complete, columns added:", toAdd.map((t) => t.name).join(", "));
}

// -----------------------------
// GET PENDING LOANS
// -----------------------------
router.get("/pending", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT 
        l.id,
        l.user_id,
        u.full_name AS borrower_name,
        u.email AS borrower_email,
        l.phone_number AS borrower_phone,
        l.principal,
        l.amount_requested,
        l.total_payable,
        l.daily_payment,
        l.days,
        l.purpose,
        l.created_at,
        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri,
        l.status
      FROM loans l
      JOIN users u ON u.id = l.user_id
      WHERE LOWER(COALESCE(l.status,'')) = 'pending'
      ORDER BY l.created_at ASC
      LIMIT 200
      `
    );

    return res.json(q.rows || []);
  } catch (err) {
    console.error(LOG_PREFIX, "Admin pending loans error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
// APPROVE LOAN (admin sets approved amount) - UPDATED BEHAVIOUR
//
// Expects in req.body: { approved_principal }
// Validates approved_principal <= original principal (or amount_requested)
// Computes approved_interest (20%), approved_total_payable, approved_daily_payment
// Updates loans table with approved_* fields and sets status = 'approved_pending_disburse'
// Does NOT create repayment schedule or disburse.
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const rawApproved = req.body?.approved_principal;

  console.log(LOG_PREFIX, "Approve request received:", { loanId, adminId: req.user?.id });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Ensure DB has required columns (defensive)
    await ensureApprovedColumns(client);

    // Fetch loan FOR UPDATE
    console.log(LOG_PREFIX, "Fetching loan record (FOR UPDATE):", loanId);
    const loanQ = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`, [
      loanId,
    ]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not pending:", loanId, "status:", loan.status);
      return res.status(400).json({ error: "Loan is not pending", currentStatus: loan.status });
    }

    // Validate approved_principal provided
    if (typeof rawApproved === "undefined" || rawApproved === null) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "approved_principal is required" });
    }

    const approved_principal = Number(rawApproved);
    if (Number.isNaN(approved_principal) || approved_principal <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid approved_principal" });
    }

    // Determine original requested principal (use amount_requested if present, else principal)
    const original_principal = Number(loan.amount_requested ?? loan.principal ?? 0);

    // Ensure admin cannot approve an amount higher than requested/original principal
    if (approved_principal > original_principal) {
      await client.query("ROLLBACK");
      console.warn(
        LOG_PREFIX,
        "Approved principal greater than original principal:",
        approved_principal,
        original_principal
      );
      return res.status(400).json({
        error: "APPROVED_EXCEEDS_REQUESTED",
        message: "approved_principal cannot be greater than the requested principal",
      });
    }

    // Compute approved interest (20% of approved principal)
    const approved_interest = Number((approved_principal * 0.2).toFixed(2));

    // Determine repayment days (fallback to loan.days)
    const days = Number(loan.days || 0);

    const approved_total_payable = Number((approved_principal + approved_interest).toFixed(2));
    const approved_daily_payment =
      days > 0 ? Number((approved_total_payable / days).toFixed(2)) : Number(approved_total_payable);

    console.log(LOG_PREFIX, "Computed approved values:", {
      approved_principal,
      approved_interest,
      approved_total_payable,
      approved_daily_payment,
      days,
    });

    // Update the loan: set approved_* values and set status to approved_pending_disburse
    const now = new Date().toISOString();

    await client.query(
      `
      UPDATE loans
      SET
        approved_principal = $1,
        approved_interest = $2,
        approved_total_payable = $3,
        approved_daily_payment = $4,
        approved_at = $5,
        status = 'approved_pending_disburse'
      WHERE id = $6
      `,
      [
        approved_principal,
        approved_interest,
        approved_total_payable,
        approved_daily_payment,
        now,
        loanId,
      ]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan approved (pending borrower acceptance):", loanId);

    // Return sanitized loan summary for admin UI and for borrower notification
    return res.json({
      message: "Loan approved (awaiting borrower acceptance)",
      loanId,
      approved_principal,
      approved_interest,
      approved_total_payable,
      approved_daily_payment,
      approved_at: now,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "Approve loan error:", err);
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error(LOG_PREFIX, "Rollback error:", rbErr);
    }
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// REJECT route (keeps existing semantics)
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  try {
    const now = new Date().toISOString();
    await db.query(`UPDATE loans SET status = 'rejected', rejected_at = $1 WHERE id = $2`, [
      now,
      loanId,
    ]);
    console.log(LOG_PREFIX, "Loan rejected by admin:", loanId);
    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error(LOG_PREFIX, "Reject error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
