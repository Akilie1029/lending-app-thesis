// backend/routes/adminLoanApprovals.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // your pg pool wrapper
const adminMiddleware = require('../adminMiddleware'); // ensure this is correct
const authMiddleware = require('../authMiddleware'); // require auth too

// GET /api/admin/loan-approvals
// Returns loans that are pending approval
router.get('/loan-approvals', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Accept a few common textual statuses to be robust
    const q = `
      SELECT l.id, l.user_id, u.full_name, l.amount_requested, l.purpose,
             l.repayment_term_months, l.status, l.created_at
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE LOWER(l.status) IN ('pending', 'pending_approval', 'pendingapproval')
      ORDER BY l.created_at DESC
    `;
    const result = await db.query(q);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /admin/loan-approvals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/loan-approvals/:id/approve
router.post('/loan-approvals/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  const loanId = req.params.id;
  // Optionally accept notes in the body
  const { note } = req.body || {};
  try {
    // Update status to approved (use the status value consistent with your app)
    // Here we set to APPROVED_PENDING_DISBURSE (matches earlier code) and fallback to 'approved'
    const updateQ = `
      UPDATE loans
      SET status = 'APPROVED_PENDING_DISBURSE'
      WHERE id = $1
      RETURNING id, user_id, amount_requested, purpose, repayment_term_months, status, created_at
    `;
    const updated = await db.query(updateQ, [loanId]);
    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Optionally: insert a transaction/event log (not required)
    // await db.query(`INSERT INTO events (loan_id, type, note, created_at) VALUES ($1,'APPROVED',$2,NOW())`, [loanId, note]);

    res.json({ message: 'Loan approved', loan: updated.rows[0] });
  } catch (err) {
    console.error('❌ POST /admin/loan-approvals/:id/approve error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/loan-approvals/:id/reject
router.post('/loan-approvals/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  const loanId = req.params.id;
  const { note } = req.body || {};
  try {
    const updateQ = `
      UPDATE loans
      SET status = 'REJECTED'
      WHERE id = $1
      RETURNING id, user_id, amount_requested, purpose, repayment_term_months, status, created_at
    `;
    const updated = await db.query(updateQ, [loanId]);
    if (updated.rows.length === 0) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Optionally log rejection reason
    // await db.query(`INSERT INTO events (loan_id, type, note, created_at) VALUES ($1,'REJECTED',$2,NOW())`, [loanId, note]);

    res.json({ message: 'Loan rejected', loan: updated.rows[0] });
  } catch (err) {
    console.error('❌ POST /admin/loan-approvals/:id/reject error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
