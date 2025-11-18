// backend/routes/admin.js
const express = require("express");
const router = express.Router();

const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

router.get(
  "/dashboard-stats",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // ============================================================
      // 👥 BORROWER COUNT
      // ============================================================
      const borrowerRes = await db.query(
        "SELECT COUNT(*) FROM users WHERE LOWER(role) = 'borrower'"
      );
      const borrowerCount = Number(borrowerRes.rows[0].count);

      // ============================================================
      // 📌 ACTIVE LOANS (ACTIVE = disbursed)
      // ============================================================
      const activeLoanRes = await db.query(
        "SELECT COUNT(*) FROM loans WHERE LOWER(status) = 'active'"
      );
      const activeLoanCount = Number(activeLoanRes.rows[0].count);

      // ============================================================
      // ❌ REJECTED LOANS
      // ============================================================
      const rejectedRes = await db.query(
        "SELECT COUNT(*) FROM loans WHERE LOWER(status) = 'rejected'"
      );
      const rejectedCount = Number(rejectedRes.rows[0].count);

      // ============================================================
      // ⏳ PENDING LOAN APPROVALS
      // ============================================================
      const pendingApprovalRes = await db.query(
        "SELECT COUNT(*) FROM loans WHERE LOWER(status) = 'pending'"
      );
      const pendingLoanApproval = Number(pendingApprovalRes.rows[0].count);

      // ============================================================
      // ⏳ PENDING DISBURSEMENT (Approved but not yet disbursed)
      // ============================================================
      const pendingDisRes = await db.query(
        `
        SELECT COUNT(*) 
        FROM loans 
        WHERE LOWER(status) IN ('approved', 'approved_pending_disburse')
        `
      );
      const pendingDisbursement = Number(pendingDisRes.rows[0].count);

      // ============================================================
      // 💸 TOTAL DISBURSED LOAN AMOUNT
      // ============================================================
      const totalDisbursedRes = await db.query(
        `
        SELECT COALESCE(SUM(amount_requested), 0) AS total
        FROM loans 
        WHERE LOWER(status) = 'active'
        `
      );
      const totalDisbursedLoan = Number(totalDisbursedRes.rows[0].total);

      // ============================================================
      // 🥧 LOAN STATUS DISTRIBUTION (REAL VALUES)
      // ============================================================

      // UNPAID = active loans with no payments yet OR balance > 0
      const unpaidRes = await db.query(`
        SELECT COALESCE(SUM(l.amount_requested),0) AS total
        FROM loans l
        LEFT JOIN transactions t ON t.loan_id = l.id AND LOWER(t.type) = 'loan_payment'
        WHERE LOWER(l.status) = 'active'
      `);
      const unpaidAmount = Number(unpaidRes.rows[0].total);

      // PAID = loans fully paid (no balance)
      // For now: assume REJECTED + APPROVED but not disbursed = not paid
      const paidRes = await db.query(`
        SELECT COALESCE(SUM(amount_requested),0) AS total
        FROM loans 
        WHERE LOWER(status) = 'paid'
      `);
      const paidAmount = Number(paidRes.rows[0]?.total || 0);

      // OVERDUE = ACTIVE loans with missed payments
      const overdueRes = await db.query(`
        SELECT COALESCE(SUM(amount_requested),0) AS total
        FROM loans
        WHERE LOWER(status) = 'overdue'
      `);
      const overdueAmount = Number(overdueRes.rows[0]?.total || 0);

      // ============================================================
      // 💰 PAYMENT OVERVIEW (REAL VALUES)
      // ============================================================

      const collectiblesRes = await db.query(`
        SELECT COALESCE(SUM(amount_requested),0) AS total
        FROM loans
        WHERE LOWER(status) = 'active'
      `);

      const actualPaymentsRes = await db.query(`
        SELECT COALESCE(SUM(amount),0) AS total
        FROM transactions
        WHERE LOWER(type) = 'loan_payment'
      `);

      const paymentOverview = {
        collectiblesToday: Number(collectiblesRes.rows[0].total),
        actualPayments: Number(actualPaymentsRes.rows[0].total)
      };

      // ============================================================
      // 📊 WEEKLY COLLECTIONS (LAST 7 DAYS)
      // ============================================================
      const weeklyRes = await db.query(`
        SELECT 
          TO_CHAR(created_at, 'Dy') AS label,
          SUM(amount) AS total
        FROM transactions
        WHERE LOWER(type) = 'loan_payment'
        GROUP BY 1
        ORDER BY MIN(created_at) DESC
        LIMIT 7
      `);

      const weeklyCollections = weeklyRes.rows.map(r =>
        Number(r.total || 0)
      ).reverse();

      // ============================================================
      // 📉 DAILY REPAYMENTS (SPARKLINE)
      // ============================================================
      const dailyRes = await db.query(`
        SELECT SUM(amount) AS total
        FROM transactions
        WHERE LOWER(type) = 'loan_payment'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY MIN(created_at) DESC
        LIMIT 10
      `);

      const dailyRepayments = dailyRes.rows.map(r =>
        Number(r.total || 0)
      ).reverse();

      // ============================================================
      // 📬 RESPONSE
      // ============================================================
      res.json({
        borrowerCount,
        activeLoanCount,
        rejectedCount,
        pendingLoanApproval,
        pendingDisbursement,
        totalDisbursedLoan,

        loanStatusDistribution: {
          unpaidAmount,
          paidAmount,
          overdueAmount
        },

        paymentOverview,
        weeklyCollections,
        dailyRepayments
      });

    } catch (err) {
      console.error("❌ Dashboard Error:", err);
      res.status(500).json({ error: "Server Error", details: err.message });
    }
  }
);

module.exports = router;
