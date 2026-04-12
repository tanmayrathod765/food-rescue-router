const express = require('express')
const router = express.Router()
const {
  getAllDrivers,
  getAvailableDrivers,
  updateAvailability,
  updateLocation
} = require('../controllers/driver.controller')
const { protect } = require('../middleware/auth.middleware')

router.get('/', getAllDrivers)
router.get('/available', getAvailableDrivers)
router.put('/:id/availability', protect, updateAvailability)
router.put('/:id/location', protect, updateLocation)

module.exports = router