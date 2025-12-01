// routes/adminLoanDocuments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");

/**
 * GET /api/admin/loan/:loanId/documents
 * Returns all Cloudinary documents for a loan.
 */
router.get(
  "/loan/:loanId/documents",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const loanId = req.params.loanId;

      if (!loanId) {
        return res.status(400).json({ error: "loanId is required" });
      }

      const sql = `
        SELECT
          ld.id,
          ld.loan_id,
          ld.user_id,
          COALESCE(ld.doc_type, '') AS doc_type,
          COALESCE(ld.url, '') AS url,
          COALESCE(ld.public_id, '') AS public_id,
          COALESCE(ld.file_format, '') AS file_format,
          COALESCE(ld.file_size, 0) AS file_size,
          ld.uploaded_at,
          u.full_name AS user_full_name,
          u.email AS user_email
        FROM loan_documents ld
        LEFT JOIN users u ON u.id = ld.user_id
        WHERE ld.loan_id = $1
        ORDER BY ld.uploaded_at DESC
      `;

      const result = await db.query(sql, [loanId]);

      return res.json({
        loanId,
        documents: result.rows.map((doc) => ({
          id: doc.id,
          loan_id: doc.loan_id,
          user_id: doc.user_id,
          doc_type: doc.doc_type,
          url: doc.url,
          public_id: doc.public_id,
          file_format: doc.file_format,
          file_size: Number(doc.file_size || 0),
          uploaded_at: doc.uploaded_at,
          user_full_name: doc.user_full_name || "",
          user_email: doc.user_email || "",
        })),
      });
    } catch (err) {
      console.error("❌ /api/admin/loan/:loanId/documents ERROR:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
