const express = require('express')
const router = express.Router()
const { getAllDonors, createFoodPosting, getDonorPostings } = require('../controllers/donor.controller')

router.get('/', getAllDonors)
router.post('/food-posting', createFoodPosting)
router.get('/:id/postings', getDonorPostings)

module.exports = router