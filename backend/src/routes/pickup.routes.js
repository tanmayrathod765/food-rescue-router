const express = require('express')
const router = express.Router()

router.get('/', (req, res) => {
  res.json({ message: 'Pickup routes working' })
})

module.exports = router