// adminMiddleware.js

/**
 * adminMiddleware
 *
 * Protects admin routes.
 *
 * Requires:
 *   req.user = { id, role }
 *   role must be 'admin' (case-insensitive)
 *
 * If role is missing or not admin → 403 Forbidden
 *
 * This middleware MUST be placed AFTER authMiddleware.
 */

function adminMiddleware(req, res, next) {
  try {
    // Ensure authMiddleware already decoded the token
    if (!req.user) {
      console.warn("🔒 adminMiddleware: req.user missing — authMiddleware was not run or token invalid.");
      return res.status(401).json({ error: "Unauthorized", message: "Authentication required" });
    }

    const role = (req.user.role || "").toLowerCase();

    console.log(`🛂 adminMiddleware: user=${req.user.id} role=${role}`);

    if (role !== "admin") {
      console.warn(`🚫 adminMiddleware: access denied for user=${req.user.id}, role=${role}`);
      return res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    }

    console.log(`✅ adminMiddleware: access granted to admin user=${req.user.id}`);
    return next();
  } catch (err) {
    console.error("❌ adminMiddleware ERROR:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

module.exports = adminMiddleware;
