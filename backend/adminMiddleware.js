// adminMiddleware.js
// Ensures authMiddleware ran first and that the user has ADMIN role

module.exports = function (req, res, next) {
  // authMiddleware must set req.user
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Role check (case-insensitive, normalized in authMiddleware)
  const role = (req.user.role || "").toString().toUpperCase();
  if (role === "ADMIN" || role === "SUPERADMIN") {
    return next();
  }

  return res.status(403).json({ error: "Access denied. Admin role required." });
};
