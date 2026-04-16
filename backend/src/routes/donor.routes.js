const express = require('express')
const router = express.Router()
const {
  getAllDonors,
  getMyProfile,
  createFoodPosting,
  getDonorPostings,
  updateLocation,
  getDonorImpact
} = require('../controllers/donor.controller')
const { protect, authorize } = require('../middleware/auth.middleware')
const { generatePassport } = require('../services/passport.service')
const { calculateFoodSafetyScore } = require('../algorithms/foodSafety')
router.get('/', getAllDonors)
router.get('/me', protect, authorize('RESTAURANT'), getMyProfile)
router.post('/food-posting', protect, authorize('RESTAURANT'), createFoodPosting)
router.get('/:id/postings', getDonorPostings)
router.put('/:id/location', protect, authorize('RESTAURANT'), updateLocation)
router.get('/:id/impact', protect, authorize('RESTAURANT', 'ADMIN'), getDonorImpact)

// Food Passport route
router.get('/passport/:foodPostingId', async (req, res, next) => {
  try {
    const result = await generatePassport(req.params.foodPostingId)
    if (!result.success) {
      return res.status(404).json(result)
    }
    res.json(result)
  } catch (error) {
    next(error)
  }
})
// Safety score calculate
router.post('/safety-score', (req, res) => {
  try {
    const result = calculateFoodSafetyScore(req.body)
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})
module.exports = router