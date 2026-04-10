const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { emitToAll } = require('../services/socket.service')

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
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { currentLat: lat, currentLng: lng }
    })

    // Broadcast location to dashboard
    emitToAll('driver:location:update', {
      driverId: driver.id,
      driverName: driver.name,
      lat, lng
    })

    res.json({ success: true, data: driver })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAllDrivers,
  getAvailableDrivers,
  updateAvailability,
  updateLocation
}