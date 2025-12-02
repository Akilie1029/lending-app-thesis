// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * Admin — Loan approvals & scheduling
 *
 * Changes made:
 * - Treat loanId as string (UUID) everywhere
 * - createRepaymentSchedule now produces rows matching canonical schema:
 *   day_number, expected_amount, due_date, status, paid_at
 * - Use DB transaction for approve -> schedule insert -> optional disburse
 * - Robust debug logging for tracing
 */

// Utility: build repayment schedule with canonical columns
const createRepaymentSchedule = (loan) => {
  // loan should include: id, days, total_payable, daily_payment (optional)
  const schedule = [];
  const days = Number(loan.days || 0);
  if (days <= 0) return schedule;

  // Start date = tomorrow (local server date)
  const start = new Date();
  start.setDate(start.getDate() + 1);

  const totalPayable = Number(loan.total_payable || loan.total_payable || 0);
  const dailyPayment = Number(loan.daily_payment || (days > 0 ? Number((totalPayable / days).toFixed(2)) : 0));

  for (let i = 0; i < days; i++) {
    // compute date safely (avoid mutating start incorrectly)
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000); // add i days
    schedule.push({
      loan_id: loan.id,
      day_number: i + 1,
      expected_amount: dailyPayment,
      due_date: d.toISOString(),
      status: "pending",
      paid_at: null,
    });
  }

  return schedule;
};

// ============================================================
//   GET PENDING LOANS (FIXED COLUMN NAMES)
// ============================================================
router.get("/pending", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT 
        id,
        user_id,
        principal,
        days,
        purpose,
        created_at,
        gov_id_uri,
        selfie_id_uri,
        proof_uri,
        status
      FROM loans
      WHERE LOWER(status) = 'pending'
      ORDER BY created_at ASC
      LIMIT 200
      `
    );

    return res.json(q.rows);
  } catch (err) {
    console.error("❌ Admin pending loans error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//   APPROVE LOAN (with schedule creation and optional disburse)
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  // Keep loanId as string (UUID)
  const loanId = req.params.loanId;
  const { approveAndDisburse = false } = req.body;

  if (!loanId) {
    return res.status(400).json({ error: "loanId is required" });
  }

  // DB transaction wrapper
  const client = await db.connect();
  try {
    console.log(`🔧 Approve Loan: loanId=${loanId} approveAndDisburse=${approveAndDisburse}`);

    await client.query("BEGIN");

    // 1) Fetch loan row (FOR UPDATE not strictly necessary here, but helps avoid race conditions)
    const loanQ = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("⚠️ ApproveLoan: loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    // Validate status
    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Loan is not pending", currentStatus: loan.status });
    }

    // 2) Update loan -> approved (set approved_at)
    const approvedAt = new Date().toISOString();
    await client.query(
      `UPDATE loans SET status = 'approved', approved_at = $1 WHERE id = $2`,
      [approvedAt, loanId]
    );
    console.log(`✅ Loan ${loanId} status set to 'approved' at ${approvedAt}`);

    // 3) Generate schedule using canonical columns
    const totalPayable = Number(loan.total_payable || 0);
    const days = Number(loan.days || 0);
    const dailyPayment = days > 0 ? Number((totalPayable / days).toFixed(2)) : 0;

    const scheduleTemplate = {
      id: loan.id,
      days,
      total_payable: totalPayable,
      daily_payment: dailyPayment,
    };

    const scheduleItems = createRepaymentSchedule({
      id: loan.id,
      days,
      total_payable: totalPayable,
      daily_payment: dailyPayment,
    });

    // 4) Insert schedule items (bulk insert) if any
    if (scheduleItems.length > 0) {
      const values = [];
      const placeholders = [];

      // Each schedule item has 6 fields: loan_id, day_number, expected_amount, due_date, status, paid_at
      scheduleItems.forEach((s, idx) => {
        const pIdx = idx * 6;
        placeholders.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6})`);
        values.push(s.loan_id, s.day_number, s.expected_amount, s.due_date, s.status, s.paid_at);
      });

      const insertSQL = `
        INSERT INTO repayment_schedule (loan_id, day_number, expected_amount, due_date, status, paid_at)
        VALUES ${placeholders.join(", ")}
      `;
      console.log("🔁 Inserting repayment_schedule items, count =", scheduleItems.length);
      await client.query(insertSQL, values);
      console.log("✅ repayment_schedule inserted for loanId:", loanId);
    } else {
      console.log("ℹ️ No schedule items created (days <= 0) for loanId:", loanId);
    }

    // 5) Optional: immediately disburse (approveAndDisburse)
    if (approveAndDisburse) {
      const disbursedAt = new Date().toISOString();

      // Insert loan_disbursement transaction
      await client.query(
        `
        INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
        VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)
        `,
        [loan.user_id, loanId, loan.principal, loan.payout_method || "bank", disbursedAt]
      );
      console.log(`💸 Disbursement transaction inserted for loan ${loanId} amount=${loan.principal}`);

      // Insert into disbursement_history
      await client.query(
        `
        INSERT INTO disbursement_history (loan_id, user_id, amount, payout_method, payout_reference, disbursed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [loan.id, loan.user_id, loan.principal, loan.payout_method || "bank", null, disbursedAt]
      );
      console.log(`📘 disbursement_history created for loan ${loanId} at ${disbursedAt}`);

      // Activate loan: set status active, disbursed_at, remaining_balance = total_payable
      await client.query(
        `
        UPDATE loans
        SET status = 'active',
            disbursed_at = $1,
            remaining_balance = $2
        WHERE id = $3
        `,
        [disbursedAt, Number(loan.total_payable || 0), loanId]
      );
      console.log(`✅ Loan ${loanId} set to 'active' with remaining_balance=${loan.total_payable}`);
    }

    // Commit transaction
    await client.query("COMMIT");

    // Return success with scheduledInstallments count
    return res.json({
      message: "Loan approved",
      loanId,
      scheduledInstallments: scheduleItems.length,
      approveAndDisburse: !!approveAndDisburse,
    });
  } catch (err) {
    // Rollback if transaction active
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ Error rolling back transaction:", rbErr);
    }

    console.error("❌ Approve loan error:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
      hint: "See server logs for SQL & stack (adminLoanApprovals.js)",
    });
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client:", releaseErr);
    }
  }
});

// ============================================================
//   REJECT LOAN
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { reason } = req.body;

  if (!loanId) {
    return res.status(400).json({ error: "loanId is required" });
  }

  try {
    const loanQ = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    await db.query(
      `UPDATE loans SET status = 'rejected', rejected_at = $1, rejection_reason = $2 WHERE id = $3`,
      [new Date().toISOString(), reason || null, loanId]
    );

    console.log(`⛔ Loan ${loanId} rejected. Reason: ${reason || "(none)"}`);
    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ Reject loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
