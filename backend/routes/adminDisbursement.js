// routes/adminDisbursement.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");
const axios = require("axios");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5001";
const LOG_PREFIX = "[ADMIN_DISBURSE]";

/**
 * Admin Disbursement routes
 *
 * - GET  /api/admin/disburse/pending   -> list loans with status = 'approved'
 * - POST /api/admin/disburse/:loanId   -> finalize disbursement (create schedule, tx, history, update loan)
 *
 * NOTE:
 *  - This file expects the loans table to include approved_* fields:
 *      approved_principal, approved_total_payable, approved_daily_payment
 *  - On disbursement we set disbursed_amount = approved_principal (per your choice)
 *  - Uses safe DB transactions and row-level locks (FOR UPDATE)
 */

// -------------------------
// Utility: repayment schedule generator
// -------------------------
function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  // prefer approved_daily_payment; fallback to approved_total_payable / days
  const daily = Number(loan.approved_daily_payment ?? 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1); // due starts tomorrow

  for (let i = 0; i < days; i++) {
    const due = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
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

// -------------------------------------------------------------
// GET /api/admin/disburse/pending
// Loans ready for disbursement: status = 'approved'
// -------------------------------------------------------------
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

        -- admin-approved fields (may be null if legacy)
        l.approved_principal,
        l.approved_total_payable,
        l.approved_daily_payment,

        -- fallbacks / legacy fields
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
      `
    );

    console.log(LOG_PREFIX, `Found ${q.rows.length} pending loans`);
    return res.json(q.rows);
  } catch (err) {
    console.error(LOG_PREFIX, "Pending disbursement fetch error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// -------------------------------------------------------------
// POST /api/admin/disburse/:loanId
// Final disbursement process
// Steps:
//  1) Validate loan status = 'approved'
//  2) Ensure approved_principal exists
//  3) Generate repayment schedule (based on approved_daily_payment & days)
//  4) Insert repayment_schedule rows (if table exists / columns present)
//  5) Insert transactions (loan_disbursement)
//  6) Insert into disbursement_history
//  7) Update loans: status='active', disbursed_at, remaining_balance = approved_total_payable, disbursed_amount = approved_principal
// -------------------------------------------------------------
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
      console.warn(LOG_PREFIX, "Loan not found:", loanId);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    const status = (loan.status || "").toLowerCase();

    if (status !== "approved") {
      await client.query("ROLLBACK");
      console.warn(LOG_PREFIX, "Loan not in 'approved' state:", loanId, "status:", loan.status);
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Loan must be in status 'approved' (borrower accepted) before disbursement",
        current_status: loan.status,
      });
    }

    // Ensure admin-approved values are present
    if (loan.approved_principal == null) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "NO_APPROVED_PRINCIPAL",
        message: "Loan is missing approved_principal — cannot disburse.",
      });
    }

    const approvedPrincipal = Number(loan.approved_principal);
    const approvedTotalPayable = Number(loan.approved_total_payable ?? loan.total_payable ?? 0);
    const approvedDailyPayment = Number(loan.approved_daily_payment ?? loan.daily_payment ?? 0);
    const days = Number(loan.days || 0);
    const userId = loan.user_id;

    const disbursedAt = new Date().toISOString();

    // -----------------------
    // 1) Create repayment schedule (if days > 0)
    // -----------------------
    console.log(LOG_PREFIX, "Generating repayment schedule...");
    const scheduleRows = generateSchedule({
      id: loan.id,
      days,
      approved_daily_payment: approvedDailyPayment,
    });

    console.log(LOG_PREFIX, `Generated ${scheduleRows.length} schedule rows`);

    const columnsPresent = await getRepaymentScheduleColumns(client);
    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);

    if (sql) {
      console.log(LOG_PREFIX, "Inserting repayment schedule rows...");
      await client.query(sql, values);
      console.log(LOG_PREFIX, "Repayment schedule insertion complete.");
    } else {
      console.warn(LOG_PREFIX, "No repayment_schedule INSERT generated (maybe table missing or no rows).");
    }

    // -----------------------
    // 2) Insert disbursement transaction
    // -----------------------
    console.log(LOG_PREFIX, "Inserting disbursement transaction...");
    const txRes = await client.query(
      `
      INSERT INTO transactions
        (user_id, loan_id, type, amount, payment_method, reference_no, created_at)
      VALUES
        ($1, $2, 'loan_disbursement', $3, $4, $5, $6)
      RETURNING id, amount, created_at
      `,
      [userId, loanId, approvedPrincipal, loan.payout_method || null, payoutReference, disbursedAt]
    );

    // -----------------------
    // 3) Insert disbursement_history
    // -----------------------
    console.log(LOG_PREFIX, "Logging disbursement history...");
    const dhRes = await client.query(
      `
      INSERT INTO disbursement_history
        (loan_id, user_id, amount, payout_method, payout_reference, disbursed_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, disbursed_at
      `,
      [loanId, userId, approvedPrincipal, loan.payout_method || null, payoutReference, disbursedAt]
    );

    // -----------------------
    // 4) Update loan -> active
    //    - status = 'active'
    //    - disbursed_at
    //    - remaining_balance = approved_total_payable
    //    - disbursed_amount = approved_principal  <-- NEW (per your choice)
    // -----------------------
    console.log(LOG_PREFIX, "Finalizing loan activation...");
    const updatedLoanQ = await client.query(
      `
      UPDATE loans
      SET
        status = 'active',
        disbursed_at = $1,
        remaining_balance = $2,
        disbursed_amount = $3
      WHERE id = $4
      RETURNING *
      `,
      [disbursedAt, approvedTotalPayable, approvedPrincipal, loanId]
    );

    await client.query("COMMIT");

    console.log(LOG_PREFIX, "Loan successfully disbursed:", loanId);

    // -------------------------------------------------
    // 🔔 Send Notification — Loan Disbursed
    // -------------------------------------------------
    try {
      await axios.post(`${BASE_URL}/api/notifications/push`, {
        user_id: userId,
        loan_id: loanId,
        type: "loan_disbursed",
        title: "Loan Disbursed",
        message: `Your loan of ₱${approvedPrincipal.toLocaleString()} has been disbursed and is now available.`,
      });
    } catch (notifErr) {
      console.error(LOG_PREFIX, "❌ Notification error:", notifErr);
    }

    return res.json({
      message: "Loan successfully disbursed",
      loan: updatedLoanQ.rows[0],
      transaction: txRes.rows[0],
      disbursement_history: dhRes.rows[0],
      schedule_created: scheduleRows.length,
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Disbursement ERROR:", err);
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error(LOG_PREFIX, "Rollback error:", rbErr);
    }
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
