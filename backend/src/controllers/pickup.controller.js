const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
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
    const { foodPostingId, driverId, shelterId } = req.body

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
    const { driverId } = req.body
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
    const { driverId } = req.body
    const result = await markDelivered(id, driverId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

module.exports = { getAllPickups, claim, pickedUp, delivered }