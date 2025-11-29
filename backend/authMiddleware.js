// authMiddleware.js
// Verifies Bearer JWT in Authorization header and attaches normalized user to req.user

const jwt = require("jsonwebtoken");

// Use environment variable; fallback for local dev only.
const JWT_SECRET = process.env.JWT_SECRET || "TEMP_DEV_SECRET";

module.exports = function (req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Expect "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Malformed authorization header" });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ error: "Empty token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // token expired, invalid signature, etc.
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Normalize payload: many of your routes expect req.user.id and req.user.role
    const userPayload = decoded.user || decoded;
    if (!userPayload || !userPayload.id) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Attach minimal user object to request
    req.user = {
      id: userPayload.id,
      role: (userPayload.role || "BORROWER").toString().toUpperCase(),
      // include any other fields you trust from token (email etc.) if needed
      ...(userPayload.email ? { email: userPayload.email } : {}),
      ...(userPayload.full_name ? { full_name: userPayload.full_name } : {}),
    };

    return next();
  } catch (err) {
    console.error("Auth middleware unexpected error:", err);
    return res.status(500).json({ error: "Auth middleware error" });
  }
};
