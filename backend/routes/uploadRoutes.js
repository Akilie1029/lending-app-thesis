// routes/uploadRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const db = require("../db");
const authMiddleware = require("../authMiddleware");
const adminMiddleware = require("../adminMiddleware");
const { uploadBufferToCloudinary, destroyPublicId } = require("../upload");

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Upload routes (user & admin)
 *
 * - All IDs are treated as strings (UUIDs) — do NOT cast to Number()
 * - Responses are consistent and include helpful debug info
 * - Uses uploadBufferToCloudinary(buffer, { folder }) which should return:
 *    { secure_url, public_id, format, bytes }
 *
 * Endpoints:
 *  - POST /valid-id            (auth)         -> upload gov ID for loan application
 *  - POST /id-selfie           (auth)         -> upload selfie with ID for loan application
 *  - POST /proof-income        (auth)         -> upload proof of income for loan application
 *  - POST /profile-photo       (auth)         -> upload / replace profile photo (user_documents)
 *  - POST /loan-document       (auth)         -> admin/user upload for existing loan (loan_documents)
 *  - GET  /admin/loan-documents/:loanId (auth+admin) -> list loan documents grouped by doc_type
 */

// ----------------------------
// Helper
// ----------------------------
function okDocResponse(cloud) {
  return {
    url: cloud.secure_url,
    public_id: cloud.public_id,
    format: cloud.format,
    bytes: cloud.bytes,
  };
}

// ---- Upload Government ID (for loan application) ----
router.post("/valid-id", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    console.log("🔼 /api/upload/valid-id called by user:", req.user?.id);

    if (!req.file) {
      console.warn("⚠️ valid-id: no file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const folder = `kaurta/loan_application/valid_id`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    console.log("✅ valid-id uploaded:", cloud.public_id);
    return res.json(okDocResponse(cloud));
  } catch (err) {
    console.error("❌ valid-id upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ---- Upload Selfie with ID ----
router.post("/id-selfie", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    console.log("🔼 /api/upload/id-selfie called by user:", req.user?.id);

    if (!req.file) {
      console.warn("⚠️ id-selfie: no file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const folder = `kaurta/loan_application/id_selfie`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    console.log("✅ id-selfie uploaded:", cloud.public_id);
    return res.json(okDocResponse(cloud));
  } catch (err) {
    console.error("❌ id-selfie upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ---- Upload Proof of Income ----
router.post("/proof-income", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    console.log("🔼 /api/upload/proof-income called by user:", req.user?.id);

    if (!req.file) {
      console.warn("⚠️ proof-income: no file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const folder = `kaurta/loan_application/proof_income`;
    const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

    console.log("✅ proof-income uploaded:", cloud.public_id);
    return res.json(okDocResponse(cloud));
  } catch (err) {
    console.error("❌ proof-income upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

/* ========================================================================
   BELOW THIS LINE — ADMIN & PROFILE UPLOADS
   These operate on user_documents and loan_documents tables
   ======================================================================== */

// ---------- PROFILE PHOTO ----------
router.post(
  "/profile-photo",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      console.log("🔼 /api/upload/profile-photo called by user:", req.user?.id);

      if (!req.file) {
        console.warn("⚠️ profile-photo: no file provided");
        return res.status(400).json({ error: "No file provided" });
      }

      const userId = req.user.id;
      const folder = `kaurta/profile_photos`;

      // Check existing
      const existsRes = await db.query(
        `SELECT * FROM user_documents WHERE user_id = $1 AND doc_type = 'profile_photo' LIMIT 1`,
        [userId]
      );

      // Upload new file to Cloudinary
      const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

      if (existsRes.rows.length > 0) {
        const old = existsRes.rows[0];

        // Destroy old public id in Cloudinary (best-effort)
        try {
          if (old.public_id) {
            await destroyPublicId(old.public_id);
            console.log(`🗑 Destroyed old profile public_id=${old.public_id}`);
          }
        } catch (delErr) {
          console.warn("⚠️ Failed to destroy old profile public_id:", old.public_id, delErr.message);
        }

        const upd = await db.query(
          `UPDATE user_documents 
           SET url=$1, public_id=$2, file_format=$3, file_size=$4, uploaded_at=NOW()
           WHERE id=$5
           RETURNING *`,
          [cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes, old.id]
        );

        console.log("✅ profile-photo updated in DB id=", upd.rows[0].id);
        return res.json({ document: upd.rows[0] });
      }

      // Insert new
      const ins = await db.query(
        `INSERT INTO user_documents 
         (user_id, doc_type, url, public_id, file_format, file_size)
         VALUES ($1, 'profile_photo', $2, $3, $4, $5)
         RETURNING *`,
        [userId, cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes]
      );

      console.log("✅ profile-photo inserted in DB id=", ins.rows[0].id);
      return res.json({ document: ins.rows[0] });
    } catch (err) {
      console.error("❌ profile-photo upload error:", err);
      return res.status(500).json({ error: "Upload failed", details: err.message });
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
      console.log("🔼 /api/upload/loan-document called by user:", req.user?.id, "query:", req.query);

      if (!req.file) {
        console.warn("⚠️ loan-document: no file provided");
        return res.status(400).json({ error: "No file provided" });
      }

      const docType = req.query.type;
      const loanId = req.query.loanId; // keep as string (UUID)
      const allowed = ["valid_id", "id_selfie", "proof_income"];

      if (!docType || !allowed.includes(docType)) {
        console.warn("⚠️ loan-document: invalid or missing doc type:", docType);
        return res.status(400).json({ error: "Invalid or missing doc type" });
      }

      if (!loanId) {
        console.warn("⚠️ loan-document: missing loanId");
        return res.status(400).json({ error: "Missing loanId query param" });
      }

      // Verify loan exists
      const loanRes = await db.query(`SELECT * FROM loans WHERE id = $1 LIMIT 1`, [loanId]);
      if (loanRes.rows.length === 0) {
        console.warn("⚠️ loan-document: loan not found:", loanId);
        return res.status(404).json({ error: "Loan not found" });
      }

      const loan = loanRes.rows[0];

      // Only admin or the borrower who owns the loan can upload
      if (req.user.role?.toLowerCase() !== "admin" && String(loan.user_id) !== String(req.user.id)) {
        console.warn("⚠️ loan-document: not allowed to upload for this loan user:", req.user.id);
        return res.status(403).json({ error: "Not allowed to upload for this loan" });
      }

      const folder = `kaurta/loan_docs/${loanId}/${docType}`;

      // Check existing doc for that type
      const existsRes = await db.query(
        `SELECT * FROM loan_documents WHERE loan_id = $1 AND doc_type = $2 LIMIT 1`,
        [loanId, docType]
      );

      const cloud = await uploadBufferToCloudinary(req.file.buffer, { folder });

      if (existsRes.rows.length > 0) {
        const old = existsRes.rows[0];

        // Delete old file from Cloudinary (best-effort)
        try {
          if (old.public_id) {
            await destroyPublicId(old.public_id);
            console.log(`🗑 Destroyed old loan doc public_id=${old.public_id} for loan ${loanId}`);
          }
        } catch (delErr) {
          console.warn("⚠️ Failed to destroy old loan doc public_id:", old.public_id, delErr.message);
        }

        const upd = await db.query(
          `UPDATE loan_documents
           SET url=$1, public_id=$2, file_format=$3, file_size=$4, uploaded_at=NOW()
           WHERE id=$5
           RETURNING *`,
          [cloud.secure_url, cloud.public_id, cloud.format, cloud.bytes, old.id]
        );

        console.log("✅ loan-document updated in DB id=", upd.rows[0].id);
        return res.json({ document: upd.rows[0] });
      }

      // Insert new loan document
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
          cloud.bytes,
        ]
      );

      console.log("✅ loan-document inserted in DB id=", ins.rows[0].id);
      return res.json({ document: ins.rows[0] });
    } catch (err) {
      console.error("❌ loan-document upload error:", err);
      return res.status(500).json({ error: "Upload failed", details: err.message });
    }
  }
);

// ---------- ADMIN: list loan documents (grouped by doc_type) ----------
router.get(
  "/admin/loan-documents/:loanId",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const loanId = req.params.loanId;
      console.log(`🔍 /api/upload/admin/loan-documents/${loanId} called by admin=${req.user?.id}`);

      if (!loanId) {
        console.warn("⚠️ admin loan-documents: missing loanId");
        return res.status(400).json({ error: "loanId is required" });
      }

      const docs = await db.query(
        `SELECT id, loan_id, user_id, doc_type, url, public_id, file_format, file_size, uploaded_at
         FROM loan_documents
         WHERE loan_id = $1
         ORDER BY uploaded_at DESC`,
        [loanId]
      );

      // group by doc_type
      const grouped = docs.rows.reduce((acc, d) => {
        if (!acc[d.doc_type]) acc[d.doc_type] = [];
        acc[d.doc_type].push({
          id: d.id,
          loan_id: d.loan_id,
          user_id: d.user_id,
          doc_type: d.doc_type,
          url: d.url,
          public_id: d.public_id,
          file_format: d.file_format,
          file_size: Number(d.file_size || 0),
          uploaded_at: d.uploaded_at,
        });
        return acc;
      }, {});

      console.log(`📁 admin loan-documents grouped keys=${Object.keys(grouped).join(",") || "(none)"}`);
      return res.json({ loanId, documents: grouped });
    } catch (err) {
      console.error("❌ /api/upload/admin/loan-documents ERROR:", err);
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }
);

module.exports = router;
