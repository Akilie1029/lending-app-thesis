module.exports = function (req, res, next) {
  // Ensure authMiddleware ran first
  if (!req.user) {
    return res.status(401).json({ msg: "Unauthorized" });
  }

  // Allow ONLY admins
  if (req.user.role?.toUpperCase() === "ADMIN") {
    return next();
  }

  return res.status(403).json({ msg: "Access denied. Admin role required." });
};
