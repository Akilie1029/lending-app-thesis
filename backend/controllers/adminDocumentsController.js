// backend/controllers/adminDocumentsController.js
const db = require("../db");

async function getLoanDocuments(req, res) {
  try {
    const loanId = req.params.loanId;

    // simple validation
    if (!loanId) return res.status(400).json({ error: "loanId required" });

    const q = `
      SELECT
        id,
        loan_id,
        user_id,
        doc_type,
        url,
        public_id,
        file_format,
        file_size,
        uploaded_at
      FROM loan_documents
      WHERE loan_id = $1
      ORDER BY uploaded_at DESC
    `;

    const result = await db.query(q, [loanId]);

    return res.json({ documents: result.rows || [] });
  } catch (err) {
    console.error("getLoanDocuments ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = { getLoanDocuments };
