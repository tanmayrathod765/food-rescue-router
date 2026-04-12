const express = require('express')
const { analyzeZones } = require('../controllers/zones.controller')

const router = express.Router()

router.get('/analysis', analyzeZones)

module.exports = router
