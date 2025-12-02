// routes/uploadRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");
const { uploadBufferToCloudinary, destroyPublicId } = require("../upload");

const upload = multer({ storage: multer.memoryStorage() });

/* ========================================================================
   USER-SIDE UPLOAD ROUTES (Loan Application)
   Matches LoanApplicationScreen EXACTLY
======================================================================== */

// ---- Upload Government ID ----
router.post("/valid-id", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const folder = `kaurta/loan_application/valid_id`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    return res.json({
      url: cloud.secure_url,
      public_id: cloud.public_id
    });
  } catch (err) {
    console.error("valid-id upload error", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ---- Upload Selfie with ID ----
router.post("/id-selfie", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const folder = `kaurta/loan_application/id_selfie`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    return res.json({
      url: cloud.secure_url,
      public_id: cloud.public_id
    });
  } catch (err) {
    console.error("id-selfie upload error", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ---- Upload Proof of Income ----
router.post("/proof-income", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const folder = `kaurta/loan_application/proof_income`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    return res.json({
      url: cloud.secure_url,
      public_id: cloud.public_id
    });
  } catch (err) {
    console.error("proof-income upload error", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

/* ========================================================================
   BELOW THIS LINE — ORIGINAL ADMIN & PROFILE UPLOADS (UNCHANGED)
======================================================================== */

// ---------- PROFILE PHOTO ----------
router.post(
  "/profile-photo",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const userId = req.user.id;
      const folder = `kaurta/profile_photos`;

      const existsRes = await db.query(
        `SELECT * FROM user_documents WHERE user_id = $1 AND doc_type = 'profile_photo' LIMIT 1`,
        [userId]
      );

      const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

      if (existsRes.rows.length > 0) {
        const old = existsRes.rows[0];
        await destroyPublicId(old.public_id);

        const upd = await db.query(
          `UPDATE user_documents 
           SET url=$1, public_id=$2, file_format=$3, file_size=$4, uploaded_at=NOW()
           WHERE id=$5 RETURNING *`,
          [cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes, old.id]
        );

        return res.json({ document: upd.rows[0] });
      }

      const ins = await db.query(
        `INSERT INTO user_documents 
         (user_id, doc_type, url, public_id, file_format, file_size) 
         VALUES ($1, 'profile_photo', $2, $3, $4, $5)
         RETURNING *`,
        [userId, cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes]
      );

      res.json({ document: ins.rows[0] });
    } catch (err) {
      console.error("profile-photo upload error", err);
      res.status(500).json({ error: "Upload failed", details: err.message });
    }
  }
);

// ---------- LOAN DOCUMENT (ADMIN / EXISTING LOANS ONLY) ----------
router.post(
  "/loan-document",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const { type: docType, loanId } = req.query;
      const allowed = ["valid_id", "id_selfie", "proof_income"];

      if (!docType || !allowed.includes(docType)) {
        return res.status(400).json({ error: "Invalid or missing doc type" });
      }

      if (!loanId) {
        return res.status(400).json({ error: "Missing loanId query param" });
      }

      const loanRes = await db.query(
        `SELECT * FROM loans WHERE id = $1 LIMIT 1`,
        [loanId]
      );

      if (loanRes.rows.length === 0)
        return res.status(404).json({ error: "Loan not found" });

      const loan = loanRes.rows[0];

      if (
        req.user.role?.toLowerCase() !== "admin" &&
        String(loan.user_id) !== String(req.user.id)
      ) {
        return res.status(403).json({ error: "Not allowed to upload for this loan" });
      }

      const folder = `kaurta/loan_docs/${loanId}/${docType}`;

      const existsRes = await db.query(
        `SELECT * FROM loan_documents 
         WHERE loan_id = $1 AND doc_type = $2 LIMIT 1`,
        [loanId, docType]
      );

      const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

      if (existsRes.rows.length > 0) {
        const old = existsRes.rows[0];
        await destroyPublicId(old.public_id);

        const upd = await db.query(
          `UPDATE loan_documents
           SET url=$1, public_id=$2, file_format=$3, file_size=$4, uploaded_at=NOW()
           WHERE id=$5 RETURNING *`,
          [cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes, old.id]
        );

        return res.json({ document: upd.rows[0] });
      }

      const ins = await db.query(
        `INSERT INTO loan_documents 
         (loan_id, user_id, doc_type, url, public_id, file_format, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          loanId,
          loan.user_id,
          docType,
          cloud.secure_url,
          cloud.public_id,
          cloud.format,
          cloud.bytes
        ]
      );

      res.json({ document: ins.rows[0] });
    } catch (err) {
      console.error("loan-document upload error", err);
      res.status(500).json({ error: "Upload failed", details: err.message });
    }
  }
);

// ---------- ADMIN: list loan documents ----------
router.get(
  "/admin/loan-documents/:loanId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const loanId = req.params.loanId;

      const docs = await db.query(
        `SELECT * FROM loan_documents 
         WHERE loan_id = $1 ORDER BY uploaded_at DESC`,
        [loanId]
      );

      const grouped = docs.rows.reduce((acc, d) => {
        if (!acc[d.doc_type]) acc[d.doc_type] = [];
        acc[d.doc_type].push(d);
        return acc;
      }, {});

      res.json({ documents: grouped });
    } catch (err) {
      console.error("admin loan docs error", err);
      res.status(500).json({ error: "Failed to load documents" });
    }
  }
);

module.exports = router;
