const prisma = require('../prisma/client')
const { runMatchingForPosting } = require('../services/matching.service')
const { calculateUrgencyScore } = require('../algorithms/tsp/urgencyWeight')
const { calculateFoodSafetyScore } = require('../algorithms/foodSafety')

// GET /api/donors/me
const getMyProfile = async (req, res, next) => {
  try {
    const donor = await prisma.donor.findUnique({
      where: { id: req.user.entityId },
      include: {
        foodPostings: {
          include: {
            pickup: {
              include: {
                driver: true,
                shelter: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor not found' })
    }

    res.json({ success: true, data: donor })
  } catch (error) {
    next(error)
  }
}
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

// PUT /api/donors/:id/location
const updateLocation = async (req, res, next) => {
  try {
    const lat = parseFloat(req.body.lat)
    const lng = parseFloat(req.body.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid lat and lng are required'
      })
    }

    const donor = await prisma.donor.update({
      where: { id: req.params.id },
      data: { lat, lng }
    })

    res.json({ success: true, data: donor })
  } catch (error) {
    next(error)
  }
}

// GET /api/donors/:id/impact
const getDonorImpact = async (req, res, next) => {
  try {
    const donor = await prisma.donor.findUnique({
      where: { id: req.params.id }
    })

    const deliveredPickups = await prisma.pickup.findMany({
      where: {
        status: 'DELIVERED',
        foodPosting: { donorId: req.params.id }
      },
      include: {
        foodPosting: {
          select: { quantityKg: true }
        }
      }
    })

    const totalKgDonated = deliveredPickups.reduce((sum, pickup) => {
      return sum + (pickup.foodPosting?.quantityKg || 0)
    }, 0)

    res.json({
      success: true,
      data: {
        totalDonations: deliveredPickups.length,
        totalKgDonated: Math.round(totalKgDonated * 10) / 10,
        mealsProvided: Math.round(totalKgDonated * 2.5),
        badgeLevel: donor?.badgeLevel || 'BRONZE'
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getAllDonors,
  getMyProfile,
  createFoodPosting,
  getDonorPostings,
  updateLocation,
  getDonorImpact
}