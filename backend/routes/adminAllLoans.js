const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG = "[ADMIN_ALL_LOANS]";

router.get("/all-loans", auth, admin, async (req, res) => {
  try {
    console.log(LOG, "📡 Request by admin:", req.user?.id);

    const {
      q,
      status,
      from,
      to,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(Number(page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = [];
    const params = [];
    let idx = 1;

    // --------------------------------------------------
    // SEARCH (borrower name OR loan id)
    // --------------------------------------------------
    if (q) {
      where.push(
        `(u.full_name ILIKE $${idx} OR CAST(l.id AS TEXT) ILIKE $${idx})`
      );
      params.push(`%${q}%`);
      idx++;
    }

    // --------------------------------------------------
    // STATUS FILTER (frontend ↔ DB normalization)
    // --------------------------------------------------
    if (status) {
      const rawStatuses = status
        .split(",")
        .map((s) => s.trim().toLowerCase());

      const normalizedStatuses = rawStatuses.map((s) => {
        if (s === "paid") return "completed";
        return s;
      });

      where.push(`LOWER(l.status) = ANY($${idx})`);
      params.push(normalizedStatuses);
      idx++;
    }

    // --------------------------------------------------
    // DATE RANGE
    // --------------------------------------------------
    if (from) {
      where.push(`l.created_at >= $${idx}`);
      params.push(from);
      idx++;
    }

    if (to) {
      where.push(`l.created_at <= $${idx}`);
      params.push(to);
      idx++;
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // --------------------------------------------------
    // SORT
    // --------------------------------------------------
    const orderSQL =
      sort === "oldest"
        ? "ORDER BY l.created_at ASC"
        : "ORDER BY l.created_at DESC";

    // --------------------------------------------------
    // COUNT
    // --------------------------------------------------
    const countSQL = `
      SELECT COUNT(*)::int AS total
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereSQL}
    `;

    const countRes = await db.query(countSQL, params);
    const total = countRes.rows[0]?.total || 0;

    // --------------------------------------------------
    // DATA
    // --------------------------------------------------
    const dataSQL = `
      SELECT 
        l.id,
        l.user_id,
        u.full_name AS user_full_name,
        u.email,

        COALESCE(l.approved_principal, l.principal, 0) AS amount,

        l.principal,
        l.interest,
        l.total_payable,
        l.remaining_balance,
        l.days,
        l.purpose,

        l.approved_principal,
        l.approved_interest,
        l.approved_total_payable,
        l.approved_daily_payment,
        l.approved_at,

        l.borrower_accepted_at,
        l.borrower_rejected_at,

        l.created_at,
        l.disbursed_at,
        l.completed_at,

        l.payout_method,
        l.payout_details,

        l.gov_id_uri,
        l.selfie_id_uri,
        l.proof_uri,

        l.status
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      ${whereSQL}
      ${orderSQL}
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const dataParams = [...params, limitNum, offset];

    const rs = await db.query(dataSQL, dataParams);

    console.log(LOG, "➡ Returned:", rs.rows.length, "of", total);

    return res.json({
      count: total,
      loans: rs.rows,
    });
  } catch (err) {
    console.error(LOG, "❌ ERROR:", err);
    return res.status(500).json({
      error: "Failed to load loans",
      details: err.message,
    });
  }
});

module.exports = router;
