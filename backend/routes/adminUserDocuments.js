// backend/routes/adminUserDocuments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — LIST ALL USER PROFILE DOCUMENTS
 *
 * GET /api/admin/user-documents/:userId
 *
 * Returns:
 *   {
 *     userId: "...",
 *     user: { id, full_name, email, role },
 *     documents: [
 *       {
 *         id,
 *         user_id,
 *         doc_type,
 *         url,
 *         public_id,
 *         file_format,
 *         file_size,
 *         uploaded_at
 *       }
 *     ]
 *   }
 *
 * Notes:
 *  - UUID-safe
 *  - Includes debug logs
 *  - Ensures user exists before fetching documents
 */

router.get("/user-documents/:userId", auth, admin, async (req, res) => {
  const userId = req.params.userId;

  console.log(`📄 [ADMIN] GET /api/admin/user-documents/${userId}`);

  if (!userId) {
    console.warn("⚠️ Missing userId in request.");
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    // --------------------------------------------------------------------
    // 1) Validate user exists
    // --------------------------------------------------------------------
    const userQ = await db.query(
      `
      SELECT id, full_name, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (userQ.rows.length === 0) {
      console.warn(`⚠️ User not found: userId=${userId}`);
      return res.status(404).json({ error: "User not found" });
    }

    const user = userQ.rows[0];
    console.log(`👤 User found: ${user.full_name} (${user.email})`);

    // --------------------------------------------------------------------
    // 2) Fetch all profile documents for this user
    // --------------------------------------------------------------------
    console.log(`📎 Fetching user documents for userId=${userId}`);

    const docsQ = await db.query(
      `
      SELECT 
        id, 
        user_id, 
        doc_type, 
        url, 
        public_id, 
        file_format, 
        file_size, 
        uploaded_at
      FROM user_documents
      WHERE user_id = $1
      ORDER BY uploaded_at DESC
      `,
      [userId]
    );

    const documents = docsQ.rows || [];
    console.log(`📦 Found ${documents.length} document(s) for userId=${userId}`);

    // --------------------------------------------------------------------
    // 3) Respond with payload
    // --------------------------------------------------------------------
    return res.json({
      userId,
      user,
      documents,
    });
  } catch (err) {
    console.error("❌ [ADMIN] user-documents ERROR:", err);
    return res.status(500).json({
      error: "Failed to load user documents",
      details: err.message,
    });
  }
});

module.exports = router;
