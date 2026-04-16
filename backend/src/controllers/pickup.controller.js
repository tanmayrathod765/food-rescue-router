const prisma = require('../prisma/client')
const { claimPickup, markPickedUp, markDelivered } = require('../services/claim.service')
const { runMatchingForPosting } = require('../services/matching.service')

// GET /api/pickups
const getAllPickups = async (req, res, next) => {
  try {
    const pickups = await prisma.pickup.findMany({
      include: {
        foodPosting: { include: { donor: true } },
        driver: true,
        shelter: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: pickups })
  } catch (error) {
    next(error)
  }
}

// POST /api/pickups/claim
const claim = async (req, res, next) => {
  try {
    const { foodPostingId, shelterId } = req.body
    const driverId = req.user?.role === 'DRIVER' ? req.user.entityId : req.body.driverId

    if (!foodPostingId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'foodPostingId and driverId required'
      })
    }

    const result = await claimPickup(foodPostingId, driverId, shelterId)

    if (result.raceConditionBlocked) {
      return res.status(409).json(result)
    }

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
}

// PUT /api/pickups/:id/picked-up
const pickedUp = async (req, res, next) => {
  try {
    const { id } = req.params
    const driverId = req.user?.role === 'DRIVER' ? req.user.entityId : req.body.driverId
    const result = await markPickedUp(id, driverId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

// PUT /api/pickups/:id/delivered
const delivered = async (req, res, next) => {
  try {
    const { id } = req.params
    const driverId = req.user?.role === 'DRIVER' ? req.user.entityId : req.body.driverId

    const pickup = await prisma.pickup.findUnique({
      where: { id }
    })

    if (!pickup) {
      return res.status(404).json({ success: false, message: 'Pickup not found' })
    }

    const routeData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
      ? pickup.routeData
      : {}

    if (!routeData.deliveryOtpVerifiedAt) {
      return res.status(400).json({
        success: false,
        message: 'Delivery OTP verification is required before marking delivered'
      })
    }

    if (!routeData.deliveryPhotoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Delivery proof photo is required before marking delivered'
      })
    }

    const result = await markDelivered(id, driverId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = { getAllPickups, claim, pickedUp, delivered }