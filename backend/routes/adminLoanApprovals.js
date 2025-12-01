// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// Utilities
const createRepaymentSchedule = async (loan) => {
  // loan object should contain id, principal, days, created_at, total_payable, daily_payment
  const schedule = [];
  const days = Number(loan.days || 0);
  if (days <= 0) return schedule;

  // Start date = tomorrow
  const start = new Date();
  start.setDate(start.getDate() + 1);

  const daily = Number(loan.daily_payment || (loan.total_payable / days) || 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    schedule.push({
      loan_id: loan.id,
      due_date: d.toISOString(),
      amount_due: daily,
      paid: false,
      installment_number: i + 1,
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

    res.json(q.rows);
  } catch (err) {
    console.error("❌ Admin pending loans error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
//   APPROVE LOAN
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = Number(req.params.loanId);
  const { approveAndDisburse = false } = req.body;

  try {
    const loanQ = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) return res.status(404).json({ error: "Loan not found" });

    const loan = loanQ.rows[0];

    if (loan.status !== "pending") {
      return res.status(400).json({ error: "Loan is not pending" });
    }

    const approvedAt = new Date().toISOString();
    await db.query(
      `UPDATE loans SET status = 'approved', approved_at = $1 WHERE id = $2`,
      [approvedAt, loanId]
    );

    // Generate schedule
    const totalPayable = Number(loan.total_payable || 0);
    const days = Number(loan.days || 0);
    const dailyPayment = days > 0 ? Number((totalPayable / days).toFixed(2)) : 0;

    const toSchedule = {
      id: loan.id,
      days,
      total_payable: totalPayable,
      daily_payment: dailyPayment,
    };

    const scheduleItems = await createRepaymentSchedule(toSchedule);

    if (scheduleItems.length > 0) {
      const values = [];
      const placeholders = [];

      scheduleItems.forEach((s, idx) => {
        const pIdx = idx * 5;
        placeholders.push(`($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
        values.push(s.loan_id, s.due_date, s.amount_due, s.paid, s.installment_number);
      });

      const insertSQL = `
        INSERT INTO repayment_schedule (loan_id, due_date, amount_due, paid, installment_number)
        VALUES ${placeholders.join(", ")}
      `;

      await db.query(insertSQL, values);
    }

    // Instant approve + disburse
    if (approveAndDisburse) {
      const disbursedAt = new Date().toISOString();

      await db.query(
        `INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
         VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)`,
        [loan.user_id, loanId, loan.principal, loan.payout_method || "bank", disbursedAt]
      );

      await db.query(
        `
        UPDATE loans
        SET status = 'active', disbursed_at = $1, remaining_balance = $2
        WHERE id = $3
        `,
        [disbursedAt, Number(loan.total_payable || 0), loanId]
      );
    }

    res.json({ message: "Loan approved", loanId, scheduledInstallments: scheduleItems.length });
  } catch (err) {
    console.error("❌ Approve loan error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
//   REJECT LOAN
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = Number(req.params.loanId);
  const { reason } = req.body;

  try {
    const loanQ = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) return res.status(404).json({ error: "Loan not found" });

    await db.query(
      `UPDATE loans SET status = 'rejected', rejected_at = $1, rejection_reason = $2 WHERE id = $3`,
      [new Date().toISOString(), reason || null, loanId]
    );

    res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ Reject loan error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
