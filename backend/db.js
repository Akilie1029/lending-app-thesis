// db.js
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

// Railway sets DATABASE_URL automatically
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false,
  max: 10,           // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Helpful debug logs
pool.on("connect", () => {
  console.log("📡 PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL Pool Error:", err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
