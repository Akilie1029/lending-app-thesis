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
 * This module exports:
 *  - recalcLoanRemainingBalance(loanId)
 *  - markOverdueInstallments(loanId)
 *  - applyLateFeesIfNeeded(loanId, userId)
 */

// Helper to safely convert DB values to number
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance using repayment_history sums and update loan row.
 * Also set loan.status = 'completed' if remaining <= 0 and set completed_at.
 *
 * Returns the new remaining balance (number) or null if loan not found.
 */
async function recalcLoanRemainingBalance(loanId) {
  if (!loanId) {
    console.warn("recalcLoanRemainingBalance called without loanId");
    return null;
  }
  try {
    // Fetch loan total_payable
    const loanQ = await db.query(`SELECT id, total_payable FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    if (loanQ.rows.length === 0) {
      console.warn("recalcLoanRemainingBalance: loan not found", loanId);
      return null;
    }
    const totalPayable = num(loanQ.rows[0].total_payable);

    // Sum repayment_history.amount
    const paidQ = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );
    const paid = num(paidQ.rows[0]?.paid);

    const remaining = Math.max(totalPayable - paid, 0);

    // Update loans row: remaining_balance, status (completed if 0), completed_at
    await db.query(
      `
      UPDATE loans
      SET remaining_balance = $1,
          status = CASE WHEN $1 <= 0 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $1 <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = $2
      `,
      [remaining, loanId]
    );

    console.log(`recalcLoanRemainingBalance: loanId=${loanId} total=${totalPayable} paid=${paid} remaining=${remaining}`);
    return remaining;
  } catch (err) {
    console.error("❌ recalcLoanRemainingBalance ERROR:", err);
    throw err;
  }
}

/**
 * Mark overdue installments for a loan:
 * - For repayment_schedule rows where due_date::date < today AND status != 'paid' AND status != 'overdue',
 *   set status = 'overdue'.
 *
 * This function does not apply late fees; it only marks schedule rows.
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
 * Apply late fees if needed.
 *
 * Logic:
 *  - Count overdue installments: status = 'overdue' AND (optionally) paid != 'paid'
 *  - If overdue count >= threshold (default 2) then:
 *      - Check if a late_fee transaction was recently applied for this loan (to avoid duplicates).
 *      - If none, insert a transactions row of type 'late_fee' and insert a repayment_history with is_late_fee = TRUE.
 *      - Recalculate remaining balance.
 *
 * Returns an object { applied: boolean, amount: number, details: {...} }
 */
async function applyLateFeesIfNeeded(loanId, userId, opts = {}) {
  if (!loanId || !userId) {
    console.warn("applyLateFeesIfNeeded called without loanId or userId", { loanId, userId });
    return { applied: false };
  }

  const LATE_FEE_AMOUNT = opts.lateFeeAmount || 1000; // default flat fee
  const THRESHOLD = opts.threshold || 2; // number of overdue installments to trigger fee
  const DUPLICATE_WINDOW_DAYS = opts.duplicateWindowDays || 30; // don't reapply fee if one applied in last X days

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Count overdue installments for loan
    const overdueQ = await client.query(
      `
      SELECT COUNT(*)::int AS late_count
      FROM repayment_schedule
      WHERE loan_id = $1
        AND status = 'overdue'
      `,
      [loanId]
    );
    const lateCount = Number(overdueQ.rows[0]?.late_count || 0);
    console.log(`applyLateFeesIfNeeded: loanId=${loanId} overdue_count=${lateCount}`);

    if (lateCount < THRESHOLD) {
      await client.query("ROLLBACK");
      return { applied: false, reason: "not_enough_overdue", lateCount };
    }

    // Check for existing late_fee transaction within duplicate window
    const dupCheckQ = await client.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM transactions
      WHERE loan_id = $1
        AND type = 'late_fee'
        AND created_at >= NOW() - INTERVAL '${DUPLICATE_WINDOW_DAYS} days'
      `,
      [loanId]
    );
    const duplicateCount = Number(dupCheckQ.rows[0]?.cnt || 0);
    if (duplicateCount > 0) {
      await client.query("ROLLBACK");
      console.log(`applyLateFeesIfNeeded: existing late_fee found within ${DUPLICATE_WINDOW_DAYS} days, skipping`);
      return { applied: false, reason: "already_applied_recently", duplicateCount };
    }

    // 1) Insert transaction (late_fee)
    const txRes = await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1, $2, 'late_fee', $3, 'system', NOW())
      RETURNING id, amount, created_at
      `,
      [userId, loanId, LATE_FEE_AMOUNT]
    );
    const txRow = txRes.rows[0];
    console.log(`applyLateFeesIfNeeded: inserted transaction id=${txRow.id} amount=${txRow.amount}`);

    // 2) Insert into repayment_history flagged as late fee
    const rhRes = await client.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, created_at, is_late_fee)
      VALUES ($1, $2, $3, NOW(), TRUE)
      RETURNING id, amount, created_at
      `,
      [loanId, userId, LATE_FEE_AMOUNT]
    );
    const rhRow = rhRes.rows[0];
    console.log(`applyLateFeesIfNeeded: inserted repayment_history id=${rhRow.id} amount=${rhRow.amount}`);

    // 3) Recalculate remaining balance (using the client connection)
    // We call recalcLoanRemainingBalance but want to reuse client - easier to run same SQL here
    const totalPayableQ = await client.query(`SELECT COALESCE(total_payable, 0) AS total_payable FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
    const totalPayable = Number(totalPayableQ.rows[0]?.total_payable || 0);

    const paidQ = await client.query(`SELECT COALESCE(SUM(amount), 0) AS paid FROM repayment_history WHERE loan_id = $1`, [loanId]);
    const paid = Number(paidQ.rows[0]?.paid || 0);

    const newRemaining = Math.max(totalPayable - paid, 0);

    await client.query(
      `
      UPDATE loans
      SET remaining_balance = $1,
          status = CASE WHEN $1 <= 0 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $1 <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = $2
      `,
      [newRemaining, loanId]
    );

    await client.query("COMMIT");

    console.log(`applyLateFeesIfNeeded: applied late fee loanId=${loanId} new_remaining=${newRemaining}`);

    return {
      applied: true,
      amount: LATE_FEE_AMOUNT,
      transaction: txRow,
      repayment_history: rhRow,
      remaining_balance: newRemaining,
      lateCount,
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
