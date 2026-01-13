// controllers/adminPaymentsController.js
const db = require("../db");

// safe number helper
const num = (v) => (v == null ? 0 : Number(v));

/**
 * ADMIN — GET ALL PAYMENTS
 *
 * Supports:
 *  - q (search by user name or email)
 *  - from / to (date range)
 *  - method (payment_method)
 *  - page, limit
 *  - sort = created_at | -created_at | amount | -amount
 *
 * Security:
 *  - UUID-safe (no Number() casts)
 *  - Sort whitelist to prevent SQL injection
 *  - Debug logs to trace admin activity
 */
async function getAllPayments(req, res) {
  try {
    console.log("\n===============================");
    console.log("💳 [ADMIN] getAllPayments triggered by:", req.user?.id);
    console.log("Query params:", req.query);
    console.log("===============================\n");

    const q = (req.query.q || "").trim();
    const from = req.query.from || null;
    const to = req.query.to || null;
    const method = (req.query.method || "").trim().toLowerCase();

    // ✅ FIXED: Increased default limit from 25 to 100 to show more payments
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || "100", 10)));
    const offset = (page - 1) * limit;

    // sorting - ✅ FIXED: Default sort is now -created_at (newest first)
    const sortRaw = req.query.sort || "-created_at";
    let sortColumn = "t.created_at"; // ✅ Added table prefix
    let sortDir = "DESC";

    if (sortRaw.startsWith("-")) {
      sortColumn = sortRaw.slice(1);
      sortDir = "DESC";
    } else {
      sortColumn = sortRaw;
      sortDir = "ASC";
    }

    const ALLOWED_SORTS = ["created_at", "amount"];
    const baseSort = sortColumn.replace("t.", ""); // Remove prefix for validation
    
    if (!ALLOWED_SORTS.includes(baseSort)) {
      console.warn("⚠️ Invalid sort column, defaulting to created_at");
      sortColumn = "t.created_at";
    } else {
      sortColumn = `t.${baseSort}`; // Add table prefix
    }

    console.log(`📌 Sorting by: ${sortColumn} ${sortDir}`);

    // ✅ FIXED: Exclude late_fee from default view
    const allowedTypes = ["loan_payment", "repayment"];

    // build SQL
    const wheres = [];
    const params = [];
    let idx = 1;

    // only allowed payment types (excludes late_fee)
    wheres.push(`t.type = ANY($${idx}::text[])`);
    params.push(allowedTypes);
    idx++;

    // search (full name or email)
    if (q) {
      wheres.push(`(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`);
      params.push(`%${q.toLowerCase()}%`);
      idx++;
    }

    // payment method filter
    if (method) {
      wheres.push(`LOWER(t.payment_method) = $${idx}`);
      params.push(method);
      idx++;
    }

    // date range filters
    if (from) {
      wheres.push(`t.created_at::date >= $${idx}::date`);
      params.push(from);
      idx++;
    }
    if (to) {
      wheres.push(`t.created_at::date <= $${idx}::date`);
      params.push(to);
      idx++;
    }

    const whereClause = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";

    console.log("🔍 whereClause =", whereClause);

    // ============================================================
    // COUNT + SUM
    // ============================================================
    const totalsSql = `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(t.amount),0) AS sum
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ${whereClause}
    `;
    const totalsRes = (await db.query(totalsSql, params)).rows[0] || { count: 0, sum: 0 };

    console.log("📊 totals:", totalsRes);

    // ============================================================
    // FETCH PAGINATED ROWS
    // ============================================================
    const dataSql = `
      SELECT
        t.id,
        t.type,
        t.amount,
        t.loan_id,
        t.user_id,
        COALESCE(u.full_name, '') AS user_full_name,
        COALESCE(u.email, '') AS user_email,
        t.payment_method,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    params.push(limit, offset);

    const dataRes = (await db.query(dataSql, params)).rows || [];

    // ============================================================
    // FORMAT RESPONSE
    // ============================================================
    return res.json({
      payments: dataRes.map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount || 0),
        loan_id: r.loan_id,
        user_id: r.user_id,
        user_full_name: r.user_full_name,
        user_email: r.user_email,
        payment_method: r.payment_method,
        created_at: r.created_at,
      })),
      meta: {
        page,
        limit,
        total: Number(totalsRes.count),
      },
      totals: {
        count: Number(totalsRes.count),
        sum: Number(totalsRes.sum),
      },
    });
  } catch (err) {
    console.error("❌ getAllPayments ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
}

module.exports = {
  getAllPayments,
};