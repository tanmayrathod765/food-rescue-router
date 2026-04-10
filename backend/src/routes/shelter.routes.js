const express = require('express')
const router = express.Router()
const { getAllShelters, updateCapacity, updateAccepting } = require('../controllers/shelter.controller')

router.get('/', getAllShelters)
router.put('/:id/capacity', updateCapacity)
router.put('/:id/accepting', updateAccepting)

module.exports = router