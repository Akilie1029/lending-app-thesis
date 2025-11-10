// =================================================================
//                      IMPORTS & CONFIGURATION
// =================================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assumes db.js is in the same folder
const authMiddleware = require('./authMiddleware'); // Our token checker
const adminMiddleware = require('./adminMiddleware'); // Our role checker

const app = express();
const PORT = 5001;

// --- IMPORTANT: The single source of truth for our secret key ---
const JWT_SECRET = 'a_super_secret_key_that_should_be_long_and_random';

// =================================================================
//                            MIDDLEWARE
// =================================================================

app.use(cors());
app.use(express.json());

// =================================================================
//                        PUBLIC API ROUTES
// =================================================================

// --- User Registration ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already in use.' });
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const newUser = await db.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, role',
      [fullName, email, passwordHash]
    );
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(`Error in /register: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// --- User Login ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const user = userResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(`Error in /login: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// =================================================================
//                   PROTECTED USER API ROUTES
// =================================================================

// --- Get Current User Info ---
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [
      req.user.id,
    ]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(`Error in /me: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// --- Apply for a Loan ---
app.post('/api/loans/apply', authMiddleware, async (req, res) => {
  try {
    const { amount, purpose, term } = req.body;
    const userId = req.user.id;
    const newLoan = await db.query(
      'INSERT INTO loans (user_id, amount_requested, purpose, repayment_term_months) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, amount, purpose, term]
    );
    res.status(201).json(newLoan.rows[0]);
  } catch (err) {
    console.error(`Error in /apply: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// GET /api/loans/my-loans - PROTECTED
// Fetches all loans for the currently logged-in user.
app.get('/api/loans/my-loans', authMiddleware, async (req, res) => {
  try {
    const userLoans = await db.query(
      'SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(userLoans.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// =================================================================
//                    PROTECTED ADMIN API ROUTES
// =================================================================

// --- Get All Loan Applications ---
app.get('/api/admin/loans', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const allLoans = await db.query('SELECT * FROM loans ORDER BY created_at DESC');
    res.json(allLoans.rows);
  } catch (err) {
    console.error(`Error in /admin/loans: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// --- Approve a Loan ---
app.post('/api/admin/loans/:id/approve', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;
    const updatedLoan = await db.query(
      "UPDATE loans SET status = 'approved' WHERE id = $1 RETURNING *",
      [id]
    );
    if (updatedLoan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found' });
    }
    res.json(updatedLoan.rows[0]);
  } catch (err) {
    console.error(`Error in /approve: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// --- Reject a Loan ---
app.post('/api/admin/loans/:id/reject', [authMiddleware, adminMiddleware], async (req, res) => {
  try {
    const { id } = req.params;
    const updatedLoan = await db.query(
      "UPDATE loans SET status = 'rejected' WHERE id = $1 RETURNING *",
      [id]
    );
    if (updatedLoan.rows.length === 0) {
      return res.status(404).json({ msg: 'Loan not found' });
    }
    res.json(updatedLoan.rows[0]);
  } catch (err) {
    console.error(`Error in /reject: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// =================================================================
//                          START SERVER
// =================================================================
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is reachable ✅" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

