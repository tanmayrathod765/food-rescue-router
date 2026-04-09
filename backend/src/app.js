const express = require('express')
const cors = require('cors')
const { errorMiddleware } = require('./middleware/error.middleware')

const donorRoutes = require('./routes/donor.routes')
const driverRoutes = require('./routes/driver.routes')
const shelterRoutes = require('./routes/shelter.routes')
const pickupRoutes = require('./routes/pickup.routes')
const adminRoutes = require('./routes/admin.routes')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}))
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.use('/api/donors', donorRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/shelters', shelterRoutes)
app.use('/api/pickups', pickupRoutes)
app.use('/api/admin', adminRoutes)

app.use(errorMiddleware)

module.exports = app