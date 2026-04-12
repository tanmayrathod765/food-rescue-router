const express = require('express')
const router = express.Router()
const {
  getDriverLeaderboard,
  getDonorLeaderboard,
  getBadges,
  getStreak
} = require('../services/gamification.service')

// GET /api/gamification/leaderboard/drivers
router.get('/leaderboard/drivers', async (req, res, next) => {
  try {
    const data = await getDriverLeaderboard()
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// GET /api/gamification/leaderboard/donors
router.get('/leaderboard/donors', async (req, res, next) => {
  try {
    const data = await getDonorLeaderboard()
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// GET /api/gamification/badges/:entityId
router.get('/badges/:entityId', async (req, res, next) => {
  try {
    const data = await getBadges(req.params.entityId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

// GET /api/gamification/streak/:entityId
router.get('/streak/:entityId', async (req, res, next) => {
  try {
    const data = await getStreak(req.params.entityId)
    res.json({ success: true, data })
  } catch (err) { next(err) }
})

module.exports = router