let io

const initSocket = (socketIo) => {
  io = socketIo

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    socket.on('driver:location', (data) => {
      io.emit('driver:location:update', data)
    })

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`)
    })
  })
}

const emitToAll = (event, data) => {
  if (io) io.emit(event, data)
}

const emitToRoom = (room, event, data) => {
  if (io) io.to(room).emit(event, data)
}

module.exports = { initSocket, emitToAll, emitToRoom }