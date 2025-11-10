const jwt = require('jsonwebtoken');

// --- IMPORTANT: This must be the EXACT same secret key as in index.js ---
const JWT_SECRET = 'a_super_secret_key_that_should_be_long_and_random';

module.exports = function(req, res, next) {
  // 1. Get the token from the request header.
  const token = req.header('x-auth-token');

  // 2. If no token is provided, deny access.
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // 3. If a token exists, verify it using the secret key.
    const decoded = jwt.verify(token, JWT_SECRET);

    // 4. If the token is valid, add the user's info to the request object.
    req.user = decoded.user;
    
    // 5. Call next() to pass the request to the next middleware or route handler.
    next();
  } catch (err) {
    // If the token is invalid (e.g., expired, tampered with, wrong secret), deny access.
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
