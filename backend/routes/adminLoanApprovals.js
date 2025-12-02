// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — Approve / Reject Loans
 * REWRITTEN FOR NEW repayment_schedule SCHEMA:
 *
 * repayment_schedule:
 *  - id (uuid)
 *  - loan_id
 *  - installment_number
 *  - amount_due
 *  - due_date
 *  - paid (boolean)
 *  - overdue (boolean)
 *
 * This file is now 100% aligned with KAURta v3 schema.
 */

// 🔧 Utility — Generate repayment schedule for N days
function generateSchedule(loan) {
  const { id: loanId, days, daily_payment } = loan;
  const list = [];

  const start = new Date();
  start.setDate(start.getDate() + 1); // first payment = tomorrow

  for (let i = 0; i < Number(days); i++) {
    const due = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);

    list.push({
      loan_id: loanId,
      installment_number: i + 1,
      amount_due: daily_payment,
      due_date: due.toISOString(),
      paid: false,
      overdue: false,
    });
  }

  return list;
}

// ============================================================
//   APPROVE LOAN
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  // Safe extraction
  const approveAndDisburse =
    req.body && typeof req.body.approveAndDisburse !== "undefined"
      ? req.body.approveAndDisburse
      : false;

  console.log("\n\n🔥 APPROVE LOAN REQUEST RECEIVED");
  console.log("➡️ loanId:", loanId);
  console.log("➡️ approveAndDisburse:", approveAndDisburse);
  console.log("➡️ Auth user:", req.user);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    console.log("STEP 1: Fetching loan…");

    const loanQ = await client.query(
      "SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE",
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if (loan.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Loan is not pending",
        currentStatus: loan.status,
      });
    }

    console.log("STEP 2: Approving loan…");

    const approvedAt = new Date().toISOString();

    await client.query(
      `
      UPDATE loans
      SET status = 'approved',
          approved_at = $1,
          total_payable = $2,
          daily_payment = $3
      WHERE id = $4
      `,
      [
        approvedAt,
        loan.total_payable,
        loan.daily_payment,
        loanId,
      ]
    );

    console.log("Loan approved at:", approvedAt);

    console.log("STEP 3: Generating repayment schedule…");

    const scheduleList = generateSchedule({
      id: loan.id,
      days: loan.days,
      daily_payment: loan.daily_payment,
    });

    console.log("Generated schedule count:", scheduleList.length);

    if (scheduleList.length > 0) {
      console.log("STEP 4: Inserting repayment schedule…");

      const placeholders = [];
      const values = [];

      scheduleList.forEach((s, i) => {
        const p = i * 6;
        placeholders.push(
          `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6})`
        );
        values.push(
          s.loan_id,
          s.installment_number,
          s.amount_due,
          s.due_date,
          s.paid,
          s.overdue
        );
      });

      await client.query(
        `
        INSERT INTO repayment_schedule
        (loan_id, installment_number, amount_due, due_date, paid, overdue)
        VALUES ${placeholders.join(",")}
        `,
        values
      );
    }

    // OPTIONAL immediate disbursement
    if (approveAndDisburse) {
      console.log("STEP 5: Disbursing loan…");

      const now = new Date().toISOString();

      await client.query(
        `
        INSERT INTO transactions 
        (user_id, loan_id, type, amount, payment_method, created_at)
        VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)
        `,
        [loan.user_id, loanId, loan.principal, loan.payout_method, now]
      );

      await client.query(
        `
        UPDATE loans 
        SET status = 'active',
            disbursed_at = $1,
            remaining_balance = $2
        WHERE id = $3
        `,
        [now, loan.total_payable, loanId]
      );

      console.log("Loan disbursed successfully.");
    }

    console.log("STEP 6: COMMITTING…");
    await client.query("COMMIT");

    console.log("🎉 APPROVAL COMPLETED");

    return res.json({
      message: "Loan approved successfully",
      loanId,
      scheduleCreated: scheduleList.length,
      approveAndDisburse: !!approveAndDisburse,
    });
  } catch (err) {
    console.error("❌ APPROVE LOAN FATAL ERROR:", err);

    try {
      await client.query("ROLLBACK");
    } catch (rb) {
      console.error("❌ ROLLBACK FAILED:", rb);
    }

    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  } finally {
    client.release();
  }
});

// ============================================================
//   REJECT LOAN
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log("⛔ Reject loan request:", loanId);

  try {
    const now = new Date().toISOString();

    await db.query(
      `
      UPDATE loans
      SET status = 'rejected',
          rejected_at = $1
      WHERE id = $2
      `,
      [now, loanId]
    );

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ REJECT ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
