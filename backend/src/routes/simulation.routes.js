const express = require('express')
const router = express.Router()
const { runScenario } = require('../services/simulation.service')

// POST /api/simulation/run
router.post('/run', async (req, res, next) => {
  try {
    const { scenario, speed = 1 } = req.body
    if (!scenario) {
      return res.status(400).json({
        success: false,
        message: 'scenario required (A/B/C/D)'
      })
    }
    // Non-blocking — simulation runs in background
    runScenario(scenario, speed).catch(console.error)
    res.json({
      success: true,
      message: `Scenario ${scenario} started`
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router