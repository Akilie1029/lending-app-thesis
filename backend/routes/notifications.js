// routes/notifications.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");

const LOG = "[NOTIFICATIONS]";

// -----------------------------------------------------------------------------
// GET ALL NOTIFICATIONS OF CURRENT USER
// -----------------------------------------------------------------------------
router.get("/notifications/my", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `
      SELECT 
        id,
        loan_id,
        type,
        title,
        message,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json({ notifications: result.rows || [] });
  } catch (err) {
    console.error(LOG, "❌ my-notifications error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------------------------------------------------------
// MARK NOTIFICATION AS READ
// -----------------------------------------------------------------------------
router.post("/notifications/:id/read", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const check = await db.query(
      `SELECT user_id FROM notifications WHERE id = $1`,
      [notifId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
    }

    if (String(check.rows[0].user_id) !== String(userId)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    await db.query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1
      `,
      [notifId]
    );

    return res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error(LOG, "❌ mark-read error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------------------------------------------------------
// INTERNAL SYSTEM ROUTE — CREATE A NOTIFICATION
// -----------------------------------------------------------------------------
router.post("/notifications/push", async (req, res) => {
  // ❗ This route is intentionally NOT protected by auth middleware
  // Backend-only usage (called internally from loan/approval/disburse routes)
  try {
    const {
      user_id,
      loan_id = null,
      type,
      title,
      message,
    } = req.body || {};

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "user_id, type, title, and message are required",
      });
    }

    await db.query(
      `
      INSERT INTO notifications (user_id, loan_id, type, title, message)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [user_id, loan_id, type, title, message]
    );

    return res.json({ message: "Notification sent" });
  } catch (err) {
    console.error(LOG, "❌ push error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
