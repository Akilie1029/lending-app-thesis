// =================================================================
//                          IMPORTS & CONFIG
// =================================================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

// Middlewares
const authMiddleware = require("./authMiddleware");
const adminMiddleware = require("./adminMiddleware");

// Borrower Routes
const loanRoutes = require("./routes/loanRoutes");
const repaymentRoutes = require("./routes/loanPayRoutes");
const dashboardRoutes = require("./routes/loanDashboard");

// Admin Routes
const adminRoutes = require("./routes/admin");
const adminLoanApprovals = require("./routes/adminLoanApprovals");
const adminDisbursement = require("./routes/adminDisbursement");
const adminAllLoans = require("./routes/adminAllLoans");

// Additional Admin Modules
const adminLoanDetails = require("./routes/adminLoanDetails");
const adminManualAdjustments = require("./routes/adminManualAdjustments");
const adminRepaymentTools = require("./routes/adminRepaymentTools");
const adminReports = require("./routes/adminReports");
const disbursementHistory = require("./routes/disbursementHistory");

// Dashboard insights
const adminStats = require("./controllers/adminStatsController");

// ⭐ Cloudinary Uploads
const uploadRoutes = require("./routes/uploadRoutes");

// ⭐ Document Viewers
const adminLoanDocuments = require("./routes/adminLoanDocuments");
const adminUserDocuments = require("./routes/adminUserDocuments");

// ⭐ NEW: Notifications Routes
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 5001;

// JWT
const JWT_SECRET = process.env.JWT_SECRET || "LOCAL_DEV_SECRET_ONLY";
console.log("🔐 JWT_SECRET:", JWT_SECRET ? "Loaded" : "MISSING");


// =================================================================
//                            MIDDLEWARE
// =================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// =================================================================
//                           AUTH ROUTES
// =================================================================
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
    user.role = (user.role || "borrower").toUpperCase();
    res.json(user);
  } catch (err) {
    console.error("/auth/me ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =================================================================
//                        USER LOAN & PAYMENT ROUTES
// =================================================================
app.use("/api/loans", loanRoutes);
app.use("/api/repayments", repaymentRoutes);
app.use("/api/dashboard", dashboardRoutes);


// =================================================================
//                           ADMIN ROUTES
// =================================================================
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminLoanApprovals);
app.use("/api/admin", adminDisbursement);
app.use("/api/admin", adminAllLoans);

app.use("/api/admin", adminLoanDetails);
app.use("/api/admin", adminManualAdjustments);
app.use("/api/admin", adminRepaymentTools);
app.use("/api/admin", adminReports);
app.use("/api/admin", disbursementHistory);

// ⭐ Document Viewers
app.use("/api/admin", adminLoanDocuments);
app.use("/api/admin", adminUserDocuments);

// Dashboard stats
app.get(
  "/api/admin/dashboard-stats",
  authMiddleware,
  adminMiddleware,
  adminStats.getDashboardStats
);


// =================================================================
//                   CLOUDINARY UPLOAD ROUTES
// =================================================================
app.use("/api/upload", uploadRoutes);


// =================================================================
//                   NOTIFICATIONS ROUTES (NEW)
// =================================================================
app.use("/api", notificationRoutes);


// =================================================================
//                   USER BALANCE & TRANSACTIONS
// =================================================================
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
//                         TEST & DEBUG ROUTES
// =================================================================
app.get("/api/test", (req, res) => res.json({ message: "Backend OK" }));
app.get("/api/debug/version", (req, res) => {
  res.json({
    version: "v3-cloudinary-enabled",
    hasDashboardRoute: typeof adminStats.getDashboardStats === "function",
  });
});


// =================================================================
//                           START SERVER
// =================================================================
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
