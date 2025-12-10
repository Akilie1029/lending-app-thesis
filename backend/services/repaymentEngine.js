const db = require("../db");

// Helper to safely convert DB values to number
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance using repayment_history sums and update loan row.
 * Also set loan.status = 'completed' if remaining <= 0 and set completed_at.
 */
async function recalcLoanRemainingBalance(loanId) {
  if (!loanId) {
    console.warn("recalcLoanRemainingBalance called without loanId");
    return null;
  }
  try {
    const loanQ = await db.query(
      `SELECT id, total_payable FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );
    if (loanQ.rows.length === 0) {
      console.warn("recalcLoanRemainingBalance: loan not found", loanId);
      return null;
    }

    const totalPayable = num(loanQ.rows[0].total_payable);

    const paidQ = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );
    const paid = num(paidQ.rows[0]?.paid);

    const remaining = Math.max(totalPayable - paid, 0);

    // *** FIXED: cast all $1 references to numeric ***
    await db.query(
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
 */
async function markOverdueInstallments(loanId) {
  if (!loanId) {
    console.warn("markOverdueInstallments called without loanId");
    return { updated: 0 };
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

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

    console.log(
      `markOverdueInstallments: loanId=${loanId} marked=${res.rowCount}`
    );
    return { updated: res.rowCount, ids: res.rows.map((r) => r.id) };
  } catch (err) {
    console.error("❌ markOverdueInstallments ERROR:", err);
    throw err;
  }
}

/**
 * Apply late fees when threshold of overdue installments is met.
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

    const totalQ = await client.query(
      `SELECT COALESCE(total_payable,0) AS total_payable FROM loans WHERE id = $1 LIMIT 1`,
      [loanId]
    );

    const paidQ = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );

    const remaining = Math.max(
      Number(totalQ.rows[0].total_payable) - Number(paidQ.rows[0].paid),
      0
    );

    // *** FIXED: cast to numeric ***
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

    return {
      applied: true,
      amount: LATE_FEE_AMOUNT,
      remaining_balance: remaining,
      lateCount
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ applyLateFeesIfNeeded ERROR:", err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  recalcLoanRemainingBalance,
  markOverdueInstallments,
  applyLateFeesIfNeeded,
};
