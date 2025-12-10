// routes/notifications.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

const LOG = "[NOTIFICATIONS]";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || null;

/* ============================================================================
   GET /api/notifications/my
   - Return user notifications
   - FIX: removed "data" because the column does not exist in DB
============================================================================ */
router.get("/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const q = await db.query(
      `
      SELECT 
        id,
        type,
        title,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId]
    );

    return res.json({ notifications: q.rows });
  } catch (err) {
    console.error(LOG, "fetch my notifications error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

/* ============================================================================
   POST /api/notifications/push
   - Admin or internal service can push notifications
   - FIX: removed "data" from INSERT because column doesn't exist
============================================================================ */
router.post("/push", async (req, res) => {
  try {
    const callerIsInternal =
      req.headers["x-internal-secret"] &&
      INTERNAL_SECRET &&
      req.headers["x-internal-secret"] === INTERNAL_SECRET;

    if (!callerIsInternal) {
      await new Promise((resolve, reject) =>
        auth(req, res, (err) => (err ? reject(err) : resolve()))
      );
      await new Promise((resolve, reject) =>
        admin(req, res, (err) => (err ? reject(err) : resolve()))
      );
    }

    const { user_id: userId, type, title, message } = req.body || {};

    if (!userId || !type || !title || !message) {
      return res
        .status(400)
        .json({
          error: "MISSING_FIELDS",
          message: "user_id, type, title, message are required",
        });
    }

    const q = await db.query(
      `
      INSERT INTO notifications (
        id, user_id, type, title, message, is_read, created_at
      )
      VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, false, NOW()
      )
      RETURNING 
        id, user_id, type, title, message, is_read, created_at
      `,
      [userId, type, title, message]
    );

    return res.status(201).json({ notification: q.rows[0] });
  } catch (err) {
    console.error(LOG, "push error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }
});

/* ============================================================================
   POST /api/notifications/:id/read
============================================================================ */
router.post("/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const q = await db.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      RETURNING id, is_read, created_at
      `,
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
