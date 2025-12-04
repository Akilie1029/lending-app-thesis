// routes/notifications.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG = "[NOTIFICATIONS]";

// internal secret fallback (optional)
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || null;

// ----------------------------------------------------------------------------
// GET /api/notifications/my
// ----------------------------------------------------------------------------
router.get("/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const q = await db.query(
      `SELECT id, type, title, message, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    return res.json({ notifications: q.rows });
  } catch (err) {
    console.error(LOG, "fetch my notifications error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// ----------------------------------------------------------------------------
// POST /api/notifications/push
// Create/push a notification (internal or admin call)
// Body:
//  - user_id (required)
//  - type (string) e.g. loan_payment, loan_completed, loan_approved
//  - title (string)
//  - message (string)
//  - data (object) optional - JSON payload
// ----------------------------------------------------------------------------
router.post("/push", async (req, res) => {
  try {
    const callerIsInternal = req.headers["x-internal-secret"] && INTERNAL_SECRET && req.headers["x-internal-secret"] === INTERNAL_SECRET;

    // if not internal, require auth + admin
    if (!callerIsInternal) {
      // require auth + admin middleware
      // re-run middlewares programmatically:
      // note: the more explicit pattern for route-level middleware is to attach them; but to keep endpoint single-file,
      // fallback to verifying token via auth middleware function pattern. Simpler approach: require a valid admin token in Authorization header.
      // We will expect that admin endpoints call with an admin token.
      // So enforce auth + admin via checking req.user after calling auth.
      // To keep consistent we call auth and admin as functions:
      await new Promise((resolve, reject) => {
        auth(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      await new Promise((resolve, reject) => {
        admin(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    const { user_id: userId, type, title, message, data } = req.body || {};

    if (!userId || !type || !title || !message) {
      return res.status(400).json({ error: "MISSING_FIELDS", message: "user_id, type, title, message are required" });
    }

    const q = await db.query(
      `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, false, NOW())
       RETURNING id, user_id, type, title, message, data, is_read, created_at`,
      [userId, type, title, message, data ? JSON.stringify(data) : null]
    );

    return res.status(201).json({ notification: q.rows[0] });
  } catch (err) {
    console.error(LOG, "push error:", err);
    // If auth middleware already sent a response (401), abort
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }
});

// ----------------------------------------------------------------------------
// POST /api/notifications/:id/read
// Mark a notification as read (user must own it)
// ----------------------------------------------------------------------------
router.post("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const q = await db.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read, created_at`,
      [notifId, userId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ notification: q.rows[0] });
  } catch (err) {
    console.error(LOG, "mark read error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
