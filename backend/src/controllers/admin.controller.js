const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { emitToAll } = require('../services/socket.service')

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [
      activeDrivers,
      pendingPickups,
      deliveredToday,
      totalPostings,
      expiredPostings
    ] = await Promise.all([
      prisma.driver.count({ where: { isAvailable: true } }),
      prisma.pickup.count({ where: { status: 'PENDING' } }),
      prisma.pickup.findMany({
        where: {
          status: 'DELIVERED',
          deliveredAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        include: { foodPosting: true }
      }),
      prisma.foodPosting.count(),
      prisma.foodPosting.count({ where: { status: 'EXPIRED' } })
    ])

    const kgDeliveredToday = deliveredToday.reduce(
      (sum, p) => sum + (p.foodPosting?.quantityKg || 0), 0
    )

    res.json({
      success: true,
      data: {
        activeDrivers,
        pendingPickups,
        deliveriesToday: deliveredToday.length,
        kgDeliveredToday: Math.round(kgDeliveredToday * 10) / 10,
        mealsToday: Math.round(kgDeliveredToday * 2.5),
        totalPostings,
        expiredPostings
      }
    })
  } catch (error) {
    next(error)
  }
}

// POST /api/admin/expire-old-postings
const expireOldPostings = async (req, res, next) => {
  try {
    const result = await prisma.foodPosting.updateMany({
      where: {
        closingTime: { lt: new Date() },
        status: 'AVAILABLE'
      },
      data: { status: 'EXPIRED' }
    })

    emitToAll('admin:postings_expired', { count: result.count })

    res.json({
      success: true,
      message: `${result.count} postings expired`
    })
  } catch (error) {
    next(error)
  }
}

module.exports = { getStats, expireOldPostings }