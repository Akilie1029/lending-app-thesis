// services/repaymentEngine.js
const db = require("../db");

// Safe numeric helper
const num = (v) => (v == null ? 0 : Number(v));

/**
 * Recalculate remaining balance AND repayment day progress
 *
 * Authoritative rules:
 * - remaining_balance = approved_total_payable - total_repaid
 * - total_repaid EXCLUDES late fees
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

    if (!loanQ.rows.length) return null;

    const loan = loanQ.rows[0];

    const payable = num(loan.payable);
    const dailyPayment = num(loan.approved_daily_payment);
    const totalDays = num(loan.days);

    // ❗ EXCLUDE late fees from repayment progress
    const paidQ = await q.query(
      `
      SELECT COALESCE(SUM(amount),0) AS paid
      FROM repayment_history
      WHERE loan_id = $1
        AND is_late_fee = FALSE
      `,
      [loanId]
    );

    const totalRepaid = num(paidQ.rows[0].paid);
    const remainingBalance = Math.max(payable - totalRepaid, 0);

    let daysCompleted = 0;
    if (dailyPayment > 0) {
      daysCompleted = Math.floor(totalRepaid / dailyPayment);
    }

    const remainingDays = Math.max(totalDays - daysCompleted, 0);

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
 * Mark overdue installments (unchanged behavior)
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
        AND due_date::date < $2::date
        AND status NOT IN ('paid','overdue')
      RETURNING id
      `,
      [loanId, today]
    );

    return { updated: res.rowCount };
  } catch (err) {
    console.error("❌ markOverdueInstallments ERROR:", err);
    throw err;
  }
}

/**
 * ✅ KAURta Late Fee Engine (BLOCK-RESET MODEL — AUTHORITATIVE)
 */
async function applyLateFeesIfNeeded(loanId, userId, opts = {}) {
  if (!loanId || !userId) return { applied: false };

  const LATE_FEE = opts.lateFeeAmount || 1000;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const loanQ = await client.query(
      `
      SELECT
        id,
        days,
        approved_daily_payment,
        approved_total_payable,
        latest_due_date,
        late_blocks_applied
      FROM loans
      WHERE id = $1
      FOR UPDATE
      `,
      [loanId]
    );

    if (!loanQ.rows.length || !loanQ.rows[0].latest_due_date) {
      await client.query("ROLLBACK");
      return { applied: false };
    }

    const loan = loanQ.rows[0];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(loan.latest_due_date);
    due.setHours(0, 0, 0, 0);

    const daysLate = Math.floor((today - due) / 86400000);

    if (daysLate < 2) {
      await client.query("ROLLBACK");
      return { applied: false, daysLate };
    }

    const blocksShouldExist = Math.floor(daysLate / 2);
    const blocksApplied = num(loan.late_blocks_applied);
    const blocksToApply = blocksShouldExist - blocksApplied;

    if (blocksToApply <= 0) {
      await client.query("ROLLBACK");
      return { applied: false, daysLate };
    }

    const addedAmount = blocksToApply * LATE_FEE;
    const newTotalPayable = num(loan.approved_total_payable) + addedAmount;
    const newDailyPayment = Math.ceil(newTotalPayable / num(loan.days));

    // Audit records
    await client.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method, created_at)
      VALUES ($1,$2,'late_fee',$3,'system',NOW())
      `,
      [userId, loanId, addedAmount]
    );

    // ✅ FIX: type is now explicitly set
    await client.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, type, is_late_fee, created_at)
      VALUES ($1, $2, $3, 'late_fee', TRUE, NOW())
      `,
      [loanId, userId, addedAmount]
    );

    await client.query(
      `
      UPDATE loans
      SET
        approved_total_payable = $1,
        approved_daily_payment = $2,
        late_blocks_applied = late_blocks_applied + $3
      WHERE id = $4
      `,
      [newTotalPayable, newDailyPayment, blocksToApply, loanId]
    );

    await recalcLoanRemainingBalance(loanId, client);

    await client.query("COMMIT");

    return {
      applied: true,
      daysLate,
      blocksApplied: blocksToApply,
      addedAmount,
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
