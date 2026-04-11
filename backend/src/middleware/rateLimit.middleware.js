const rateLimitMap = new Map()

/**
 * Simple in-memory rate limiter
 * Production mein Redis use karo
 */
const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowStart = now - windowMs

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, [])
    }

    // Old requests clean karo
    const requests = rateLimitMap.get(ip).filter(t => t > windowStart)
    requests.push(now)
    rateLimitMap.set(ip, requests)

    if (requests.length > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests — please slow down'
      })
    }

    next()
  }
}

module.exports = { rateLimit }