/**
 * Basic Auth Middleware
 * Production mein JWT use karo
 * Abhi ke liye basic header check
 */
const authMiddleware = (req, res, next) => {
  // Demo mode — sab allow karo
  // Production mein yeh replace karo JWT verification se
  next()
}

module.exports = { authMiddleware }