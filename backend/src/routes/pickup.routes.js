const express = require('express')
const router = express.Router()
const { getAllPickups, claim, pickedUp, delivered } = require('../controllers/pickup.controller')

router.get('/', getAllPickups)
router.post('/claim', claim)
router.put('/:id/picked-up', pickedUp)
router.put('/:id/delivered', delivered)

module.exports = router