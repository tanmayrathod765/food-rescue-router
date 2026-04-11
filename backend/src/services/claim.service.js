/**
 * Claim Service — Concurrency Safe Pickup Claiming
 * 
 * Race Condition Problem:
 * Driver A aur Driver B ek saath same pickup claim karein
 * → Sirf ek ko milna chahiye
 * 
 * Solution: PostgreSQL SELECT FOR UPDATE
 * → Row lock lagta hai
 * → Doosra driver wait karta hai
 * → Pehle wale ka transaction complete hone ke baad
 *    doosre ko "already claimed" milta hai
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { emitToAll } = require('./socket.service')

/**
 * Atomic Pickup Claim
 * @param {string} foodPostingId
 * @param {string} driverId
 * @param {string} shelterId
 * @param {Object} routeData - TSP route data
 * @returns {Object} Claim result
 */
async function claimPickup(foodPostingId, driverId, shelterId, routeData = null) {
  try {
    // PostgreSQL transaction with row-level lock
    const result = await prisma.$transaction(async (tx) => {
      
      // Step 1: SELECT FOR UPDATE — row lock lagao
      // Koi doosra driver yeh row read/modify nahi kar sakta
      // jab tak yeh transaction complete nahi hota
      const pickup = await tx.$queryRaw`
        SELECT p.*, fp.status as posting_status, fp."quantityKg"
        FROM "Pickup" p
        JOIN "FoodPosting" fp ON fp.id = p."foodPostingId"
        WHERE p."foodPostingId" = ${foodPostingId}
        FOR UPDATE
       `

      if (!pickup || pickup.length === 0) {
        throw new Error('PICKUP_NOT_FOUND')
      }

      const currentPickup = pickup[0]

      // Step 2: Check karo — already claimed to nahi?
      if (currentPickup.status !== 'PENDING') {
        throw new Error('ALREADY_CLAIMED')
      }

      // Step 3: Version check (Optimistic locking)
      // Agar version match nahi karta — stale data hai
      const expectedVersion = currentPickup.version

      // Step 4: Claim karo — atomic update
      // updateMany use karo taaki status + version condition safely apply ho.
      const claimResult = await tx.pickup.updateMany({
        where: {
          foodPostingId: foodPostingId,
          status: 'PENDING',
          version: expectedVersion
        },
        data: {
          driverId: driverId,
          shelterId: shelterId,
          status: 'CLAIMED',
          version: expectedVersion + 1,
          claimedAt: new Date(),
          routeData: routeData
        }
      })

      if (claimResult.count !== 1) {
        throw new Error('ALREADY_CLAIMED')
      }

      const updatedPickup = await tx.pickup.findUnique({
        where: { foodPostingId: foodPostingId }
      })

      // Step 5: Food posting status update karo
      await tx.foodPosting.update({
        where: { id: foodPostingId },
        data: { status: 'MATCHED' }
      })

      return updatedPickup
    })

    // Step 6: Sabko broadcast karo (Socket.io)
    emitToAll('pickup:claimed', {
      foodPostingId,
      driverId,
      shelterId,
      claimedAt: result.claimedAt
    })

    return {
      success: true,
      message: 'Pickup claimed successfully',
      pickup: result
    }

  } catch (error) {
    if (error.message === 'ALREADY_CLAIMED') {
      // Race condition blocked!
      emitToAll('pickup:race_condition_blocked', {
        foodPostingId,
        blockedDriverId: driverId,
        reason: 'Already claimed by another driver'
      })

      return {
        success: false,
        raceConditionBlocked: true,
        message: 'This pickup was just claimed by another driver'
      }
    }

    if (error.message === 'PICKUP_NOT_FOUND') {
      return {
        success: false,
        message: 'Pickup not found'
      }
    }

    // Optimistic lock failure
    if (error.code === 'P2025') {
      return {
        success: false,
        raceConditionBlocked: true,
        message: 'Concurrent update detected — please try again'
      }
    }

    throw error
  }
}

/**
 * Pickup mark as picked up
 */
async function markPickedUp(pickupId, driverId) {
  try {
    const updateResult = await prisma.pickup.updateMany({
      where: {
        id: pickupId,
        driverId: driverId,
        status: 'CLAIMED'
      },
      data: {
        status: 'IN_PROGRESS',
        pickedUpAt: new Date()
      }
    })

    if (updateResult.count !== 1) {
      return { success: false, message: 'Could not update pickup status' }
    }

    const pickup = await prisma.pickup.findUnique({
      where: { id: pickupId }
    })

    emitToAll('pickup:picked_up', { pickupId, driverId })

    return { success: true, pickup }
  } catch (error) {
    return { success: false, message: 'Could not update pickup status' }
  }
}

/**
 * Pickup mark as delivered
 */
async function markDelivered(pickupId, driverId) {
  try {
    const pickup = await prisma.pickup.findUnique({
      where: { id: pickupId },
      include: { foodPosting: true }
    })

    if (!pickup) return { success: false, message: 'Pickup not found' }

    // Transaction — delivery + driver stats ek saath update
    await prisma.$transaction([
      prisma.pickup.update({
        where: { id: pickupId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date()
        }
      }),
      prisma.foodPosting.update({
        where: { id: pickup.foodPostingId },
        data: { status: 'DELIVERED' }
      }),
      prisma.driver.update({
        where: { id: driverId },
        data: {
          totalDeliveries: { increment: 1 },
          totalKgRescued: { increment: pickup.foodPosting.quantityKg }
        }
      })
    ])

    emitToAll('pickup:delivered', {
      pickupId,
      driverId,
      kgRescued: pickup.foodPosting.quantityKg
    })

    return { success: true, message: 'Delivery confirmed' }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

module.exports = { claimPickup, markPickedUp, markDelivered }