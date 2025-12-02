// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * Robust ADMIN — Approve / Reject Loans
 *
 * This implementation is defensive: it checks the current repayment_schedule
 * columns and inserts using the column names present (old / new / both).
 *
 * Supported column names:
 *  Old: day_number, expected_amount, due_date, status, paid_at
 *  New: installment_number, amount_due, due_date, paid, overdue
 *
 * The code will populate whichever columns exist.
 */

// Utility: generate schedule rows (logical model)
function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  const daily = Number(loan.daily_payment || 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1); // first due = tomorrow

  for (let i = 0; i < days; i++) {
    const due = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    list.push({
      installment_number: i + 1,
      day_number: i + 1, // helpful if older schema exists
      amount_due: daily,
      expected_amount: daily, // for older schema if present
      due_date: due.toISOString(),
      paid: false,
      overdue: false,
      status: "pending",
      paid_at: null,
    });
  }

  return list;
}

// Helper: get columns present in repayment_schedule as a Set
async function getRepaymentScheduleColumns(client) {
  const q = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='repayment_schedule'`
  );
  return new Set(q.rows.map((r) => r.column_name));
}

// Helper: build insert SQL & values array depending on columnsPresent
function buildInsertForScheduleRows(rows, columnsPresent) {
  if (!rows || rows.length === 0) return { sql: null, values: [] };

  // Determine which column names to include based on availability
  const colCandidates = [
    // prefer new names but fill old ones if present
    "loan_id",
    // numeric installment/day
    columnsPresent.has("installment_number")
      ? "installment_number"
      : columnsPresent.has("day_number")
      ? "day_number"
      : null,
    // amount columns
    columnsPresent.has("amount_due")
      ? "amount_due"
      : columnsPresent.has("expected_amount")
      ? "expected_amount"
      : null,
    // due_date is common
    columnsPresent.has("due_date") ? "due_date" : null,
    // paid (new) OR status/paid_at (old)
    columnsPresent.has("paid")
      ? "paid"
      : columnsPresent.has("status")
      ? "status"
      : null,
    // overdue (new) OR paid_at (old)
    columnsPresent.has("overdue")
      ? "overdue"
      : columnsPresent.has("paid_at")
      ? "paid_at"
      : null,
  ];

  // Filter out any nulls and ensure loan_id is first
  const insertCols = colCandidates.filter(Boolean);

  // build placeholders and values for each row
  const placeholders = [];
  const values = [];

  rows.forEach((r, idx) => {
    const rowPlaceholders = [];
    insertCols.forEach((col, ci) => {
      rowPlaceholders.push(`$${idx * insertCols.length + ci + 1}`);

      // push corresponding value per column
      switch (col) {
        case "loan_id":
          values.push(r.loan_id);
          break;
        case "installment_number":
        case "day_number":
          // both map to the same logical value
          values.push(r.installment_number ?? r.day_number ?? null);
          break;
        case "amount_due":
        case "expected_amount":
          values.push(
            typeof r.amount_due !== "undefined"
              ? r.amount_due
              : r.expected_amount ?? null
          );
          break;
        case "due_date":
          values.push(r.due_date);
          break;
        case "paid":
          values.push(r.paid ? true : false);
          break;
        case "overdue":
          values.push(r.overdue ? true : false);
          break;
        case "status":
          values.push(r.status ?? "pending");
          break;
        case "paid_at":
          values.push(r.paid_at ?? null);
          break;
        default:
          values.push(null);
      }
    });

    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  });

  const sql = `
    INSERT INTO repayment_schedule (${insertCols.join(", ")})
    VALUES ${placeholders.join(", ")}
  `;

  return { sql, values };
}

// ============================================================
// APPROVE LOAN - robust variant
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const approveAndDisburse =
    req.body && typeof req.body.approveAndDisburse !== "undefined"
      ? req.body.approveAndDisburse
      : false;

  console.log("\n\n🔥 [ADMIN] Approve request:", { loanId, approveAndDisburse, user: req.user?.id });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    console.log("STEP: Fetching loan for update:", loanId);
    const loanQ = await client.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`, [loanId]);
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn("⚠️ Loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }
    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      console.warn("⚠️ Loan is not pending:", loanId, "status:", loan.status);
      return res.status(400).json({ error: "Loan is not pending", currentStatus: loan.status });
    }

    // Update loan status -> approved and set approved_at
    const approvedAt = new Date().toISOString();
    console.log("STEP: Marking loan approved at", approvedAt);

    // Ensure daily_payment and total_payable exist; compute if missing (defensive)
    const totalPayable = Number(loan.total_payable || loan.total_payable || 0);
    const days = Number(loan.days || 0);
    const dailyPaymentComputed = days > 0 ? Number((totalPayable / days).toFixed(2)) : Number(loan.daily_payment || 0);

    await client.query(
      `
      UPDATE loans
      SET status = 'approved',
          approved_at = $1,
          total_payable = $2,
          daily_payment = $3
      WHERE id = $4
      `,
      [approvedAt, totalPayable, dailyPaymentComputed, loanId]
    );

    // Generate schedule (logical rows include both old & new mappings)
    console.log("STEP: Generating logical schedule rows");
    const scheduleRows = generateSchedule({
      id: loan.id,
      days: loan.days,
      daily_payment: loan.daily_payment || dailyPaymentComputed,
    }).map((r) => {
      // ensure loan_id exists
      return { ...r, loan_id: loan.id };
    });

    console.log("Generated scheduleRows:", scheduleRows.length);

    // Determine columns present
    const columnsPresent = await getRepaymentScheduleColumns(client);
    console.log("repayment_schedule columns present:", Array.from(columnsPresent).join(", "));

    // Build SQL & vals based on present columns
    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);

    if (sql) {
      console.log("STEP: Inserting repayment_schedule rows (SQL will use available columns)");
      console.log("SQL preview (truncated):", sql.replace(/\s+/g, " ").slice(0, 400));
      await client.query(sql, values);
      console.log("Inserted schedule rows successfully.");
    } else {
      console.log("No insert executed: repayment_schedule table appears to be missing expected columns.");
    }

    // Optional disbursement handling
    if (approveAndDisburse) {
      console.log("STEP: approveAndDisburse is true -> performing disbursement actions");
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
         VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)`,
        [loan.user_id, loanId, loan.principal, loan.payout_method || "bank", now]
      );

      await client.query(
        `UPDATE loans
         SET status = 'active',
             disbursed_at = $1,
             remaining_balance = $2
         WHERE id = $3`,
        [now, loan.total_payable || 0, loanId]
      );

      console.log("Disbursement completed for loan:", loanId);
    }

    await client.query("COMMIT");
    console.log("🎉 Loan approved and schedule created. Commit complete.");

    return res.json({
      message: "Loan approved",
      loanId,
      scheduleCount: scheduleRows.length,
      approveAndDisburse: !!approveAndDisburse,
    });
  } catch (err) {
    console.error("❌ Approve loan error:", err);
    try {
      await client.query("ROLLBACK");
    } catch (rb) {
      console.error("❌ Rollback error:", rb);
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
    await db.query(`UPDATE loans SET status = 'rejected', rejected_at = $1 WHERE id = $2`, [now, loanId]);
    console.log("Loan rejected:", loanId);
    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ Reject error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
