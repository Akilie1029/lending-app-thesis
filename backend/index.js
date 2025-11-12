// server.js (refactored for modular routes)
// =================================================================
//                      IMPORTS & CONFIGURATION
// =================================================================

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db'); // your Postgres wrapper (pg pool)
const authMiddleware = require('./authMiddleware');
const adminMiddleware = require('./adminMiddleware');

// --- Import new modular routes ---
const loanRoutes = require('./routes/loanRoutes'); // ✅ NEW modular loan routes

const app = express();
const PORT = 5001;

// single source of truth for JWT secret (store in env in production)
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
    const full_name = (req.body.full_name || req.body.fullName || '').trim();
    const { email, password } = req.body;

    console.log('📩 New registration request:', { full_name, email });

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, role',
      [full_name, email, passwordHash]
    );

    const payload = { user: { id: newUser.rows[0].id, role: newUser.rows[0].role } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    console.log(`✅ User registered successfully: ${email}`);

    res.status(201).json({
      message: 'User registered successfully!',
      token,
      user: newUser.rows[0],
    });
  } catch (err) {
    console.error(`❌ Error in /register: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// --- User Login ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔑 Login attempt:', email);

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

    console.log(`✅ Login successful for: ${email}`);
    res.json({ token });
  } catch (err) {
    console.error(`❌ Error in /login: ${err.message}`);
    res.status(500).send('Server error');
  }
});

// --- Get Current User Info ---
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, email, full_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(user.rows[0]);
  } catch (err) {
    console.error(`❌ Error in /me: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// =================================================================
//                   IMPORTED ROUTE GROUPS (modular)
// =================================================================

// ✅ Loan endpoints moved here (apply, my-loans, admin approve/reject)
app.use('/api/loans', loanRoutes);

// =================================================================
//                   STILL LOCAL ENDPOINTS (TEMPORARY)
// =================================================================

// --- Get User Balance (for Dashboard) ---
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

    const balance = Number(balanceRes.rows[0].balance || 0);
    res.json({ balance });
  } catch (err) {
    console.error(`❌ Error in /balance: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// --- Get User Transactions ---
app.get('/api/transactions/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const txRes = await db.query(
      'SELECT id, type, amount, loan_id, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
      [userId]
    );

    res.json(txRes.rows);
  } catch (err) {
    console.error(`❌ Error in /transactions/my: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// =================================================================
//                          TEST & START SERVER
// =================================================================

// --- Connectivity test ---
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is reachable ✅' });
});

// --- Start the server ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});
