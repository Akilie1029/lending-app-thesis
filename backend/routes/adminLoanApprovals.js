const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_APPROVALS]";

/**
 * Admin Loan Approvals
 *
 * Responsibilities:
 *  - List pending loan applications (status = 'pending')
 *  - Approve a loan (admin sets approved_principal) -> status = 'approved_pending_disburse'
 *    * Stores approved_principal, approved_interest, approved_total_payable, approved_daily_payment, approved_at
 *  - Reject a loan -> status = 'rejected'
 *
 * Notes / assumptions:
 *  - Interest rule: flat 20% (5-6 system)
 *  - approved_daily_payment is computed as approved_total_payable / days (if days > 0)
 *  - Admin is NOT disbursing here; borrower still needs to accept before admin final disburse steps.
 */

// -------------------------------------------------------------
// GET /api/admin/pending
// List pending loan applications (status = 'pending')
// -------------------------------------------------------------
router.get("/pending", auth, admin, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "GET /api/admin/pending called by:", req.user?.id || "unknown");

    const q = await db.query(
      `
      SELECT
        l.id,
        l.user_id,
        u.full_name AS borrower_name,
        u.email AS borrower_email,
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
      WHERE LOWER(COALESCE(l.status, '')) = 'pending'
      ORDER BY l.created_at ASC
      LIMIT 1000
      `
    );

    console.log(LOG_PREFIX, `Pending loans returned: count=${q.rows.length}`);
    return res.json(q.rows || []);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ GET /pending ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// -------------------------------------------------------------
// POST /api/admin/approve/:loanId
// Admin approves loan — sets approved_* fields and status = 'approved_pending_disburse'
// Body: { approved_principal: number }
// -------------------------------------------------------------
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const rawApproved = req.body?.approved_principal;

  console.log(LOG_PREFIX, "Approve request:", { loanId, adminId: req.user?.id });

  if (!loanId) {
    return res.status(400).json({ error: "MISSING_LOAN_ID" });
  }

  if (typeof rawApproved === "undefined" || rawApproved === null) {
    return res.status(400).json({ error: "MISSING_APPROVED_PRINCIPAL", message: "approved_principal is required" });
  }

  const approved_principal = Number(rawApproved);

  if (!isFinite(approved_principal) || approved_principal <= 0) {
    return res.status(400).json({ error: "INVALID_APPROVED_PRINCIPAL", message: "approved_principal must be a positive number" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Fetch loan FOR UPDATE
    const loanQ = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Only allow admin approve when loan is pending
    const curStatus = (loan.status || "").toLowerCase();
    if (curStatus !== "pending") {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Cannot approve loan with current status:", loan.id, loan.status);
      return res.status(400).json({ error: "INVALID_STATUS", message: `Loan must be in 'pending' to approve (current: ${loan.status})` });
    }

    // Determine original requested principal
    const original_principal = Number(loan.amount_requested ?? loan.principal ?? 0);

    if (approved_principal > original_principal) {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Approved principal exceeds requested amount:", { approved_principal, original_principal });
      return res.status(400).json({
        error: "APPROVED_EXCEEDS_REQUESTED",
        message: "approved_principal cannot be greater than the original requested principal",
      });
    }

    // Compute approved values (20% flat interest)
    const approved_interest = Number((approved_principal * 0.20).toFixed(2));
    const approved_total_payable = Number((approved_principal + approved_interest).toFixed(2));

    const days = Number(loan.days || 0);
    const approved_daily_payment = days > 0 ? Number((approved_total_payable / days).toFixed(2)) : approved_total_payable;

    const now = new Date().toISOString();

    // Update loan with approved_* and set status to approved_pending_disburse
    const updateRes = await client.query(
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
      RETURNING id, user_id, status, approved_principal, approved_interest, approved_total_payable, approved_daily_payment, approved_at
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

    if (updateRes.rows.length === 0) {
      await client.query("ROLLBACK");
      console.error(LOG_PREFIX, "Failed to update loan (approve):", loanId);
      return res.status(500).json({ error: "UPDATE_FAILED" });
    }

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan approved (pending borrower acceptance):", loanId);
    return res.json({
      message: "Loan approved (awaiting borrower acceptance)",
      loan: updateRes.rows[0],
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error(LOG_PREFIX, "Rollback failed:", rbErr);
    }
    console.error(LOG_PREFIX, "❌ Approve loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// -------------------------------------------------------------
// POST /api/admin/reject/:loanId
// Admin rejects a loan (status = 'rejected')
// Body optional: { reason: string }
// -------------------------------------------------------------
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const reason = req.body?.reason || null;

  if (!loanId) {
    return res.status(400).json({ error: "MISSING_LOAN_ID" });
  }

  try {
    // Only set status to 'rejected' if loan exists
    const now = new Date().toISOString();
    const update = await db.query(
      `UPDATE loans
       SET status = 'rejected',
           rejected_at = $1,
           rejection_reason = COALESCE($2, rejection_reason)
       WHERE id = $3
       RETURNING id, status, rejected_at, rejection_reason`,
      [now, reason, loanId]
    );

    if (!update.rows.length) {
      console.warn(LOG_PREFIX, "Reject attempted but loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    console.log(LOG_PREFIX, "Loan rejected by admin:", loanId, "reason:", reason || "(none)");
    return res.json({ message: "Loan rejected", loan: update.rows[0] });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Reject loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
