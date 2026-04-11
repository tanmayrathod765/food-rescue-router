const express = require('express')
const router = express.Router()
const { getStats, expireOldPostings } = require('../controllers/admin.controller')

router.get('/stats', getStats)
router.post('/expire-old-postings', expireOldPostings)

module.exports = router