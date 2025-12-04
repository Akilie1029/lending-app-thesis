// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_APPROVAL]";

/**
 * Notifications DISABLED (safe no-op)
 * This ensures no crashes while keeping the structure ready for future use.
 */
async function pushNotification() {
  return;
}

/**
 * Handles:
 *  - GET /pending
 *  - POST /approve/:loanId
 *  - POST /reject/:loanId
 *
 * Status Flow:
 *   pending → approved_pending_disburse → approved → active → completed
 *                     ↘ borrower_rejected
 *                     ↘ rejected
 */

// ---------------------------------------------------------
// GET ALL PENDING LOANS
// ---------------------------------------------------------
router.get("/pending", auth, admin, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "Fetching pending loans...");

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
      WHERE LOWER(l.status) = 'pending'
      ORDER BY l.created_at ASC
      LIMIT 200
      `
    );

    return res.json(q.rows);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Pending loans error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// ---------------------------------------------------------
// ADMIN APPROVES LOAN
// ---------------------------------------------------------
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log(LOG_PREFIX, "Approve request received:", {
    loanId,
    approved_principal: req.body?.approved_principal,
  });

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

    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan is not pending",
      });
    }

    const requested = Number(loan.amount_requested ?? loan.principal);
    const approvedPrincipal = Number(req.body?.approved_principal);

    if (!approvedPrincipal || approvedPrincipal <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid approved_principal" });
    }

    if (approvedPrincipal > requested) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "APPROVED_EXCEEDS_REQUESTED",
        message: `Approved amount cannot exceed requested amount ₱${requested}`,
      });
    }

    // Compute approved values
    const approvedInterest = Number((approvedPrincipal * 0.20).toFixed(2));
    const approvedTotalPayable = Number(
      (approvedPrincipal + approvedInterest).toFixed(2)
    );
    const days = Number(loan.days);
    const approvedDailyPayment =
      days > 0
        ? Number((approvedTotalPayable / days).toFixed(2))
        : approvedTotalPayable;

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
        approvedPrincipal,
        approvedInterest,
        approvedTotalPayable,
        approvedDailyPayment,
        now,
        loanId,
      ]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan approved (pending borrower acceptance).");

    // 🔕 Notifications disabled
    pushNotification();

    return res.json({
      message: "Loan approved (awaiting borrower acceptance)",
      loanId,
      approved_principal: approvedPrincipal,
      approved_interest: approvedInterest,
      approved_total_payable: approvedTotalPayable,
      approved_daily_payment: approvedDailyPayment,
      approved_at: now,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Approve error:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------
// ADMIN REJECTS LOAN
// ---------------------------------------------------------
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  try {
    const now = new Date().toISOString();

    const q = await db.query(
      `
      UPDATE loans
      SET status = 'rejected',
          rejected_at = $1
      WHERE id = $2
      RETURNING id, user_id
      `,
      [now, loanId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Loan not found" });
    }

    // 🔕 Notifications disabled
    pushNotification();

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Reject error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;
