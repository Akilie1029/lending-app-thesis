// services/repaymentEngine.js
const db = require("../db");

// ======================================================================
//     Repayment Engine (Used by payment routes & admin tools)
// ======================================================================
//
// FUNCTIONS INCLUDED:
//  ✔ recalcLoanRemainingBalance(loanId)
//  ✔ markOverdueInstallments(loanId)
//  ✔ applyLateFeesIfNeeded(loanId, userId)
// ======================================================================

// -----------------------------------------------
//  RECALCULATE REMAINING BALANCE FROM HISTORY
// -----------------------------------------------
async function recalcLoanRemainingBalance(loanId) {
  const loanQ = await db.query(`SELECT total_payable FROM loans WHERE id = $1`, [loanId]);
  if (loanQ.rows.length === 0) return null;

  const totalPayable = Number(loanQ.rows[0].total_payable);

  const paidQ = await db.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS paid
    FROM repayment_history
    WHERE loan_id = $1
    `,
    [loanId]
  );

  const paid = Number(paidQ.rows[0].paid);
  const remaining = Math.max(totalPayable - paid, 0);

  await db.query(
    `
    UPDATE loans
    SET remaining_balance = $1,
        status = CASE WHEN $1 <= 0 THEN 'completed' ELSE status END,
        completed_at = CASE WHEN $1 <= 0 THEN NOW() ELSE completed_at END
    WHERE id = $2
    `,
    [remaining, loanId]
  );

  return remaining;
}

// -----------------------------------------------
//       MARK OVERDUE INSTALLMENTS
// -----------------------------------------------
async function markOverdueInstallments(loanId) {
  const today = new Date().toISOString().slice(0, 10);

  await db.query(
    `
    UPDATE repayment_schedule
    SET overdue = TRUE
    WHERE loan_id = $1
      AND due_date::date < $2::date
      AND paid = FALSE
    `,
    [loanId, today]
  );
}

// -----------------------------------------------
//       APPLY LATE FEES IF NEEDED
// -----------------------------------------------
async function applyLateFeesIfNeeded(loanId, userId) {
  // Detect 2+ overdue installments
  const overdueQ = await db.query(
    `
    SELECT COUNT(*) AS late_count
    FROM repayment_schedule
    WHERE loan_id = $1
      AND paid = FALSE
      AND overdue = TRUE
    `,
    [loanId]
  );

  const lateCount = Number(overdueQ.rows[0].late_count);

  if (lateCount >= 2) {
    // Charge a flat ₱1000 late fee ONCE per overdue batch
    await db.query(
      `
      INSERT INTO transactions (user_id, loan_id, type, amount, payment_method)
      VALUES ($1, $2, 'late_fee', 1000, 'system')
      `,
      [userId, loanId]
    );

    await db.query(
      `
      INSERT INTO repayment_history (loan_id, user_id, amount, is_late_fee)
      VALUES ($1, $2, 1000, TRUE)
      `,
      [loanId, userId]
    );

    // Update loan balance
    await recalcLoanRemainingBalance(loanId);

    return { applied: true, amount: 1000 };
  }

  return { applied: false };
}

module.exports = {
  recalcLoanRemainingBalance,
  markOverdueInstallments,
  applyLateFeesIfNeeded,
};
