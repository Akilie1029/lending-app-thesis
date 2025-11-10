module.exports = function(req, res, next) {
  // This middleware runs AFTER authMiddleware,
  // so we can assume req.user is already available.

  if (req.user && req.user.role === 'admin') {
    // If the user's role is 'admin', allow the request to continue.
    next();
  } else {
    // If not, deny access with a '403 Forbidden' error.
    res.status(403).json({ msg: 'Access denied. Admin role required.' });
  }
};