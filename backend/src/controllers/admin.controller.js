const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/admin/stats
const getStats = async (req, res, next) => {
  try {
    const [
      activeDrivers,
      pendingPickups,
      deliveredToday,
      totalPostings
    ] = await Promise.all([
      prisma.driver.count({ where: { isAvailable: true } }),
      prisma.pickup.count({ where: { status: 'PENDING' } }),
      prisma.pickup.findMany({
        where: {
          status: 'DELIVERED',
          deliveredAt: { gte: new Date(new Date().setHours(0,0,0,0)) }
        },
        include: { foodPosting: true }
      }),
      prisma.foodPosting.count()
    ])

    const kgDeliveredToday = deliveredToday.reduce(
      (sum, p) => sum + p.foodPosting.quantityKg, 0
    )

    res.json({
      success: true,
      data: {
        activeDrivers,
        pendingPickups,
        deliveriesToday: deliveredToday.length,
        kgDeliveredToday: Math.round(kgDeliveredToday * 10) / 10,
        mealsToday: Math.round(kgDeliveredToday * 2.5),
        totalPostings
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = { getStats }