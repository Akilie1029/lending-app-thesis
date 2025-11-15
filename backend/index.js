// =================================================================
//                          IMPORTS & CONFIG
// =================================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Postgres pool wrapper

const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');

// --- Modular Routes ---
const loanRoutes = require('./routes/loanRoutes'); // User loan actions
const adminRoutes = require('./routes/admin'); // Admin dashboard (stats)
const adminLoanApprovals = require('./routes/adminLoanApprovals'); // NEW
const adminDisbursement = require('./routes/adminDisbursement');


const app = express();
const PORT = 5001;

// JWT secret (store in .env for production)
const JWT_SECRET = 'a_super_secret_key_that_should_be_long_and_random';


// =================================================================
//                              MIDDLEWARE
// =================================================================

app.use(cors());
app.use(express.json());


// =================================================================
//                        AUTHENTICATION ROUTES
// =================================================================

// --- User Registration ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const full_name = (req.body.full_name || req.body.fullName || '').trim();
    const { email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await db.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, role',
      [full_name, email, passwordHash]
    );

    const payload = { user: { id: newUser.rows[0].id, role: newUser.rows[0].role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      message: 'User registered successfully!',
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error(`❌ Register Error: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// --- Login ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const payload = { user: { id: user.id, role: user.role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (err) {
    console.error(`❌ Login Error: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// --- Get Current Authenticated User ---
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(user.rows[0]);
  } catch (err) {
    console.error(`❌ /me Error: ${err.message}`);
    res.status(500).send('Server Error');
  }
});


// =================================================================
//                        USER (BORROWER) ROUTES
// =================================================================

app.use('/api/loans', loanRoutes);


// =================================================================
//                           ADMIN ROUTES
// =================================================================

// Admin Dashboard (stats)
app.use('/api/admin', adminRoutes);

// Admin Loan Approvals (approve/reject)
app.use('/api/admin', adminLoanApprovals);

// Admin Loan Disbursement
app.use("/api/admin", adminDisbursement);

// =================================================================
//                      USER DASHBOARD ENDPOINTS
// =================================================================

// --- User Balance ---
app.get('/api/users/balance', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const balanceRes = await db.query(
      `SELECT COALESCE(SUM(
        CASE
          WHEN LOWER(type) IN ('deposit','cash_deposit','cash deposit') THEN amount
          WHEN LOWER(type) IN ('withdrawal','cash_withdrawal','withdraw') THEN -amount
          WHEN LOWER(type) IN ('loan_disbursement','loan_issued') THEN amount
          WHEN LOWER(type) IN ('loan_payment','loan payment') THEN -amount
          ELSE 0
        END
      ), 0) AS balance
      FROM transactions
      WHERE user_id = $1`,
      [userId]
    );

    res.json({ balance: Number(balanceRes.rows[0].balance || 0) });
  } catch (err) {
    console.error(`❌ Balance Error: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// --- User Transaction History ---
app.get('/api/transactions/my', authMiddleware, async (req, res) => {
  try {
    const txRes = await db.query(
      'SELECT id, type, amount, loan_id, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [req.user.id]
    );

    res.json(txRes.rows);
  } catch (err) {
    console.error(`❌ Transactions Error: ${err.message}`);
    res.status(500).send('Server Error');
  }
});


// =================================================================
//                              TEST ROUTE
// =================================================================

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable ✅' });
});


// =================================================================
//                           START SERVER
// =================================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://192.168.1.222:${PORT}`);
});
