// services/repaymentEngine.js
const db = require("../db");

// Safe numeric helper
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance AND repayment day progress
 *
 * Authoritative rules:
 * - remaining_balance = approved_total_payable - total_repaid
 * - days_completed = FLOOR(total_repaid / approved_daily_payment)
 * - remaining_days = GREATEST(days - days_completed, 0)
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
    // Fetch authoritative loan data
    const loanQ = await q.query(
      `
      SELECT
        id,
        days,
        approved_daily_payment,
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

    const loan = loanQ.rows[0];

    const payable = num(loan.payable);
    const dailyPayment = num(loan.approved_daily_payment);
    const totalDays = num(loan.days);

    // Sum all repayments (including overpayments)
    const paidQ = await q.query(
      `
      SELECT COALESCE(SUM(amount),0) AS paid
      FROM repayment_history
      WHERE loan_id = $1
      `,
      [loanId]
    );

    const totalRepaid = num(paidQ.rows[0].paid);

    // Monetary calculation
    const remainingBalance = Math.max(payable - totalRepaid, 0);

    // Day progress calculation (NO FRACTIONS)
    let daysCompleted = 0;
    if (dailyPayment > 0) {
      daysCompleted = Math.floor(totalRepaid / dailyPayment);
    }

    const remainingDays = Math.max(totalDays - daysCompleted, 0);

    // Persist authoritative values
    await q.query(
      `
      UPDATE loans
      SET
        remaining_balance = $1::numeric,
        total_repaid = $2::numeric,
        remaining_days = $3::int,
        status = CASE
          WHEN $1::numeric <= 0 THEN 'completed'
          ELSE status
        END,
        completed_at = CASE
          WHEN $1::numeric <= 0 THEN COALESCE(completed_at, NOW())
          ELSE completed_at
        END
      WHERE id = $4
      `,
      [remainingBalance, totalRepaid, remainingDays, loanId]
    );

    console.log(
      `recalcLoanRemainingBalance: loanId=${loanId} paid=${totalRepaid} remaining=${remainingBalance} daysCompleted=${daysCompleted}/${totalDays}`
    );

    return {
      remaining_balance: remainingBalance,
      total_repaid: totalRepaid,
      remaining_days: remainingDays,
      days_completed: daysCompleted,
    };
  } catch (err) {
    console.error("❌ recalcLoanRemainingBalance ERROR:", err);
    throw err;
  }
}

/**
 * Overdue marking unchanged
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

    return { updated: res.rowCount, ids: res.rows.map((r) => r.id) };
  } catch (err) {
    console.error("❌ markOverdueInstallments ERROR:", err);
    throw err;
  }
}

/**
 * Late fees logic unchanged
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

    await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1,$2,'late_fee',$3,'system',NOW())
      `,
      [userId, loanId, AMOUNT]
    );

    await client.query(
      `
      INSERT INTO repayment_history (loan_id,user_id,amount,is_late_fee,created_at)
      VALUES ($1,$2,$3,TRUE,NOW())
      `,
      [loanId, userId, AMOUNT]
    );

    // Recalculate using the same authoritative logic
    await recalcLoanRemainingBalance(loanId, client);

    await client.query("COMMIT");

    return { applied: true, lateCount };
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
