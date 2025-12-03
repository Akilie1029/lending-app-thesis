// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG_PREFIX = "[ADMIN_DISBURSE]";

/**
 *  Helper functions and schedule generator preserved from previous version
 *  (unchanged)
 */

function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  const daily = Number(loan.approved_daily_payment || 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1);

  for (let i = 0; i < days; i++) {
    const due = new Date(start.getTime() + i * 24 * 3600 * 1000);
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
  const q = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='repayment_schedule'`
  );
  return new Set(q.rows.map((r) => r.column_name));
}

function buildInsertForScheduleRows(rows, columnsPresent) {
  if (!rows.length) return { sql: null, values: [] };

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

  rows.forEach((r, i) => {
    const rowPlace = uniqueCols.map((col, colIdx) => {
      const idx = i * uniqueCols.length + colIdx + 1;
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
      return `$${idx}`;
    });
    placeholders.push(`(${rowPlace.join(",")})`);
  });

  const sql = `
    INSERT INTO repayment_schedule (${uniqueCols.join(",")})
    VALUES ${placeholders.join(",")}
  `;
  return { sql, values };
}

// -------------------------------------------------------------
// GET /api/admin/disburse/pending
// Loans ready for disbursement: status = 'approved'
// -------------------------------------------------------------
router.get("/disburse/pending", auth, admin, async (req, res) => {
  try {
    console.log(LOG_PREFIX, "Fetching pending disbursements…");

    const q = await db.query(
      `
      SELECT 
        l.id,
        l.user_id,

        -- user
        u.full_name,
        u.email,

        -- admin-approved values
        l.approved_principal,
        l.approved_total_payable,
        l.approved_daily_payment,

        -- fallback values (IMPORTANT!)
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
        l.approved_at

      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE LOWER(l.status) = 'approved'
      ORDER BY l.approved_at ASC
      `
    );

    console.log(LOG_PREFIX, `Found ${q.rows.length} pending loans`);

    return res.json(q.rows);
  } catch (err) {
    console.error(LOG_PREFIX, "Pending disbursement error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// -------------------------------------------------------------
// POST /api/admin/disburse/:loanId
// Final disbursement process
// -------------------------------------------------------------
router.post("/disburse/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (!loanQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan is not approved yet.",
      });
    }

    const disbursedAt = new Date().toISOString();
    const approvedPrincipal = Number(loan.approved_principal);

    // Generate schedule
    const scheduleRows = generateSchedule(loan);
    const columnsPresent = await getRepaymentScheduleColumns(client);
    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);

    if (sql) await client.query(sql, values);

    // Insert disbursement transaction
    await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, created_at)
      VALUES ($1, $2, 'loan_disbursement', $3, $4)
      `,
      [loan.user_id, loanId, approvedPrincipal, disbursedAt]
    );

    // Update loan → active
    const upd = await client.query(
      `
      UPDATE loans
      SET status = 'active',
          disbursed_at = $1,
          remaining_balance = approved_total_payable
      WHERE id = $2
      RETURNING *
      `,
      [disbursedAt, loanId]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Loan disbursed successfully",
      loan: upd.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(LOG_PREFIX, "❌ Disbursement error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
