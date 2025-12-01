// backend/controllers/adminPaymentsController.js
const db = require("../db");

// safe number
const num = (v) => (v == null ? 0 : Number(v));

/**
 * GET /api/admin/all-payments
 * Query params:
 *  - q: search term (user full_name or email)
 *  - from: YYYY-MM-DD
 *  - to: YYYY-MM-DD
 *  - method: payment_method filter
 *  - page: page number (default 1)
 *  - limit: page size (default 25)
 *  - sort: 'created_at'|'amount' (prefix '-' for desc) default '-created_at'
 */
async function getAllPayments(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const from = req.query.from; // YYYY-MM-DD
    const to = req.query.to; // YYYY-MM-DD
    const method = (req.query.method || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "25", 10)));
    const offset = (page - 1) * limit;
    const sortRaw = req.query.sort || "-created_at";

    // build allowed sorts
    let sortColumn = "created_at";
    let sortDir = "DESC";
    if (sortRaw.startsWith("-")) {
      sortColumn = sortRaw.slice(1);
      sortDir = "DESC";
    } else {
      sortColumn = sortRaw;
      sortDir = "ASC";
    }
    // prevent SQL injection by whitelisting
    const ALLOWED_SORTS = ["created_at", "amount"];
    if (!ALLOWED_SORTS.includes(sortColumn)) {
      sortColumn = "created_at";
      sortDir = "DESC";
    }

    // we only include loan-related incoming payments and late fees
    const allowedTypes = ["loan_payment", "repayment", "late_fee"];

    // base where clauses
    const wheres = [];
    const params = [];
    let idx = 1;

    // type filter
    wheres.push(`t.type = ANY($${idx}::text[])`);
    params.push(allowedTypes);
    idx++;

    // search q -> users full_name or email
    if (q) {
      wheres.push(`(LOWER(u.full_name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx})`);
      params.push(`%${q.toLowerCase()}%`);
      idx++;
    }

    // payment method
    if (method) {
      wheres.push(`LOWER(t.payment_method) = $${idx}`);
      params.push(method.toLowerCase());
      idx++;
    }

    // date range: use created_at::date
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

    // total count + sum
    const totalsSql = `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(t.amount),0) AS sum
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      ${whereClause}
    `;
    const totalsRes = (await db.query(totalsSql, params)).rows[0] || { count: 0, sum: 0 };

    // fetch paginated rows with user details and loan reference
    // order by sanitized column/direction
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

    // respond
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
      meta: { page, limit, total: Number(totalsRes.count || 0) },
      totals: { count: Number(totalsRes.count || 0), sum: Number(totalsRes.sum || 0) },
    });
  } catch (err) {
    console.error("getAllPayments ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = {
  getAllPayments,
};
