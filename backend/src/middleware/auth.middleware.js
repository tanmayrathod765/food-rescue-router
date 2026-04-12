const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET || 'foodrescue_secret_123'

/**
 * Token verify karta hai
 */
const protect = async (req, res, next) => {
  try {
    let token

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized — no token'
      })
    }

    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    })

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      })
    }

    req.user = user
    next()

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — invalid token'
    })
  }
}

/**
 * Role check karta hai
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} not authorized`
      })
    }
    next()
  }
}

/**
 * JWT token generate karta hai
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: '7d'
  })
}

module.exports = { protect, authorize, generateToken }