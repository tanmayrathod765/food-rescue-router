const express = require('express')
const cors = require('cors')
const path = require('path')
const { errorMiddleware } = require('./middleware/error.middleware')
const { rateLimit } = require('./middleware/rateLimit.middleware')
const donorRoutes = require('./routes/donor.routes')
const driverRoutes = require('./routes/driver.routes')
const shelterRoutes = require('./routes/shelter.routes')
const pickupRoutes = require('./routes/pickup.routes')
const adminRoutes = require('./routes/admin.routes')
const simulationRoutes = require('./routes/simulation.routes')
const zonesRoutes = require('./routes/zones.routes')
const app = express()
const authRoutes = require('./routes/auth.routes')
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean)
const gamificationRoutes = require('./routes/gamification.routes')
app.use(cors({
  origin(origin, callback) {
    const isVercelPreview = origin && /https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
    if (!origin || allowedOrigins.includes(origin) || isVercelPreview) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(rateLimit(200, 60000))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
app.use('/api/auth', authRoutes)
app.use('/api/gamification', gamificationRoutes)
app.use('/api/simulation', simulationRoutes)
app.use('/api/zones', zonesRoutes)
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