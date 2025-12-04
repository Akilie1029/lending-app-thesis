// routes/loanRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

const LOG = "[LOAN_ROUTES]";

/**
 * Borrower Loan Routes
 * Status flow:
 *  pending → approved_pending_disburse → approved → active → completed
 *
 * Notifications added (DB direct insert):
 *  - loan_submitted
 *  - loan_accepted
 *  - loan_rejected_by_borrower
 */

// ---------------------------------------------------------------------
// Helper: Create Notification (NO axios required)
// ---------------------------------------------------------------------
async function pushNotification({ user_id, loan_id, type, title, message }) {
  try {
    await db.query(
      `
      INSERT INTO notifications (id, user_id, loan_id, type, title, message)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5)
      `,
      [user_id, loan_id, type, title, message]
    );
  } catch (err) {
    console.error(LOG, "❌ pushNotification error:", err.message);
  }
}

// ---------------------------------------------------------------------
// APPLY FOR LOAN
// ---------------------------------------------------------------------
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

    // Prevent multiple active loans
    const existing = await db.query(
      `SELECT id FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    // Compute loan
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

    const newLoan = loanRes.rows[0];

    // 🔔 DB Notification (loan_submitted)
    await pushNotification({
      user_id: userId,
      loan_id: newLoan.id,
      type: "loan_submitted",
      title: "Loan Application Submitted",
      message: "Your loan application has been received and is now under review.",
    });

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: newLoan,
    });
  } catch (err) {
    console.error(LOG, "❌ Loan apply error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ---------------------------------------------------------------------
// GET Borrower's Loans
// ---------------------------------------------------------------------
router.get("/my-loans", auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows || []);
  } catch (err) {
    console.error(LOG, "❌ my-loans error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/my-latest", auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    return res.json({ latestLoan: r.rows[0] || null });
  } catch (err) {
    console.error(LOG, "❌ my-latest error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/my-active", auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM loans WHERE user_id = $1 AND LOWER(status) = 'active' LIMIT 1`,
      [req.user.id]
    );
    return res.json(r.rows[0] || null);
  } catch (err) {
    console.error(LOG, "❌ my-active error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------------
// GET SINGLE LOAN
// ---------------------------------------------------------------------
router.get("/:loanId", auth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT * FROM loans WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [req.params.loanId, req.user.id]
    );

    if (r.rows.length === 0)
      return res.status(404).json({ error: "Loan not found" });

    return res.json(r.rows[0]);
  } catch (err) {
    console.error(LOG, "❌ Get loan error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ---------------------------------------------------------------------
// BORROWER ACCEPTS ADMIN APPROVAL
// ---------------------------------------------------------------------
router.post("/:loanId/accept", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

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
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved_pending_disburse to accept",
      });
    }

    if (
      loan.approved_principal == null ||
      loan.approved_total_payable == null ||
      loan.approved_daily_payment == null
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "MISSING_APPROVED_VALUES",
        message: "Admin has not set approved loan values",
      });
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

    // 🔔 DB Notification
    pushNotification({
      user_id: userId,
      loan_id: loanId,
      type: "loan_accepted",
      title: "Loan Accepted",
      message: "You accepted the loan offer. Waiting for disbursement.",
    });

    return res.json({
      message: "Loan accepted",
      loan: upd.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG, "❌ accept error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------
// BORROWER REJECTS ADMIN APPROVAL
// ---------------------------------------------------------------------
router.post("/:loanId/reject", auth, async (req, res) => {
  const loanId = req.params.loanId;
  const userId = req.user.id;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

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
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved_pending_disburse to reject",
      });
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

    // 🔔 DB Notification
    pushNotification({
      user_id: userId,
      loan_id: loanId,
      type: "loan_rejected_by_borrower",
      title: "Loan Rejected",
      message: "You rejected the loan offer.",
    });

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
