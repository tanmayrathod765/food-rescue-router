const prisma = require('../prisma/client')
const { emitToAll } = require('../services/socket.service')

// GET /api/drivers/me
const getMyProfile = async (req, res, next) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.user.entityId },
      include: {
        pickups: {
          include: {
            foodPosting: {
              include: { donor: true }
            },
            shelter: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' })
    }

    const activePickup = driver.pickups.find(p => ['CLAIMED', 'IN_PROGRESS'].includes(p.status)) || null

    res.json({
      success: true,
      data: {
        ...driver,
        activePickup
      }
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/drivers
const getAllDrivers = async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany()
    res.json({ success: true, data: drivers })
  } catch (error) {
    next(error)
  }
}

// GET /api/drivers/available
const getAvailableDrivers = async (req, res, next) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { isAvailable: true }
    })
    res.json({ success: true, data: drivers })
  } catch (error) {
    next(error)
  }
}

// PUT /api/drivers/:id/availability
const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { isAvailable }
    })
    res.json({ success: true, data: driver })
  } catch (error) {
    next(error)
  }
}

// PUT /api/drivers/:id/location
const updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'lat aur lng required'
      })
    }

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: {
        currentLat: parseFloat(lat),
        currentLng: parseFloat(lng)
      }
    })

    // Broadcast to admin map
    emitToAll('driver:location:update', {
      driverId: driver.id,
      driverName: driver.name,
      lat: driver.currentLat,
      lng: driver.currentLng,
      vehicleType: driver.vehicleType,
      isAvailable: driver.isAvailable
    })

    res.json({ success: true, data: driver })
  } catch (error) {
    next(error)
  }
}
module.exports = {
  getMyProfile,
  getAllDrivers,
  getAvailableDrivers,
  updateAvailability,
  updateLocation
}