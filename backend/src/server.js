require('dotenv').config()
const http = require('http')
const { Server } = require('socket.io')
const app = require('./app')
const { initSocket } = require('./services/socket.service')

const PORT = process.env.PORT || 5000

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST']
  }
})

initSocket(io)

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
})