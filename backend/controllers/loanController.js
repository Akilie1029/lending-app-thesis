// =================================================================
//                 LOAN CONTROLLER (KAURta Project)
// =================================================================
const db = require('../db');

// --- Apply for Loan ---
exports.applyForLoan = async (req, res) => {
  try {
    const { amount_requested, purpose, repayment_term_months } = req.body;
    const userId = req.user.id;

    console.log(`💰 Loan application by user ${userId}: ₱${amount_requested} for ${purpose}`);

    // Validate input
    if (!amount_requested || !purpose || !repayment_term_months) {
      return res.status(400).json({ error: 'Missing loan details' });
    }

    const result = await db.query(
      `INSERT INTO loans (user_id, amount_requested, purpose, repayment_term_months, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [userId, amount_requested, purpose, repayment_term_months]
    );

    res.status(201).json({ message: 'Loan submitted successfully!', loan: result.rows[0] });
  } catch (err) {
    console.error('❌ Error in applyForLoan:', err.message);
    res.status(500).send('Server Error');
  }
};

// --- Get My Loans ---
exports.getMyLoans = async (req, res) => {
  try {
    const userId = req.user.id;
    const loansRes = await db.query(
      'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(loansRes.rows);
  } catch (err) {
    console.error('❌ Error in getMyLoans:', err.message);
    res.status(500).send('Server Error');
  }
};

// --- Admin: Get All Loans ---
exports.getAllLoans = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM loans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error in getAllLoans:', err.message);
    res.status(500).send('Server Error');
  }
};

// --- Admin: Approve Loan ---
exports.approveLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.query(
      "UPDATE loans SET status = 'approved' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('❌ Error in approveLoan:', err.message);
    res.status(500).send('Server Error');
  }
};

// --- Admin: Reject Loan ---
exports.rejectLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.query(
      "UPDATE loans SET status = 'rejected' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('❌ Error in rejectLoan:', err.message);
    res.status(500).send('Server Error');
  }
};
