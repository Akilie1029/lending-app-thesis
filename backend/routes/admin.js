const express = require('express');
const router = express.Router();

const db = require('../db');
const authMiddleware = require('../authMiddleware');
const adminMiddleware = require('../adminMiddleware');

router.get(
  '/dashboard-stats',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // Borrower count (lowercase because DB uses lowercase)
      const borrowerCountRes = await db.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'borrower'"
      );
      const borrowerCount = Number(borrowerCountRes.rows[0].count);

      // Active loans = approved loans
      const activeLoanCountRes = await db.query(
        "SELECT COUNT(*) AS count FROM loans WHERE status = 'approved'"
      );
      const activeLoanCount = Number(activeLoanCountRes.rows[0].count);

      // Rejected loans = none yet
      const rejectedCount = 0;

      // Loan status distribution
      const pendingLoanRes = await db.query(
        "SELECT COUNT(*) AS count FROM loans WHERE status = 'pending'"
      );
      const approvedLoanRes = await db.query(
        "SELECT COUNT(*) AS count FROM loans WHERE status = 'approved'"
      );

      // Payment overview — no payments table yet
      const collectiblesToday = 0;
      const actualPayments = 0;

      // Pending Approvals = pending
      const pendingLoanApproval = Number(pendingLoanRes.rows[0].count);

      // Pending Disbursement — not implemented yet
      const pendingDisbursement = 0;

      // Total disbursed loan = sum of approved loans
      const totalDisbursedRes = await db.query(
        "SELECT COALESCE(SUM(amount_requested),0) AS total FROM loans WHERE status = 'approved'"
      );
      const totalDisbursedLoan = Number(totalDisbursedRes.rows[0].total);

      res.json({
        borrowerCount,
        activeLoanCount,
        rejectedCount,

        loanStatusDistribution: {
          unpaidAmount: Number(pendingLoanRes.rows[0].count),   // pending = unpaid
          paidAmount: Number(approvedLoanRes.rows[0].count),     // approved = completed
          overdueAmount: 0,                                      // not implemented
        },

        paymentOverview: {
          collectiblesToday,
          actualPayments,
        },

        pendingLoanApproval,
        pendingDisbursement,
        totalDisbursedLoan,
      });

    } catch (error) {
      console.error("❌ Admin Dashboard Error:", error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
