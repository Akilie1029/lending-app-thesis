// =================================================================
//                          IMPORTS & CONFIG
// =================================================================

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

// Middlewares
const authMiddleware = require("./authMiddleware");
const adminMiddleware = require("./adminMiddleware");

// Route Modules
const loanRoutes = require("./routes/loanRoutes");
const repaymentRoutes = require("./routes/loanPayRoutes");
const dashboardRoutes = require("./routes/loanDashboard");
const adminRoutes = require("./routes/admin");
const adminLoanApprovals = require("./routes/adminLoanApprovals");
const adminDisbursement = require("./routes/adminDisbursement");
const adminApprovedLoans = require("./routes/adminApprovedLoans");

// ⭐ NEW — full loans overview
const adminAllLoans = require("./routes/adminAllLoans");

const app = express();
const PORT = process.env.PORT || 5001;

// IMPORTANT: You said YOU will update this on Railway.
// Load JWT secret from env. If not provided (e.g., during dev), use a local fallback.
// NOTE: Never commit a production secret into source control. Use Railway variables for production.
const JWT_SECRET = process.env.JWT_SECRET || "TEST_LOCAL_SECRET";

// debug: helpful when checking logs to ensure JWT_SECRET loaded
console.log("▶️ JWT_SECRET:", JWT_SECRET ? "Loaded" : "MISSING");


// =================================================================
//                              MIDDLEWARE
// =================================================================
app.use(cors());
app.use(express.json());

// =================================================================
//                           AUTH ROUTES
// =================================================================

// ------------------------- REGISTER ------------------------------
app.post("/api/auth/register", async (req, res) => {
  try {
    const full_name = (req.body.full_name || "").trim();
    const { email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const exists = await db.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insert = await db.query(
      `
      INSERT INTO users (full_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, email, full_name, role
      `,
      [full_name, email, passwordHash]
    );

    const user = insert.rows[0];
    const token = jwt.sign(
      { user: { id: user.id, role: user.role } },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------- LOGIN -------------------------------
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const safeRole = (user.role || "borrower").toUpperCase();

    const token = jwt.sign(
      { user: { id: user.id, role: safeRole } },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: safeRole,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// --------------------------- ME ---------------------------------
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const rs = await db.query(
      `SELECT id, email, full_name, role FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (rs.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rs.rows[0];
    user.role = user.role ? user.role.toUpperCase() : "BORROWER";

    res.json(user);
  } catch (err) {
    console.error("/auth/me ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================================
//                      USER LOAN & REPAYMENT ROUTES
// =================================================================
app.use("/api/loans", loanRoutes);       // Applications, my-loans
app.use("/api/repayments", repaymentRoutes);
app.use("/api/loans", repaymentRoutes);  // compatibility
app.use("/api/dashboard", dashboardRoutes);

// =================================================================
//                           ADMIN ROUTES
// =================================================================
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminLoanApprovals);
app.use("/api/admin", adminDisbursement);
app.use("/api/admin", adminApprovedLoans);

// ⭐ NEW — All Loans Overview
app.use("/api/admin", adminAllLoans);

// =================================================================
//                   USER BALANCE & TRANSACTIONS
// =================================================================

// Wallet Balance
app.get("/api/users/balance", authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT COALESCE(SUM(
        CASE
          WHEN LOWER(type) IN ('deposit','cash deposit','cash_deposit') THEN amount
          WHEN LOWER(type) IN ('withdrawal','withdraw','cash_withdrawal') THEN -amount
          WHEN LOWER(type) IN ('loan_disbursement') THEN amount
          WHEN LOWER(type) IN ('loan_payment','loan payment') THEN -amount
          ELSE 0
        END
      ),0) AS balance
      FROM transactions
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    res.json({ balance: Number(result.rows[0].balance || 0) });
  } catch (err) {
    console.error("Balance ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Recent Transactions
app.get("/api/transactions/my", authMiddleware, async (req, res) => {
  try {
    const tx = await db.query(
      `
      SELECT id, type, amount, loan_id, payment_method, created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [req.user.id]
    );

    res.json(tx.rows);
  } catch (err) {
    console.error("Transactions ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Full Payment History
app.get("/api/transactions/my-payments", authMiddleware, async (req, res) => {
  try {
    const tx = await db.query(
      `
      SELECT id, type, amount, payment_method, loan_id, created_at
      FROM transactions
      WHERE user_id = $1
      AND (type = 'loan_payment' OR type = 'late_fee')
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json(tx.rows);
  } catch (err) {
    console.error("Payment history ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =================================================================
//                              TEST ROUTE
// =================================================================
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend OK" });
});

// =================================================================
//                           START SERVER
// =================================================================
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
