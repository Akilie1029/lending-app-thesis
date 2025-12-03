// routes/adminLoanApprovals.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * Robust ADMIN — Approve / Reject Loans (V2)
 *
 * Includes:
 *  - GET /pending WITH JOIN to users → so admin sees borrower name
 *  - Safe flexible repayment schedule generator
 */

// -----------------------------
// Utility: generate schedule rows (logical model)
// -----------------------------
function generateSchedule(loan) {
  const days = Number(loan.days || 0);
  const daily = Number(loan.daily_payment || 0);

  const list = [];
  const start = new Date();
  start.setDate(start.getDate() + 1); // first due = tomorrow

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

// -----------------------------
// Helper: get columns present
// -----------------------------
async function getRepaymentScheduleColumns(client) {
  const q = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='repayment_schedule'`
  );
  return new Set(q.rows.map((r) => r.column_name));
}

// -----------------------------
// Helper: build SQL insertion
// -----------------------------
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
        case "installment_number": values.push(r.installment_number ?? r.day_number ?? null); break;
        case "day_number": values.push(r.day_number ?? r.installment_number ?? null); break;
        case "amount_due": values.push(r.amount_due ?? r.expected_amount ?? null); break;
        case "expected_amount": values.push(r.expected_amount ?? r.amount_due ?? null); break;
        case "due_date": values.push(r.due_date); break;
        case "paid": values.push(r.paid ? true : false); break;
        case "overdue": values.push(r.overdue ? true : false); break;
        case "status": values.push(r.status ?? "pending"); break;
        case "paid_at": values.push(r.paid_at ?? null); break;
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

// ============================================================
// ✅ FIXED: GET PENDING LOANS (now includes borrower name)
// ============================================================
router.get("/pending", auth, admin, async (req, res) => {
  try {
    const q = await db.query(
      `
      SELECT 
        l.id,
        l.user_id,
        u.full_name AS borrower_name,
        u.email AS borrower_email,
        u.phone AS borrower_phone,
        l.principal,
        l.total_payable,
        l.daily_payment,
        l.days,
        l.purpose,
        l.created_at,
        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri,
        l.status
      FROM loans l
      JOIN users u ON u.id = l.user_id
      WHERE LOWER(COALESCE(l.status,'')) = 'pending'
      ORDER BY l.created_at ASC
      LIMIT 200
      `
    );

    return res.json(q.rows || []);
  } catch (err) {
    console.error("❌ Admin pending loans error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ============================================================
// APPROVE LOAN — unchanged logic below
// ============================================================
router.post("/approve/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;
  const approveAndDisburse =
    req.body && typeof req.body.approveAndDisburse !== "undefined"
      ? req.body.approveAndDisburse
      : false;

  console.log("\n\n🔥 [ADMIN] Approve request:", {
    loanId,
    approveAndDisburse,
    user: req.user?.id,
  });

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `SELECT * FROM loans WHERE id = $1 LIMIT 1 FOR UPDATE`,
      [loanId]
    );
    if (loanQ.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    if ((loan.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Loan is not pending" });
    }

    const totalPayable = Number(loan.total_payable || 0);
    const days = Number(loan.days || 0);
    const dailyPaymentComputed =
      days > 0 ? Number((totalPayable / days).toFixed(2)) : Number(loan.daily_payment || 0);

    await client.query(
      `
      UPDATE loans
      SET status = 'approved',
          approved_at = $1,
          total_payable = $2,
          daily_payment = $3
      WHERE id = $4
      `,
      [new Date().toISOString(), totalPayable, dailyPaymentComputed, loanId]
    );

    const scheduleRows = generateSchedule({
      id: loan.id,
      days: loan.days,
      daily_payment: loan.daily_payment || dailyPaymentComputed,
    });

    const columnsPresent = await getRepaymentScheduleColumns(client);
    const { sql, values } = buildInsertForScheduleRows(scheduleRows, columnsPresent);

    if (sql) await client.query(sql, values);

    if (approveAndDisburse) {
      const now = new Date().toISOString();

      await client.query(
        `
        INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
        VALUES ($1, $2, 'loan_disbursement', $3, $4, $5)
        `,
        [loan.user_id, loanId, loan.principal, loan.payout_method || "bank", now]
      );

      await client.query(
        `
        UPDATE loans
        SET status = 'active',
            disbursed_at = $1,
            remaining_balance = $2
        WHERE id = $3
        `,
        [now, loan.total_payable || 0, loanId]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Loan approved",
      loanId,
      scheduleCount: scheduleRows.length,
      approveAndDisburse,
    });
  } catch (err) {
    console.error("❌ Approve loan error:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ error: "Server error", details: err.message });
  } finally {
    client.release();
  }
});

// ============================================================
// REJECT LOAN
// ============================================================
router.post("/reject/:loanId", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  try {
    const now = new Date().toISOString();
    await db.query(
      `UPDATE loans SET status = 'rejected', rejected_at = $1 WHERE id = $2`,
      [now, loanId]
    );

    return res.json({ message: "Loan rejected", loanId });
  } catch (err) {
    console.error("❌ Reject error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
