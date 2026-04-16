const prisma = require('../prisma/client')
const { emitToAll } = require('../services/socket.service')

function canModifyShelter(req, shelterId) {
  return req.user?.role === 'ADMIN' || req.user?.entityId === shelterId
}

// GET /api/shelters
const getAllShelters = async (req, res, next) => {
  try {
    const shelters = await prisma.shelter.findMany()
    res.json({ success: true, data: shelters })
  } catch (error) {
    next(error)
  }
}

// GET /api/shelters/me
const getMyProfile = async (req, res, next) => {
  try {
    const shelter = await prisma.shelter.findUnique({
      where: { id: req.user.entityId }
    })

    if (!shelter) {
      return res.status(404).json({ success: false, message: 'Shelter not found' })
    }

    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

// GET /api/shelters/me/pickups
const getMyPickups = async (req, res, next) => {
  try {
    const pickups = await prisma.pickup.findMany({
      where: { shelterId: req.user.entityId },
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

// GET /api/shelters/leaderboard
const getShelterLeaderboard = async (req, res, next) => {
  try {
    const shelters = await prisma.shelter.findMany({
      include: {
        pickups: {
          where: { status: 'DELIVERED' },
          include: {
            foodPosting: {
              select: { quantityKg: true }
            }
          }
        }
      }
    })

    const leaderboard = shelters
      .map(shelter => {
        const totalKgReceived = shelter.pickups.reduce((sum, pickup) => {
          return sum + Number(pickup.foodPosting?.quantityKg || 0)
        }, 0)

        return {
          id: shelter.id,
          name: shelter.name,
          totalDeliveries: shelter.pickups.length,
          totalKgReceived: Math.round(totalKgReceived * 10) / 10,
          mealsServed: Math.round(totalKgReceived * 2.5)
        }
      })
      .sort((a, b) => {
        if (b.totalKgReceived !== a.totalKgReceived) {
          return b.totalKgReceived - a.totalKgReceived
        }
        return b.totalDeliveries - a.totalDeliveries
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }))

    res.json({ success: true, data: leaderboard })
  } catch (error) {
    next(error)
  }
}

// POST /api/shelters/me/report-driver
const reportDriverIssue = async (req, res, next) => {
  try {
    const { pickupId, reason, details } = req.body || {}

    if (!pickupId || !reason) {
      return res.status(400).json({
        success: false,
        message: 'pickupId and reason are required'
      })
    }

    const pickup = await prisma.pickup.findUnique({
      where: { id: pickupId },
      include: {
        driver: true,
        shelter: true
      }
    })

    if (!pickup || pickup.shelterId !== req.user.entityId) {
      return res.status(404).json({
        success: false,
        message: 'Pickup not found for this shelter'
      })
    }

    if (!pickup.driverId) {
      return res.status(400).json({
        success: false,
        message: 'No assigned driver for this pickup'
      })
    }

    const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
      ? pickup.routeData
      : {}

    const existingReports = Array.isArray(currentRouteData.driverReports)
      ? currentRouteData.driverReports
      : []

    const newReport = {
      id: `${pickup.id}-${Date.now()}`,
      shelterId: req.user.entityId,
      reason: String(reason).trim(),
      details: String(details || '').trim(),
      createdAt: new Date().toISOString()
    }

    await prisma.pickup.update({
      where: { id: pickup.id },
      data: {
        routeData: {
          ...currentRouteData,
          driverReports: [newReport, ...existingReports]
        }
      }
    })

    emitToAll('notification:new', {
      userId: pickup.driverId,
      type: 'DRIVER_REPORT',
      message: `Issue reported by shelter ${pickup.shelter?.name || ''}: ${newReport.reason}`.trim()
    })

    emitToAll('shelter:driver_reported', {
      pickupId: pickup.id,
      shelterId: req.user.entityId,
      driverId: pickup.driverId,
      reason: newReport.reason,
      details: newReport.details
    })

    res.json({ success: true, message: 'Driver issue reported successfully', data: newReport })
  } catch (error) {
    next(error)
  }
}

// PUT /api/shelters/:id/capacity
const updateCapacity = async (req, res, next) => {
  try {
    if (!canModifyShelter(req, req.params.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this shelter' })
    }

    const { currentCommittedKg } = req.body
    const shelter = await prisma.shelter.update({
      where: { id: req.params.id },
      data: { currentCommittedKg }
    })
    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

// PUT /api/shelters/:id/accepting
const updateAccepting = async (req, res, next) => {
  try {
    if (!canModifyShelter(req, req.params.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this shelter' })
    }

    const { isAccepting } = req.body
    const shelter = await prisma.shelter.update({
      where: { id: req.params.id },
      data: { isAccepting }
    })
    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

// PUT /api/shelters/:id/location
const updateLocation = async (req, res, next) => {
  try {
    if (!canModifyShelter(req, req.params.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this shelter' })
    }

    const lat = parseFloat(req.body.lat)
    const lng = parseFloat(req.body.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid lat and lng are required'
      })
    }

    const shelter = await prisma.shelter.update({
      where: { id: req.params.id },
      data: { lat, lng }
    })

    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAllShelters,
  getMyProfile,
  getMyPickups,
  getShelterLeaderboard,
  reportDriverIssue,
  updateCapacity,
  updateAccepting,
  updateLocation
}
