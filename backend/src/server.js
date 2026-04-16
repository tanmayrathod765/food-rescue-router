require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const prisma = require('./prisma/client')
const app = require('./app')
const { initSocket } = require('./services/socket.service')

const PORT = process.env.PORT || 5000

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean)

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      const isVercelPreview = origin && /https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)
      if (!origin || allowedOrigins.includes(origin) || isVercelPreview) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
})

initSocket(io)

// Auto-expire old postings every 5 minutes
setInterval(async () => {
  try {
    const result = await prisma.foodPosting.updateMany({
      where: {
        closingTime: { lt: new Date() },
        status: 'AVAILABLE'
      },
      data: { status: 'EXPIRED' }
    })
    if (result.count > 0) {
      console.log(`[CRON] ${result.count} postings expired`)
    }
  } catch (err) {
    console.error('[CRON] Error expiring postings:', err.message)
  }
}, 5 * 60 * 1000)

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV}`)
})