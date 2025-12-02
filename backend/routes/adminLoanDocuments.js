// backend/routes/adminLoanDocuments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — GET ALL DOCUMENTS FOR A LOAN
 *
 * GET /api/admin/loan/:loanId/documents
 *
 * Returns:
 *   {
 *     loanId,
 *     loan: { basic loan fields },
 *     documents: [
 *       { id, doc_type, url, public_id, file_format, file_size, uploaded_at, ... }
 *     ],
 *     grouped: { valid_id: [ ... ], id_selfie: [ ... ], proof_income: [ ... ] }
 *   }
 *
 * Notes:
 *   - UUID-safe
 *   - Includes debug logs
 *   - Ensures loan exists before returning documents
 */

router.get("/loan/:loanId/documents", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log(`📄 [ADMIN] GET /api/admin/loan/${loanId}/documents`);

  if (!loanId) {
    console.warn("⚠️ loanId missing in request.");
    return res.status(400).json({ error: "loanId is required" });
  }

  try {
    // --------------------------------------------------------------------
    // 1) Validate loan exists
    // --------------------------------------------------------------------
    console.log("🔍 Checking if loan exists…");

    const loanQ = await db.query(
      `
      SELECT 
        id, 
        user_id,
        principal,
        days,
        status,
        created_at,
        approved_at,
        disbursed_at,
        remaining_balance
      FROM loans
      WHERE id = $1
      LIMIT 1
      `,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      console.warn(`⚠️ Loan not found: loanId=${loanId}`);
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];
    console.log(`📌 Loan found. user_id=${loan.user_id} status=${loan.status}`);

    // --------------------------------------------------------------------
    // 2) Fetch all loan documents
    // --------------------------------------------------------------------
    console.log(`📎 Fetching documents for loanId=${loanId}`);

    const docsQ = await db.query(
      `
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
      `,
      [loanId]
    );

    const documents = docsQ.rows || [];
    console.log(`📦 Found ${documents.length} document(s)`);

    // --------------------------------------------------------------------
    // 3) Group documents by doc_type
    // --------------------------------------------------------------------
    const grouped = {};
    for (const doc of documents) {
      if (!grouped[doc.doc_type]) grouped[doc.doc_type] = [];
      grouped[doc.doc_type].push(doc);
    }

    // --------------------------------------------------------------------
    // 4) Return structured response
    // --------------------------------------------------------------------
    return res.json({
      loanId,
      loan,
      count: documents.length,
      documents,
      grouped,
    });
  } catch (err) {
    console.error("❌ [ADMIN] loan/:loanId/documents ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

module.exports = router;
