const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { runMatchingForPosting } = require('../services/matching.service')
const { calculateUrgencyScore } = require('../algorithms/tsp/urgencyWeight')
const { calculateFoodSafetyScore } = require('../algorithms/foodSafety')
// GET /api/donors
const getAllDonors = async (req, res, next) => {
  try {
    const donors = await prisma.donor.findMany({
      include: { foodPostings: true }
    })
    res.json({ success: true, data: donors })
  } catch (error) {
    next(error)
  }
}

// POST /api/donors/food-posting
const createFoodPosting = async (req, res, next) => {
  try {
    const {
      donorId, foodType, isVeg,
      quantityKg, description, closingTime
    } = req.body

    if (!donorId || !foodType || !quantityKg || !closingTime) {
      return res.status(400).json({
        success: false,
        message: 'donorId, foodType, quantityKg, closingTime required'
      })
    }

    // Urgency score calculate karo
    const urgencyScore = calculateUrgencyScore({
      foodType,
      quantityKg,
      closingTime: new Date(closingTime)
    })

    const parsedTimeSinceCooked = parseInt(req.body.timeSinceCooked, 10) || 0
    const isRefrigerated = Boolean(req.body.isRefrigerated)

    // Safety score calculate karo
    const safetyResult = calculateFoodSafetyScore({
      foodType,
      timeSinceCooked: parsedTimeSinceCooked,
      isRefrigerated,
      closingTime: new Date(closingTime),
      quantityKg: parseFloat(quantityKg)
    })

    // Food posting create karo
    const posting = await prisma.foodPosting.create({
      data: {
        donorId,
        foodType,
        isVeg: isVeg ?? true,
        quantityKg: parseFloat(quantityKg),
        description,
        closingTime: new Date(closingTime),
        urgencyScore,
        safetyScore: safetyResult.score,
        isRefrigerated,
        timeSinceCooked: parsedTimeSinceCooked
      },
    })

    // Pickup record create karo
    await prisma.pickup.create({
      data: { foodPostingId: posting.id }
    })

    // Matching engine trigger karo
    runMatchingForPosting(posting.id).catch(console.error)

    res.status(201).json({
      success: true,
      message: 'Food posting created — matching in progress',
      data: posting
    })
  } catch (error) {
    next(error)
  }
}

// GET /api/donors/:id/postings
const getDonorPostings = async (req, res, next) => {
  try {
    const postings = await prisma.foodPosting.findMany({
      where: { donorId: req.params.id },
      include: { pickup: { include: { driver: true, shelter: true } } },
      orderBy: { createdAt: 'desc' }
    })
    res.json({ success: true, data: postings })
  } catch (error) {
    next(error)
  }
}

module.exports = { getAllDonors, createFoodPosting, getDonorPostings }