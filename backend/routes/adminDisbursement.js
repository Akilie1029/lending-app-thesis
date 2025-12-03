// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_DISBURSE]";

// ------------------------------------------------------
// SAFE schedule generator utilities (copied from old approval file)
// ------------------------------------------------------

function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  const daily = Number(loan.approved_daily_payment || 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1); // first due = tomorrow

  for (let i = 0; i < days; i++) {
    const due = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    list.push({
      loan_id: loan.id,
      installment_number: i + 1,
      day_number: i + 1, // for older schema compatibility
      amount_due: daily,
      expected_amount: daily, // older schema compatibility
      due_date: due.toISOString(),
      paid: false,
      overdue: false,
      status: "pending",
      paid_at: null,
    });
  }

  return list;
}

async function getRepaymentScheduleColumns(client) {
  const q = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='repayment_schedule'`
  );
  return new Set(q.rows.map((r) => r.column_name));
}

function buildInsertForScheduleRows(rows, columnsPresent) {
  if (!rows || rows.length === 0) return { sql: null, values: [] };

  const insertCols = ["loan_id"];

  if (columnsPresent.has("installment_number")) insertCols.push("installment_number");
  if (columnsPresent.has("day_number")) insertCols.push("day_number");

  if (columnsPresent.has("amount_due")) insertCols.push("amount_due");
  if (columnsPresent.has("expected_amount")) insertCols.push("expected_amount");

  if (columnsPresent.has("due_date")) insertCols.push("due_date");

  if (columnsPresent.has("paid")) insertCols.push("paid");
  if (columnsPresent.has("overdue")) insertCols.push("overdue");

  if (columnsPresent.has("status")) insertCols.push("status");
  if (columnsPresent.has("paid_at")) insertCols.push("paid_at");

  const uniqueCols = Array.from(new Set(insertCols));

  const placeholders = [];
  const values = [];

  rows.forEach((r, rowIdx) => {
    const rowPlaceholders = [];

    uniqueCols.forEach((col, colIdx) => {
      rowPlaceholders.push(`$${rowIdx * uniqueCols.length + colIdx + 1}`);

      switch (col) {
        case "loan_id":
          values.push(r.loan_id);
          break;
        case "installment_number":
          values.push(r.installment_number ?? r.day_number ?? null);
          break;
        case "day_number":
          values.push(r.day_number ?? r.installment_number ?? null);
          break;
        case "amount_due":
          values.push(r.amount_due ?? r.expected_amount ?? null);
          break;
        case "expected_amount":
          values.push(r.expected_amount ?? r.amount_due ?? null);
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
      INSERT INTO repayment_schedule (${uniqueCols.join(", ")})
      VALUES ${placeholders.join(", ")}
    `;

  return { sql, values };
}

// ------------------------------------------------------
// GET /api/admin/disburse/pending
// Returns loans waiting for disbursement (status = 'approved')
// ------------------------------------------------------
router.get("/disburse/pending", auth, admin, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "Fetching pending disbursements...");

    const q = await db.query(
      `
      SELECT 
        l.id,
        l.user_id,
        u.full_name,
        u.email,
        l.approved_principal,
        l.approved_total_payable,
        l.approved_daily_payment,
        l.days,
        l.payout_method,
        l.payout_details,
        l.approved_at
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE LOWER(l.status) = 'approved'
      ORDER BY l.approved_at ASC
      `
    );

    console.log(LOG_PREFIX, `Found ${q.rows.length} loans pending disbursement`);

    return res.json({ loans: q.rows || [] });
  } catch (err) {
    console.error(LOG_PREFIX, "Pending disbursement fetch error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ------------------------------------------------------
// POST /api/admin/disburse/:loanId
// Finalizes disbursement:
// 1. Validates loan.status = 'approved'
// 2. Creates repayment schedule (safe, compatible)
// 3. Inserts disbursement transaction
// 4. Inserts disbursement_history
// 5. Updates loan: active, disbursed_at, remaining_balance
// ------------------------------------------------------
router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  console.log(LOG_PREFIX, "Disburse route called…");

  const loanId = req.params.loanId;

  if (!loanId) return res.status(400).json({ error: "loanId is required" });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    console.log(LOG_PREFIX, "Locking loan for update:", loanId);

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "approved") {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not in approved state:", loanId, loan.status);
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be approved (borrower accepted) before disbursement",
        current_status: loan.status,
      });
    }

    if (!loan.approved_principal) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "NO_APPROVED_PRINCIPAL",
        message: "Loan is missing approved_principal — cannot disburse.",
      });
    }

    const userId = loan.user_id;
    const approvedPrincipal = Number(loan.approved_principal);
    const payoutMethod = loan.payout_method || "unknown";
    const payoutReference = req.body?.payout_reference || null;

    const disbursedAt = new Date().toISOString();

    // ------------------------------------------------------
    // Create repayment schedule HERE
    // ------------------------------------------------------
    console.log(LOG_PREFIX, "Generating repayment schedule…");

    const scheduleRows = generateSchedule({
      id: loan.id,
      days: loan.days,
      approved_daily_payment: loan.approved_daily_payment,
    });

    console.log(LOG_PREFIX, "Schedule rows generated:", scheduleRows.length);

    const columnsPresent = await getRepaymentScheduleColumns(client);

    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);

    if (sql) {
      console.log(LOG_PREFIX, "Inserting schedule rows...");
      await client.query(sql, values);
      console.log(LOG_PREFIX, "Schedule insertion complete.");
    } else {
      console.warn(LOG_PREFIX, "No valid repayment_schedule INSERT generated.");
    }

    // ------------------------------------------------------
    // Insert disbursement transaction
    // ------------------------------------------------------
    console.log(LOG_PREFIX, "Inserting disbursement transaction…");

    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, reference_no, created_at)
      VALUES ($1, $2, 'loan_disbursement', $3, $4, $5, $6)
      RETURNING id, amount, created_at
      `,
      [userId, loanId, approvedPrincipal, payoutMethod, payoutReference, disbursedAt]
    );

    // ------------------------------------------------------
    // Insert disbursement_history
    // ------------------------------------------------------
    console.log(LOG_PREFIX, "Logging disbursement history…");

    const dhRes = await client.query(
      `
      INSERT INTO disbursement_history
        (loan_id, user_id, amount, payout_method, payout_reference, disbursed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, disbursed_at
      `,
      [loanId, userId, approvedPrincipal, payoutMethod, payoutReference, disbursedAt]
    );

    // ------------------------------------------------------
    // Update loan → active
    // ------------------------------------------------------
    console.log(LOG_PREFIX, "Finalizing loan activation…");

    const updatedLoanQ = await client.query(
      `
      UPDATE loans
      SET
        status = 'active',
        disbursed_at = $1,
        remaining_balance = approved_total_payable
      WHERE id = $2
      RETURNING *
      `,
      [disbursedAt, loanId]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan successfully disbursed:", loanId);

    return res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoanQ.rows[0],
      transaction: txRes.rows[0],
      disbursement_history: dhRes.rows[0],
      schedule_created: scheduleRows.length,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Disbursement ERROR:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
