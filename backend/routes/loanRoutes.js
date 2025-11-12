// =================================================================
//                 LOAN ROUTES (KAURta Project)
// =================================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../authMiddleware');
const adminMiddleware = require('../adminMiddleware');
const loanController = require('../controllers/loanController');

// --- User routes ---
router.post('/apply', authMiddleware, loanController.applyForLoan);
router.get('/my-loans', authMiddleware, loanController.getMyLoans);

// --- Admin routes ---
router.get('/admin/loans', [authMiddleware, adminMiddleware], loanController.getAllLoans);
router.post('/admin/loans/:id/approve', [authMiddleware, adminMiddleware], loanController.approveLoan);
router.post('/admin/loans/:id/reject', [authMiddleware, adminMiddleware], loanController.rejectLoan);

module.exports = router;
