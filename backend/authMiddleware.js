// authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "LOCAL_DEV_SECRET_ONLY";

/**
 * authMiddleware
 *
 * - Extracts JWT from Authorization header ("Bearer <token>") or ?token= query param.
 * - Verifies token using JWT_SECRET.
 * - Supports token payload shapes:
 *     { user: { id, role, ... } }   (preferred)
 *     { id, role, ... }             (legacy)
 * - Attaches req.user = { id, role, ... } with role normalized to lowercase for easier checks.
 * - On failure: responds with 401 Unauthorized and helpful debug message.
 *
 * Usage:
 *   app.use("/api/...", authMiddleware);
 */
function authMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header or query param or body (convenience)
    const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
    let token = null;

    if (authHeader && typeof authHeader === "string") {
      const parts = authHeader.split(" ");
      if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
        token = parts[1];
      } else if (parts.length === 1) {
        // in case header is just token
        token = parts[0];
      }
    }

    // fallback to query param or body
    if (!token) token = req.query?.token || req.body?.token || null;

    if (!token) {
      console.warn("🔒 authMiddleware: missing token");
      return res.status(401).json({ error: "Unauthorized", message: "Missing token" });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn("🔒 authMiddleware: token verification failed:", err.message);
      return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    }

    // Accept either payload.user or the payload itself
    const userPayload = payload && payload.user ? payload.user : payload;

    if (!userPayload || !userPayload.id) {
      console.warn("🔒 authMiddleware: token payload missing user id:", payload);
      return res.status(401).json({ error: "Unauthorized", message: "Invalid token payload" });
    }

    // Normalize role and expose useful user object
    const roleRaw = userPayload.role || userPayload.role || "borrower";
    const roleNormalized = (typeof roleRaw === "string") ? roleRaw.toLowerCase() : "borrower";

    req.user = {
      id: userPayload.id,
      role: roleNormalized,
      // include any other fields from token if present (email, full_name, etc.)
      ...(userPayload.email ? { email: userPayload.email } : {}),
      ...(userPayload.full_name ? { full_name: userPayload.full_name } : {}),
    };

    // Debug log
    // Avoid logging entire token payload in production — only minimal info
    console.log(`🔐 authMiddleware: user authenticated id=${req.user.id} role=${req.user.role}`);

    return next();
  } catch (err) {
    console.error("❌ authMiddleware unexpected error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = authMiddleware;
