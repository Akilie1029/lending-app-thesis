// backend/routes/adminLoanDocuments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../authMiddleware");
const admin = require("../adminMiddleware");

/**
 * ADMIN — GET ALL DOCUMENTS FOR A LOAN
 * Actual documents live in the `loans` table (Cloudinary URLs)
 * Optional extra documents may exist in loan_documents table.
 */

router.get("/loan/:loanId/documents", auth, admin, async (req, res) => {
  const loanId = req.params.loanId;

  console.log(`📄 [ADMIN] GET /api/admin/loan/${loanId}/documents`);

  if (!loanId) {
    return res.status(400).json({ error: "loanId is required" });
  }

  try {
    // 1) Load loan + Cloudinary URLs
    console.log("🔍 Fetching loan with Cloudinary URLs…");

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
        remaining_balance,
        gov_id_uri,
        selfie_id_uri,
        proof_uri
      FROM loans
      WHERE id = $1
      LIMIT 1
      `,
      [loanId]
    );

    if (loanQ.rows.length === 0) {
      return res.status(404).json({ error: "Loan not found" });
    }

    const loan = loanQ.rows[0];

    console.log("📌 Loan found. Checking Cloudinary URLs…");

    // Build Cloudinary docs list
    const loanBasedDocs = [];

    if (loan.gov_id_uri) {
      loanBasedDocs.push({
        id: "gov_id",
        loan_id: loanId,
        doc_type: "valid_id",
        url: loan.gov_id_uri,
        uploaded_at: loan.created_at,
      });
    }

    if (loan.selfie_id_uri) {
      loanBasedDocs.push({
        id: "selfie_id",
        loan_id: loanId,
        doc_type: "id_selfie",
        url: loan.selfie_id_uri,
        uploaded_at: loan.created_at,
      });
    }

    if (loan.proof_uri) {
      loanBasedDocs.push({
        id: "proof_income",
        loan_id: loanId,
        doc_type: "proof_income",
        url: loan.proof_uri,
        uploaded_at: loan.created_at,
      });
    }

    console.log(`📎 Found ${loanBasedDocs.length} Cloudinary docs.`);

    // 2) Also load loan_documents (if any)
    console.log("📄 Loading additional loan_documents entries…");

    const docsQ = await db.query(
      `
      SELECT 
        ld.id,
        ld.loan_id,
        ld.user_id,
        ld.doc_type,
        ld.url,
        ld.public_id,
        ld.file_format,
        ld.file_size,
        ld.uploaded_at
      FROM loan_documents ld
      WHERE ld.loan_id = $1
      ORDER BY ld.uploaded_at DESC
      `,
      [loanId]
    );

    const dbDocs = docsQ.rows || [];

    console.log(`📦 Found ${dbDocs.length} extra loan_documents entries.`);

    // 3) Merge sources
    const allDocs = [...loanBasedDocs, ...dbDocs];

    // Group by doc_type
    const grouped = {};
    for (const doc of allDocs) {
      if (!grouped[doc.doc_type]) grouped[doc.doc_type] = [];
      grouped[doc.doc_type].push(doc);
    }

    return res.json({
      loanId,
      loan,
      count: allDocs.length,
      documents: allDocs,
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
