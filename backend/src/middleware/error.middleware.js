const errorMiddleware = (err, req, res, next) => {
  console.error(err.stack)

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'Already exists'
    })
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    })
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error'
  })
}

const createError = (message, statusCode) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

module.exports = { errorMiddleware, createError }