const express = require('express')
const router = express.Router()
const {
  getAllDonors,
  createFoodPosting,
  getDonorPostings
} = require('../controllers/donor.controller')
const { generatePassport } = require('../services/passport.service')

router.get('/', getAllDonors)
router.post('/food-posting', createFoodPosting)
router.get('/:id/postings', getDonorPostings)

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

module.exports = router