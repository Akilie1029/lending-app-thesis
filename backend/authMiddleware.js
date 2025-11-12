// =================================================================
//                  AUTH MIDDLEWARE (Stable Version)
// =================================================================

const jwt = require('jsonwebtoken');

// ⚠️ IMPORTANT: Must match JWT_SECRET used in your /auth/login and /auth/register routes
const JWT_SECRET = 'a_super_secret_key_that_should_be_long_and_random';

module.exports = function (req, res, next) {
  const authHeader = req.headers['authorization'];

  // 🔎 Step 1: Check Authorization header
  console.log('🔐 Incoming Authorization Header:', authHeader || '(none)');
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Expect header like "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('❌ Malformed Authorization header.');
    return res.status(401).json({ error: 'Malformed token' });
  }

  const token = parts[1];
  console.log('📦 Extracted Token:', token ? token.slice(0, 25) + '...' : 'none');

  try {
    // 🧠 Step 2: Verify JWT signature
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ JWT Verified. Decoded payload:', decoded);

    // 🧩 Step 3: Normalize payload structure
    // Some tokens may be { user: { id, email } }, others just { id, email }
    const userPayload = decoded.user || decoded;

    // 🧩 Step 4: Ensure it contains an ID
    if (!userPayload?.id) {
      console.log('❌ JWT payload missing user id.');
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // ✅ Step 5: Attach user info to request
    req.user = userPayload;

    console.log('👤 Authenticated User ID:', req.user.id);
    next();
  } catch (err) {
    console.error('❌ JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
