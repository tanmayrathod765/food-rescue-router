const bcrypt = require('bcryptjs')
const prisma = require('../prisma/client')
const { generateToken } = require('../middleware/auth.middleware')

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, role, name, phone,
            address, lat, lng, vehicleType,
            capacityKg, maxCapacityKg,
            acceptingFrom, acceptingTill,
            contactName, contactPhone } = req.body

    if (!email || !password || !role || !name) {
      return res.status(400).json({
        success: false,
        message: 'email, password, role, name required'
      })
    }

    // Check duplicate
    const existing = await prisma.user.findUnique({
      where: { email }
    })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      })
    }

    // Password hash karo
    const hashedPassword = await bcrypt.hash(password, 12)

    let entityId = null

    // Role ke hisaab se entity banao
    if (role === 'RESTAURANT') {
      const donor = await prisma.donor.create({
        data: {
          name,
          address: address || 'Indore',
          lat: parseFloat(lat) || 22.7196,
          lng: parseFloat(lng) || 75.8577,
          contactName: contactName || name,
          contactPhone: contactPhone || phone || '0000000000',
          email,
          password: hashedPassword
        }
      })
      entityId = donor.id

    } else if (role === 'DRIVER') {
      const driver = await prisma.driver.create({
        data: {
          name,
          email,
          password: hashedPassword,
          phone: phone || '0000000000',
          vehicleType: vehicleType || 'CAR',
          capacityKg: parseFloat(capacityKg) || 20,
          currentLat: parseFloat(lat) || 22.7196,
          currentLng: parseFloat(lng) || 75.8577,
          isAvailable: false
        }
      })
      entityId = driver.id

    } else if (role === 'SHELTER') {
      const shelter = await prisma.shelter.create({
        data: {
          name,
          address: address || 'Indore',
          lat: parseFloat(lat) || 22.7196,
          lng: parseFloat(lng) || 75.8577,
          contactName: contactName || name,
          contactPhone: contactPhone || phone || '0000000000',
          email,
          password: hashedPassword,
          maxCapacityKg: parseFloat(maxCapacityKg) || 100,
          acceptingFrom: acceptingFrom || '18:00',
          acceptingTill: acceptingTill || '22:00'
        }
      })
      entityId = shelter.id

    } else if (role === 'ADMIN') {
      entityId = 'admin'
    }

    // User create karo
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
        entityId,
        isApproved: true
      }
    })

    const token = generateToken(user.id)

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        entityId: user.entityId
      }
    })

  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email aur password required'
      })
    }

    // User find karo
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    // Password check karo
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account deactivated'
      })
    }

    // Last login update karo
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    const token = generateToken(user.id)

    // Entity data fetch karo
    let entityData = null
    if (user.role === 'RESTAURANT') {
      entityData = await prisma.donor.findUnique({
        where: { id: user.entityId }
      })
    } else if (user.role === 'DRIVER') {
      entityData = await prisma.driver.findUnique({
        where: { id: user.entityId }
      })
    } else if (user.role === 'SHELTER') {
      entityData = await prisma.shelter.findUnique({
        where: { id: user.entityId }
      })
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        entityId: user.entityId,
        entityData
      }
    })

  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    let entityData = null
    if (req.user.role === 'RESTAURANT') {
      entityData = await prisma.donor.findUnique({
        where: { id: req.user.entityId }
      })
    } else if (req.user.role === 'DRIVER') {
      entityData = await prisma.driver.findUnique({
        where: { id: req.user.entityId }
      })
    } else if (req.user.role === 'SHELTER') {
      entityData = await prisma.shelter.findUnique({
        where: { id: req.user.entityId }
      })
    }

    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        entityId: req.user.entityId,
        entityData
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' })
}

module.exports = { register, login, getMe, logout }