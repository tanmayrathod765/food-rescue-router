const express = require('express')
const router = express.Router()
const { getAllDrivers, getAvailableDrivers, updateAvailability, updateLocation } = require('../controllers/driver.controller')

router.get('/', getAllDrivers)
router.get('/available', getAvailableDrivers)
router.put('/:id/availability', updateAvailability)
router.put('/:id/location', updateLocation)

module.exports = router