const express = require('express')
const router = express.Router()
const {
  getMyProfile,
  getAllDrivers,
  getAvailableDrivers,
  updateAvailability,
  updateLocation
} = require('../controllers/driver.controller')
const { protect, authorize } = require('../middleware/auth.middleware')

router.get('/', getAllDrivers)
router.get('/available', getAvailableDrivers)
router.get('/me', protect, authorize('DRIVER'), getMyProfile)
router.put('/:id/availability', protect, authorize('DRIVER'), updateAvailability)
router.put('/:id/location', protect, authorize('DRIVER'), updateLocation)

module.exports = router