// backend/routes/loanDashboard.js
// New endpoints:
// GET  /api/users/loan-dashboard   -> returns monthlyDue, availableToWithdraw, loanSummary
// POST /api/users/withdraw        -> create a withdrawal of available loan funds (records a transaction)

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../authMiddleware');

/**
 * Helper: compute total repayment and monthly payment for KAURta Pay
 * Interest rule: monthlyRate = 0.20 (20% monthly)
 * totalRepayment = principal * (1 + monthlyRate * months)
 * monthlyPayment = totalRepayment / months
 */
function computeLoanAmounts(principal, months) {
  const monthlyRate = 0.2; // KAURta pay fixed 20% per month
  const totalRepayment = Number(principal) * (1 + monthlyRate * Number(months));
  const monthlyPayment = Number(months) > 0 ? totalRepayment / Number(months) : totalRepayment;
  return {
    totalRepayment: Number(totalRepayment.toFixed(2)),
    monthlyPayment: Number(monthlyPayment.toFixed(2)),
  };
}

// GET /api/users/loan-dashboard
// Returns the main values used on the borrower dashboard:
// - monthlyDue (this month's due payment; 0 if no active loan)
// - availableToWithdraw (amount the borrower can withdraw from disbursed loan(s))
// - loanSummary (principal, term, totalRepayment, monthlyPayment, status)
router.get('/loan-dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find the most relevant loan for dashboard (prefer active -> approved_pending_disburse -> pending)
    // Prioritize 'active' first. Use latest created if multiple.
    const loanQ = `
      SELECT *
      FROM loans
      WHERE user_id = $1
      ORDER BY
        CASE
          WHEN LOWER(status) = 'active' THEN 1
          WHEN LOWER(status) IN ('approved', 'approved_pending_disburse','approved_pending_disbursement') THEN 2
          WHEN LOWER(status) = 'pending' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT 1
    `;
    const loanRes = await db.query(loanQ, [userId]);

    if (loanRes.rows.length === 0) {
      // No loan for this user
      return res.json({
        monthlyDue: 0,
        availableToWithdraw: 0,
        loanSummary: null,
      });
    }

    const loan = loanRes.rows[0];
    const principal = Number(loan.amount_requested || 0);
    const months = Number(loan.repayment_term_months || 0);
    const status = (loan.status || '').toLowerCase();

    // Compute totals
    const { totalRepayment, monthlyPayment } = computeLoanAmounts(principal, months);

    // Compute availableToWithdraw:
    // Sum loan_disbursement transactions for this loan (may be 1 row) minus any withdrawal transactions tied to this loan.
    // If your system uses 'loan_disbursement' transaction type when the system credits the borrower's wallet,
    // and 'withdrawal' when the user actually withdraws funds to cash out, we compute:
    // available = SUM(loan_disbursement) - SUM(withdrawal where loan_id=loan.id)
    const disbRes = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS disb_sum FROM transactions WHERE loan_id = $1 AND LOWER(type) = 'loan_disbursement'`,
      [loan.id]
    );
    const withdrawnRes = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS w_sum FROM transactions WHERE loan_id = $1 AND LOWER(type) IN ('withdrawal','cash_withdrawal')`,
      [loan.id]
    );

    const disbSum = Number(disbRes.rows[0].disb_sum || 0);
    const wSum = Number(withdrawnRes.rows[0].w_sum || 0);
    const availableToWithdraw = Math.max(0, Number((disbSum - wSum).toFixed(2)));

    // Also provide "amountDueThisPeriod" — user wants monthlyDue to show on balance card
    // For active loans: monthlyPayment; for approved_pending_disburse: monthlyPayment (but not due yet)
    // For pending loans: monthlyDue = 0
    let monthlyDue = 0;
    if (status === 'active') {
      monthlyDue = monthlyPayment;
    } else if (status === 'approved' || status === 'approved_pending_disburse' || status === 'approved_pending_disbursement') {
      // If loan approved but not yet disbursed, UI might show upcoming due or 0 — we choose 0
      monthlyDue = 0;
    } else {
      monthlyDue = 0;
    }

    const loanSummary = {
      id: loan.id,
      principal,
      status,
      termMonths: months,
      totalRepayment,
      monthlyPayment,
      disbursedAt: loan.disbursed_at || null,
      approvedAt: loan.approved_at || null,
      createdAt: loan.created_at || null,
    };

    return res.json({
      monthlyDue: Number(monthlyDue.toFixed(2)),
      availableToWithdraw,
      loanSummary,
    });
  } catch (err) {
    console.error('❌ /loan-dashboard error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/users/withdraw
// Body: { loanId, amount }
// Creates a 'withdrawal' transaction tied to loan_id and ensures amount <= availableToWithdraw
router.post('/withdraw', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { loanId, amount } = req.body;

  if (!loanId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ message: 'loanId and positive amount are required' });
  }

  // run in a transaction to avoid race conditions
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock loan row
    const loanRes = await client.query('SELECT id, amount_requested FROM loans WHERE id = $1 FOR UPDATE', [loanId]);
    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Loan not found' });
    }

    // compute available for that loan
    const disbRes = await client.query(`SELECT COALESCE(SUM(amount),0) as disb_sum FROM transactions WHERE loan_id = $1 AND LOWER(type) = 'loan_disbursement'`, [loanId]);
    const wRes = await client.query(`SELECT COALESCE(SUM(amount),0) as w_sum FROM transactions WHERE loan_id = $1 AND LOWER(type) IN ('withdrawal','cash_withdrawal')`, [loanId]);

    const disbSum = Number(disbRes.rows[0].disb_sum || 0);
    const wSum = Number(wRes.rows[0].w_sum || 0);
    const available = Math.max(0, disbSum - wSum);

    if (Number(amount) > available) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient available funds to withdraw', available });
    }

    // Insert withdrawal transaction (ties to loan_id)
    await client.query(
      `INSERT INTO transactions (type, amount, created_at, user_id, loan_id)
       VALUES ('withdrawal', $1, NOW(), $2, $3)`,
      [amount, userId, loanId]
    );

    await client.query('COMMIT');
    return res.json({ message: 'Withdrawal successful', withdrawn: Number(amount) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Withdraw error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
