// services/repaymentEngine.js
const db = require("../db");

// Safe numeric helper
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance using:
 *  → approved_total_payable (if present)
 *  → otherwise total_payable
 *
 * Always use the provided client when inside a transaction.
 */
async function recalcLoanRemainingBalance(loanId, client = null) {
  if (!loanId) {
    console.warn("recalcLoanRemainingBalance called without loanId");
    return null;
  }

  const q = client && typeof client.query === "function" ? client : db;

  try {
    // Fetch correct payable value
    const loanQ = await q.query(
      `
      SELECT
        id,
        COALESCE(approved_total_payable, total_payable) AS payable
      FROM loans
      WHERE id = $1
      LIMIT 1
      `,
      [loanId]
    );

    if (!loanQ.rows.length) {
      console.warn("recalcLoanRemainingBalance: loan not found", loanId);
      return null;
    }

    const payable = num(loanQ.rows[0].payable);

    // Sum all payments (repayment_history)
    const paidQ = await q.query(
      `SELECT COALESCE(SUM(amount),0) AS paid FROM repayment_history WHERE loan_id = $1`,
      [loanId]
    );

    const paid = num(paidQ.rows[0].paid);
    const remaining = Math.max(payable - paid, 0);

    // Update loan
    await q.query(
      `
      UPDATE loans
      SET 
        remaining_balance = $1::numeric,
        status = CASE WHEN $1::numeric <= 0 THEN 'completed' ELSE status END,
        completed_at = CASE WHEN $1::numeric <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = $2
      `,
      [remaining, loanId]
    );

    console.log(
      `recalcLoanRemainingBalance: loanId=${loanId} approved/payable=${payable} paid=${paid} remaining=${remaining}`
    );

    return remaining;
  } catch (err) {
    console.error("❌ recalcLoanRemainingBalance ERROR:", err);
    throw err;
  }
}

/**
 * Overdue marking stays unchanged
 */
async function markOverdueInstallments(loanId) {
  if (!loanId) return { updated: 0 };

  try {
    const today = new Date().toISOString().slice(0, 10);

    const res = await db.query(
      `
      UPDATE repayment_schedule
      SET status='overdue'
      WHERE loan_id = $1
        AND (due_date::date) < $2::date
        AND status != 'paid'
        AND status != 'overdue'
      RETURNING id
      `,
      [loanId, today]
    );

    return { updated: res.rowCount, ids: res.rows.map(r => r.id) };
  } catch (err) {
    console.error("❌ markOverdueInstallments ERROR:", err);
    throw err;
  }
}

/**
 * Late fees unchanged EXCEPT recalculation now uses approved_total_payable
 */
async function applyLateFeesIfNeeded(loanId, userId, opts = {}) {
  if (!loanId || !userId) return { applied: false };

  const AMOUNT = opts.lateFeeAmount || 1000;
  const TH = opts.threshold || 2;

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const overdueQ = await client.query(
      `SELECT COUNT(*)::int AS late_count FROM repayment_schedule WHERE loan_id=$1 AND status='overdue'`,
      [loanId]
    );

    const lateCount = Number(overdueQ.rows[0].late_count || 0);
    if (lateCount < TH) {
      await client.query("ROLLBACK");
      return { applied: false, reason: "not_enough_overdue" };
    }

    // Insert transaction
    await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1,$2,'late_fee',$3,'system',NOW())
      `,
      [userId, loanId, AMOUNT]
    );

    // Insert repayment_history
    await client.query(
      `
      INSERT INTO repayment_history (loan_id,user_id,amount,is_late_fee,created_at)
      VALUES ($1,$2,$3,TRUE,NOW())
      `,
      [loanId, userId, AMOUNT]
    );

    // Recalculate via same logic
    const payQ = await client.query(
      `
      SELECT COALESCE(approved_total_payable, total_payable) AS payable
      FROM loans WHERE id=$1 LIMIT 1
      `,
      [loanId]
    );

    const payable = num(payQ.rows[0].payable);

    const paidQ = await client.query(
      `SELECT COALESCE(SUM(amount),0) AS paid FROM repayment_history WHERE loan_id=$1`,
      [loanId]
    );

    const paid = num(paidQ.rows[0].paid);
    const remaining = Math.max(payable - paid, 0);

    await client.query(
      `
      UPDATE loans
      SET remaining_balance=$1::numeric,
          status = CASE WHEN $1::numeric <= 0 THEN 'completed' ELSE status END,
          completed_at = CASE WHEN $1::numeric <= 0 THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id=$2
      `,
      [remaining, loanId]
    );

    await client.query("COMMIT");

    return {
      applied: true,
      lateCount,
      remaining_balance: remaining
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
