const express = require('express')
const router = express.Router()
const {
	getAllShelters,
	getMyProfile,
	getMyPickups,
	getShelterLeaderboard,
	reportDriverIssue,
	updateCapacity,
	updateAccepting,
	updateLocation
} = require('../controllers/shelter.controller')
const { protect, authorize } = require('../middleware/auth.middleware')

router.get('/', getAllShelters)
router.get('/me', protect, authorize('SHELTER'), getMyProfile)
router.get('/me/pickups', protect, authorize('SHELTER'), getMyPickups)
router.get('/leaderboard', protect, getShelterLeaderboard)
router.post('/me/report-driver', protect, authorize('SHELTER'), reportDriverIssue)
router.put('/:id/capacity', protect, authorize('SHELTER', 'ADMIN'), updateCapacity)
router.put('/:id/accepting', protect, authorize('SHELTER', 'ADMIN'), updateAccepting)
router.put('/:id/location', protect, authorize('SHELTER', 'ADMIN'), updateLocation)

module.exports = router