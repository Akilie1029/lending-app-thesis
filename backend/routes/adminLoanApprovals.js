// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * Admin — Loan approvals & scheduling
 *
 * FIXED:
 *  - daily_payment is now saved into loans table on approval
 *  - prevents frontend crash: toLocaleString() of null
 */

// Utility: Build repayment schedule using canonical schema
const createRepaymentSchedule = (loan) => {
  const schedule = [];
  const days = Number(loan.days || 0);
  if (days <= 0) return schedule;

  const start = new Date();
  start.setDate(start.getDate() + 1);

  const dailyPayment = Number(loan.daily_payment || 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000); // add i days

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
//   GET PENDING LOANS
// ============================================================
router.get("/pending", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT id, user_id, principal, days, purpose,
             created_at, gov_id_uri, selfie_id_uri, proof_uri, status
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
//   APPROVE LOAN (Fix: daily_payment saved to DB)
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { approveAndDisburse = false } = req.body;

  if (!loanId) {
    return res.status(400).json({ error: "loanId is required" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1) Fetch loan
    const loanQ = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Loan is not pending", currentStatus: loan.status });
    }

    // 2) Compute daily payment
    const totalPayable = Number(loan.total_payable || 0);
    const days = Number(loan.days || 0);
    const dailyPayment = days > 0 ? Number((totalPayable / days).toFixed(2)) : 0;

    console.log(`🧮 dailyPayment = ${dailyPayment} for loan ${loanId}`);

    // 3) Update loan: approved + save daily_payment
    const approvedAt = new Date().toISOString();
    await client.query(
      `
      UPDATE loans
      SET status = 'approved',
          approved_at = $1,
          daily_payment = $2         -- FIX APPLIED HERE
      WHERE id = $3
      `,
      [approvedAt, dailyPayment, loanId]
    );

    console.log(`✅ Loan ${loanId} updated with daily_payment=${dailyPayment}`);

    // 4) Generate schedule
    const scheduleItems = createRepaymentSchedule({
      id: loan.id,
      days,
      total_payable: totalPayable,
      daily_payment: dailyPayment,
    });

    if (scheduleItems.length > 0) {
      const values = [];
      const placeholders = [];

      scheduleItems.forEach((s, idx) => {
        const pIdx = idx * 6;
        placeholders.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6})`);
        values.push(s.loan_id, s.day_number, s.expected_amount, s.due_date, s.status, s.paid_at);
      });

      await client.query(
        `
        INSERT INTO repayment_schedule (loan_id, day_number, expected_amount, due_date, status, paid_at)
        VALUES ${placeholders.join(", ")}
        `,
        values
      );
    }

    // 5) Optional: Immediate disbursement
    if (approveAndDisburse) {
      const disbursedAt = new Date().toISOString();

      await client.query(
        `
        INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
        VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)
        `,
        [loan.user_id, loanId, loan.principal, loan.payout_method || "bank", disbursedAt]
      );

      await client.query(
        `
        UPDATE loans
        SET status = 'active',
            disbursed_at = $1,
            remaining_balance = $2
        WHERE id = $3
        `,
        [disbursedAt, totalPayable, loanId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Loan approved",
      loanId,
      daily_payment: dailyPayment,
      scheduledInstallments: scheduleItems.length,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch { }

    console.error("❌ Approve loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
//   REJECT LOAN
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const { reason } = req.body;

  try {
    const loanQ = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    await db.query(
      `
      UPDATE loans
      SET status = 'rejected',
          rejected_at = $1,
          rejection_reason = $2
      WHERE id = $3
      `,
      [new Date().toISOString(), reason || null, loanId]
    );

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ Reject loan error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
