/**
 * No-Show Prevention Service
 * 
 * Driver accept kare aur na aaye →
 * Backup driver silently alert ho
 */

const prisma = require('../prisma/client')
const { emitToAll } = require('./socket.service')
const { findBestDriver } = require('../algorithms/matching/index')

const NO_SHOW_TIMEOUT_MINUTES = 15
const noShowTimers = new Map()

/**
 * Pickup claim hone ke baad timer start karo
 * Agar driver 15 min mein pickup nahi karta → no-show
 */
async function startNoShowTimer(pickupId, foodPostingId, driverId) {
  // Existing timer clear karo
  if (noShowTimers.has(pickupId)) {
    clearTimeout(noShowTimers.get(pickupId))
  }

  const timer = setTimeout(async () => {
    try {
      // Check karo — still CLAIMED hai ya nahi
      const pickup = await prisma.pickup.findUnique({
        where: { id: pickupId },
        include: {
          foodPosting: { include: { donor: true } },
          driver: true,
          shelter: true
        }
      })

      if (!pickup || pickup.status !== 'CLAIMED') {
        // Driver ne pickup kar liya — no show nahi
        noShowTimers.delete(pickupId)
        return
      }

      // No-show detected!
      console.log(`[NO-SHOW] Driver ${driverId} no-show for pickup ${pickupId}`)

      // Driver trust score penalize karo
      await prisma.driver.update({
        where: { id: driverId },
        data: {
          trustScore: { decrement: 5 }
        }
      })

      // Broadcast no-show alert
      emitToAll('noshow:detected', {
        pickupId,
        driverId,
        driverName: pickup.driver?.name,
        driverPhone: pickup.driver?.phone,
        shelterId: pickup.shelterId,
        shelterName: pickup.shelter?.name,
        foodPostingId
      })

      if (pickup.shelterId) {
        emitToAll('notification:new', {
          userId: pickup.shelterId,
          type: 'NO_SHOW',
          message: `Driver ${pickup.driver?.name || ''} could not arrive. Backup search started.`.trim()
        })
      }

      // Backup driver find karo
      const availableDrivers = await prisma.driver.findMany({
        where: {
          isAvailable: true,
          id: { not: driverId }
        }
      })

      const postingForMatch = {
        id: foodPostingId,
        donorLat: pickup.foodPosting.donor.lat,
        donorLng: pickup.foodPosting.donor.lng,
        quantityKg: pickup.foodPosting.quantityKg,
        foodType: pickup.foodPosting.foodType,
        closingTime: pickup.foodPosting.closingTime
      }

      const backupMatch = findBestDriver(
        availableDrivers,
        postingForMatch
      )

      if (backupMatch.success) {
        emitToAll('noshow:backup_driver', {
          pickupId,
          shelterId: pickup.shelterId,
          backupDriver: {
            id: backupMatch.matchedDriver.id,
            name: backupMatch.matchedDriver.name,
            phone: backupMatch.matchedDriver.phone
          },
          message: `Backup driver ${backupMatch.matchedDriver.name} alerted`
        })
      }

      // Reset pickup to PENDING
      await prisma.pickup.update({
        where: { id: pickupId },
        data: {
          status: 'PENDING',
          driverId: null,
          claimedAt: null,
          version: { increment: 1 }
        }
      })

      await prisma.foodPosting.update({
        where: { id: foodPostingId },
        data: { status: 'AVAILABLE' }
      })

      noShowTimers.delete(pickupId)

    } catch (err) {
      console.error('[NO-SHOW] Error:', err.message)
    }
  }, NO_SHOW_TIMEOUT_MINUTES * 60 * 1000)

  noShowTimers.set(pickupId, timer)
}

/**
 * Timer cancel karo (jab pickup ho jaye)
 */
function cancelNoShowTimer(pickupId) {
  if (noShowTimers.has(pickupId)) {
    clearTimeout(noShowTimers.get(pickupId))
    noShowTimers.delete(pickupId)
    console.log(`[NO-SHOW] Timer cancelled for pickup ${pickupId}`)
  }
}

/**
 * Test cleanup helper
 */
function clearAllNoShowTimers() {
  for (const timer of noShowTimers.values()) {
    clearTimeout(timer)
  }
  noShowTimers.clear()
}

/**
 * No-show risk calculate karo
 */
function calculateNoShowRisk(driver) {
  const trustScore = driver.trustScore || 80
  const noShowCount = driver.noShowCount || 0

  const risk = (noShowCount * 20) + (100 - trustScore) * 0.5
  return Math.min(100, Math.round(risk))
}

module.exports = {
  startNoShowTimer,
  cancelNoShowTimer,
  clearAllNoShowTimers,
  calculateNoShowRisk
}