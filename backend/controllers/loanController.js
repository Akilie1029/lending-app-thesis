// backend/controllers/loanController.js
const db = require("../db");

// Apply for loan (controller style)
exports.applyForLoan = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      principal,
      days,
      purpose,
      full_name,
      date_of_birth,
      address,
      phone_number,
      employment_status,
      company_name,
      monthly_income_range,
      payout_method,
      payout_details,
      government_id_local_uri,
      selfie_with_id_local_uri,
      proof_of_funds_local_uri,
    } = req.body;

    if (!principal || !purpose || !days) {
      return res.status(400).json({ error: "MISSING_FIELDS", message: "principal, days and purpose required" });
    }

    const existing = await db.query("SELECT id FROM loans WHERE user_id = $1 AND LOWER(COALESCE(status,'')) = 'active' LIMIT 1", [userId]);
    if (existing.rows.length) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    const result = await db.query(
      `INSERT INTO loans (
        id, user_id, amount_requested, principal, days, purpose,
        status, created_at,
        full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        payout_method, payout_details,
        gov_id_uri, selfie_id_uri, proof_uri
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        'pending', NOW(),
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14,
        $15, $16, $17
      ) RETURNING *`,
      [
        userId,
        principal, principal, days, purpose,
        full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        payout_method, payout_details,
        government_id_local_uri, selfie_with_id_local_uri, proof_of_funds_local_uri,
      ]
    );

    return res.status(201).json({ message: "Loan submitted successfully!", loan: result.rows[0] });
  } catch (err) {
    console.error("❌ Error in applyForLoan:", err);
    return res.status(500).json({ error: "Server Error", message: err.message });
  }
};

exports.getMyLoans = async (req, res) => {
  try {
    const userId = req.user.id;
    const loansRes = await db.query('SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(loansRes.rows);
  } catch (err) {
    console.error('❌ Error in getMyLoans:', err);
    res.status(500).send('Server Error');
  }
};

exports.getAllLoans = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM loans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error in getAllLoans:', err);
    res.status(500).send('Server Error');
  }
};

exports.approveLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.query("UPDATE loans SET status = 'approved_pending_disburse', approved_at = NOW() WHERE id = $1 RETURNING *", [id]);
    if (!updated.rows.length) return res.status(404).json({ message: "Loan not found" });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('❌ Error in approveLoan:', err);
    res.status(500).send('Server Error');
  }
};

exports.rejectLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.query("UPDATE loans SET status = 'rejected', notes = COALESCE(notes, '') || $2 WHERE id = $1 RETURNING *", [id, req.body.note || '']);
    if (!updated.rows.length) return res.status(404).json({ message: "Loan not found" });
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('❌ Error in rejectLoan:', err);
    res.status(500).send('Server Error');
  }
};
