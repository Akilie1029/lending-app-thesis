// services/repaymentEngine.js
const db = require("../db");

/**
 * Repayment Engine
 *
 * Canonical repayment_schedule columns:
 *  - id (PK)
 *  - loan_id (UUID/string)
 *  - day_number (int)
 *  - expected_amount (numeric)
 *  - due_date (timestamp)
 *  - status (text)  -> 'pending' | 'paid' | 'overdue'
 *  - paid_at (timestamp | NULL)
 *
 * repayment_history columns used:
 *  - id, loan_id, user_id, amount, created_at, is_late_fee (boolean, optional)
 *
 * transactions columns used:
 *  - id, user_id, loan_id, type, amount, payment_method, created_at
 *
 * Exports:
 *  - recalcLoanRemainingBalance(loanId, client)
 *  - markOverdueInstallments(loanId)
 *  - applyLateFeesIfNeeded(loanId, userId)
 */

// Helper to safely convert DB values to number
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance using repayment_history sums and update loan row.
 * Uses provided client (transaction client) if present to avoid acquiring a second connection.
 *
 * Returns the new remaining balance (number) or null if loan not found.
 */
async function recalcLoanRemainingBalance(loanId, client = null) {
  if (!loanId) {
    console.warn("recalcLoanRemainingBalance called without loanId");
    return null;
  }

  // Choose which client to use: provided transaction client or pool (db)
  const q = client && typeof client.query === "function" ? client : db;

  try {
    // Fetch loan total_payable
    const loanQ = await q.query(
      `SELECT id, total_payable FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    if (loanQ.rows.length === 0) {
      console.warn("recalcLoanRemainingBalance: loan not found", loanId);
      return null;
    }
    const totalPayable = num(loanQ.rows[0].total_payable);

    // Sum repayment_history.amount
    const paidQ = await q.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );
    const paid = num(paidQ.rows[0]?.paid);

    const remaining = Math.max(totalPayable - paid, 0);

    // Update loans row: remaining_balance, status (completed if 0), completed_at
    // Cast numeric comparisons explicitly to avoid mixed-type param errors.
    await q.query(
      `
      UPDATE loans
      SET remaining_balance = $1::numeric,
          status = CASE WHEN $1::numeric <= 0 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $1::numeric <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = $2
      `,
      [remaining, loanId]
    );

    console.log(
      `recalcLoanRemainingBalance: loanId=${loanId} total=${totalPayable} paid=${paid} remaining=${remaining}`
    );
    return remaining;
  } catch (err) {
    console.error("❌ recalcLoanRemainingBalance ERROR:", err);
    throw err;
  }
}

/**
 * Marks overdue installments based on due_date < today.
 *
 * This function does not require a transaction client; it uses pool queries.
 */
async function markOverdueInstallments(loanId) {
  if (!loanId) {
    console.warn("markOverdueInstallments called without loanId");
    return { updated: 0 };
  }

  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const res = await db.query(
      `
      UPDATE repayment_schedule
      SET status = 'overdue'
      WHERE loan_id = $1
        AND (due_date::date) < $2::date
        AND status != 'paid'
        AND status != 'overdue'
      RETURNING id
      `,
      [loanId, today]
    );

    console.log(`markOverdueInstallments: loanId=${loanId} marked=${res.rowCount}`);
    return { updated: res.rowCount, ids: res.rows.map((r) => r.id) };
  } catch (err) {
    console.error("❌ markOverdueInstallments ERROR:", err);
    throw err;
  }
}

/**
 * Apply late fees when threshold of overdue installments is met.
 * This function performs its own transaction with a dedicated client.
 */
async function applyLateFeesIfNeeded(loanId, userId, opts = {}) {
  if (!loanId || !userId) {
    console.warn("applyLateFeesIfNeeded called without loanId/userId");
    return { applied: false };
  }

  const LATE_FEE_AMOUNT = opts.lateFeeAmount || 1000;
  const THRESHOLD = opts.threshold || 2;
  const DUPLICATE_WINDOW_DAYS = opts.duplicateWindowDays || 30;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const overdueQ = await client.query(
      `
      SELECT COUNT(*)::int AS late_count
      FROM repayment_schedule
      WHERE loan_id = $1 AND status = 'overdue'
      `,
      [loanId]
    );
    const lateCount = Number(overdueQ.rows[0]?.late_count || 0);

    if (lateCount < THRESHOLD) {
      await client.query("ROLLBACK");
      return { applied: false, reason: "not_enough_overdue", lateCount };
    }

    const dupQ = await client.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM transactions
      WHERE loan_id = $1
        AND type = 'late_fee'
        AND created_at >= NOW() - INTERVAL '${DUPLICATE_WINDOW_DAYS} days'
      `,
      [loanId]
    );
    if (Number(dupQ.rows[0]?.cnt || 0) > 0) {
      await client.query("ROLLBACK");
      return { applied: false, reason: "already_applied_recently" };
    }

    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1, $2, 'late_fee', $3, 'system', NOW())
      RETURNING id, amount, created_at
      `,
      [userId, loanId, LATE_FEE_AMOUNT]
    );

    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, created_at, is_late_fee)
      VALUES ($1, $2, $3, NOW(), TRUE)
      RETURNING id, amount, created_at
      `,
      [loanId, userId, LATE_FEE_AMOUNT]
    );

    // Recalculate remaining using the same client to avoid pool contention
    const totalQ = await client.query(
      `SELECT COALESCE(total_payable, 0) AS total_payable FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    const paidQ = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );

    const totalPayable = num(totalQ.rows[0]?.total_payable);
    const paid = num(paidQ.rows[0]?.paid);
    const remaining = Math.max(totalPayable - paid, 0);

    await client.query(
      `
      UPDATE loans
      SET remaining_balance = $1::numeric,
          status = CASE WHEN $1::numeric <= 0 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $1::numeric <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = $2
      `,
      [remaining, loanId]
    );

    await client.query("COMMIT");

    console.log(
      `applyLateFeesIfNeeded: applied late fee loanId=${loanId} new_remaining=${remaining}`
    );

    return {
      applied: true,
      amount: LATE_FEE_AMOUNT,
      remaining_balance: remaining,
      lateCount,
      transaction: txRes.rows[0],
      repayment_history: rhRes.rows[0],
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ applyLateFeesIfNeeded rollback error:", rbErr);
    }
    console.error("❌ applyLateFeesIfNeeded ERROR:", err);
    throw err;
  } finally {
    try {
      client.release();
    } catch (releaseErr) {
      console.error("❌ Error releasing DB client (applyLateFeesIfNeeded):", releaseErr);
    }
  }
}

module.exports = {
  recalcLoanRemainingBalance,
  markOverdueInstallments,
  applyLateFeesIfNeeded,
};
