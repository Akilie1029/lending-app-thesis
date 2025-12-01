// backend/routes/adminUserDocuments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

// ======================================================
// ADMIN — GET ALL PROFILE DOCUMENTS FOR A USER
// ======================================================
router.get("/user-documents/:userId", auth, admin, async (req, res) => {
  try {
    const userId = req.params.userId;

    const docs = await db.query(
      `
      SELECT id, user_id, doc_type, url, public_id, file_format, file_size, uploaded_at
      FROM user_documents
      WHERE user_id = $1
      ORDER BY uploaded_at DESC
      `,
      [userId]
    );

    res.json({ documents: docs.rows });
  } catch (err) {
    console.error("❌ user-documents error:", err);
    res.status(500).json({ error: "Failed to load user documents" });
  }
});

module.exports = router;
