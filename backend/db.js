// backend/db.js
const { Pool } = require("pg");

// ======================================================================
// DATABASE CONFIGURATION
// ======================================================================
//
// This file creates a single shared connection pool for PostgreSQL.
// It works for:
//   ✔ Local development
//   ✔ Railway / Render / Heroku
//   ✔ Full SSL or "allow insecure" SSL modes
//
// ENV VARIABLES SUPPORTED:
//   DATABASE_URL  → Full connection string
//   PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT (optional)
// ======================================================================

// Enable SSL automatically if Railway provides DATABASE_URL
const isProd = process.env.NODE_ENV === "production";
const hasDatabaseURL = !!process.env.DATABASE_URL;

console.log("🔌 Initializing PostgreSQL Pool...");
console.log("🌍 Environment:", process.env.NODE_ENV);
console.log("🔗 Using DATABASE_URL:", hasDatabaseURL ? "YES" : "NO");

let poolConfig = {};

if (hasDatabaseURL) {
  // Railway / Production-style URL
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: false, // Railway & many cloud DBs require this
    },
  };
} else {
  // Local fallback (requires PGHOST, PGUSER, etc.)
  poolConfig = {
    host: process.env.PGHOST || "localhost",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "kaurta",
    port: Number(process.env.PGPORT || 5432),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

// ======================================================================
// TEST CONNECTION
// ======================================================================
(async () => {
  try {
    const client = await pool.connect();
    console.log("🟢 PostgreSQL CONNECTED successfully!");

    const now = await client.query("SELECT NOW()");
    console.log("⏱️ Database time:", now.rows[0].now);

    client.release();
  } catch (err) {
    console.error("❌ PostgreSQL CONNECTION FAILED:", err.message);
    console.error(err);
  }
})();

// ======================================================================
// EXPORT QUERY + POOL INSTANCE
// ======================================================================
//
// db.query(text, params)
// db.connect() → client
//
// We wrap pool.query for debugging.
//
const db = {
  query: async (text, params) => {
    try {
      // Optional verbose debug:
      // console.log("📘 DB QUERY:", text, params);

      const result = await pool.query(text, params);
      return result;
    } catch (err) {
      console.error("❌ DB QUERY ERROR:", err.message);
      console.error("⤷ SQL:", text);
      console.error("⤷ Params:", params);
      throw err;
    }
  },

  // Expose raw pool for manual transactions
  connect: () => pool.connect(),
};

module.exports = db;
