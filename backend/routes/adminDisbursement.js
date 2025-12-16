// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_DISBURSE]";

/* Notifications disabled */
async function pushNotification() {
  return;
}

/* Repayment schedule generator */
function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  const daily = Number(loan.approved_daily_payment ?? 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1);

  for (let i = 0; i < days; i++) {
    const due = new Date(start.getTime() + i * 86400000);
    list.push({
      loan_id: loan.id,
      installment_number: i + 1,
      day_number: i + 1,
      amount_due: daily,
      expected_amount: daily,
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
  const q = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='repayment_schedule'
  `);
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
        case "loan_id": values.push(r.loan_id); break;
        case "installment_number": values.push(r.installment_number); break;
        case "day_number": values.push(r.day_number); break;
        case "amount_due": values.push(r.amount_due); break;
        case "expected_amount": values.push(r.expected_amount); break;
        case "due_date": values.push(r.due_date); break;
        case "paid": values.push(false); break;
        case "overdue": values.push(false); break;
        case "status": values.push("pending"); break;
        case "paid_at": values.push(null); break;
        default: values.push(null);
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

/* ---------------------------
   GET /api/admin/disburse/pending
---------------------------- */
router.get("/disburse/pending", auth, admin, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "Fetching pending disbursements...");

    const q = await db.query(`
      SELECT
        l.id,
        l.user_id,
        u.full_name,
        u.email,
        l.approved_principal,
        l.approved_total_payable,
        l.approved_daily_payment,
        l.principal,
        l.total_payable,
        l.daily_payment,
        l.remaining_balance,
        l.days,
        l.payout_method,
        l.payout_details,
        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri,
        l.created_at,
        l.approved_at,
        l.status
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE LOWER(COALESCE(l.status, '')) = 'approved'
      ORDER BY l.approved_at ASC NULLS LAST
    `);

    return res.json(q.rows);
  } catch (err) {
    console.error(LOG_PREFIX, "Pending disbursement fetch error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

/* ---------------------------
   POST /api/admin/disburse/:loanId
---------------------------- */
router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  if (!loanId) return res.status(400).json({ error: "loanId is required" });

  const payoutReference = req.body?.payout_reference || null;

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
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be 'approved' before disbursement",
        current_status: loan.status,
      });
    }

    if (loan.approved_principal == null) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "NO_APPROVED_PRINCIPAL",
        message: "Missing approved_principal.",
      });
    }

    const approvedPrincipal = Number(loan.approved_principal);
    const approvedTotalPayable = Number(loan.approved_total_payable ?? loan.total_payable ?? 0);
    const approvedDailyPayment = Number(loan.approved_daily_payment ?? loan.daily_payment ?? 0);
    const days = Number(loan.days || 0);
    const userId = loan.user_id;

    const disbursedAt = new Date().toISOString();

    // 1) Repayment Schedule
    const scheduleRows = generateSchedule({
      id: loan.id,
      days,
      approved_daily_payment: approvedDailyPayment,
    });

    const columnsPresent = await getRepaymentScheduleColumns(client);
    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);
    if (sql) await client.query(sql, values);

    // 🔑 AUTHORITATIVE FIRST DUE DATE (ADDED — NO OTHER LOGIC CHANGED)
    const latestDueDate =
      scheduleRows.length > 0 ? scheduleRows[0].due_date : null;

    // 2) Transaction (loan disbursement)
    const txRes = await client.query(
      `
      INSERT INTO transactions
        (user_id, loan_id, type, amount, payment_method, reference_no, created_at)
      VALUES ($1, $2, 'loan_disbursement', $3, $4, $5, $6)
      RETURNING id, amount, created_at
      `,
      [userId, loanId, approvedPrincipal, loan.payout_method, payoutReference, disbursedAt]
    );

    // 3) Disbursement history (ensure id is populated)
    const dhRes = await client.query(
      `
      INSERT INTO disbursement_history
        (id, loan_id, user_id, amount, payout_method, payout_details, payout_reference, disbursed_at, date_released)
      VALUES (
        uuid_generate_v4(),
        $1, $2, $3, $4, $5, $6, $7, $7
      )
      RETURNING *
      `,
      [
        loanId,
        userId,
        approvedPrincipal,
        loan.payout_method,
        loan.payout_details,
        payoutReference,
        disbursedAt
      ]
    );

    // 4) Update Loan → active (ONLY latest_due_date ADDED)
    const updatedLoanQ = await client.query(
      `
      UPDATE loans
      SET status = 'active',
          disbursed_at = $1,
          latest_due_date = $2,
          remaining_balance = $3::numeric,
          disbursed_amount = $4
      WHERE id = $5
      RETURNING *
      `,
      [disbursedAt, latestDueDate, approvedTotalPayable, approvedPrincipal, loanId]
    );

    await client.query("COMMIT");

    pushNotification();

    return res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoanQ.rows[0],
      transaction: txRes.rows[0],
      disbursement_history: dhRes.rows[0],
      schedule_created: scheduleRows.length,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Disbursement ERROR:", err);
    try { await client.query("ROLLBACK"); } catch (e) {}
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
