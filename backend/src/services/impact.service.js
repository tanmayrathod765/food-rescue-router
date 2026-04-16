const prisma = require('../prisma/client')
const { emitToAll } = require('./socket.service')

/**
 * Delivery complete hone ke baad impact calculate karo
 * aur donor/driver ko message bhejo
 */
async function generateImpactReport(pickupId) {
  try {
    const pickup = await prisma.pickup.findUnique({
      where: { id: pickupId },
      include: {
        foodPosting: { include: { donor: true } },
        driver: true,
        shelter: true
      }
    })

    if (!pickup) return { success: false }

    const kg = pickup.foodPosting.quantityKg
    const meals = Math.round(kg * 2.5)
    const co2Saved = Math.round(kg * 2.5 * 10) / 10
    const moneyValue = Math.round(kg * 150)

    const report = {
      pickupId,
      donor: {
        name: pickup.foodPosting.donor.name,
        message: `🙏 Aapki ${kg}kg donation se aaj raat ${meals} logon ne khana khaya!`,
        stats: { kg, meals, co2Saved, moneyValue }
      },
      driver: {
        name: pickup.driver?.name,
        message: `🎉 Amazing! Aaj tumne ${meals} logon ka pet bhara. Total rescued: ${pickup.driver?.totalKgRescued}kg`,
        milestone: pickup.driver?.totalDeliveries % 10 === 0
          ? `🏆 ${pickup.driver?.totalDeliveries} deliveries complete!`
          : null
      },
      shelter: {
        name: pickup.shelter?.name,
        message: `✅ ${kg}kg food received — ~${meals} meals ready`
      }
    }

    // Broadcast impact
    emitToAll('impact:report', report)

    return { success: true, report }
  } catch (err) {
    console.error(err)
    return { success: false }
  }
}

module.exports = { generateImpactReport }