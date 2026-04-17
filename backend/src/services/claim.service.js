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

const prisma = require('../prisma/client')
const { calculateMatchScore } = require('../algorithms/matching/scoreCalculator')
const { emitToAll } = require('./socket.service')
const { generateImpactReport } = require('./impact.service')
const {
  checkDriverAchievements,
  checkDonorAchievements
} = require('./gamification.service')
const { startNoShowTimer, cancelNoShowTimer } = require('./noshow.service')
const { notifyDeliveryComplete } = require('./notification.service')

function getDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = value => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const deltaLat = toRad(lat2 - lat1)
  const deltaLng = toRad(lng2 - lng1)
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function selectBestShelter(shelters, foodPosting, donorLat, donorLng) {
  const eligible = shelters
    .map(shelter => {
      const remainingCapacity = Number(shelter.maxCapacityKg) - Number(shelter.currentCommittedKg || 0)
      const isVegFood = Boolean(foodPosting.isVeg)
      const acceptsFood = (isVegFood && shelter.needsVeg) || (!isVegFood && shelter.needsNonVeg)
      const accepting = Boolean(shelter.isAccepting)
      const validCapacity = remainingCapacity >= Number(foodPosting.quantityKg)

      if (!accepting || !acceptsFood || !validCapacity) {
        return null
      }

      const distanceKm = getDistanceKm(donorLat, donorLng, shelter.lat, shelter.lng)
      const fillRatio = Number(shelter.currentCommittedKg || 0) / Number(shelter.maxCapacityKg || 1)

      return {
        shelter,
        remainingCapacity,
        distanceKm,
        fillRatio,
        score: (remainingCapacity * 10) - (distanceKm * 3) + ((1 - fillRatio) * 15)
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  return eligible[0] || null
}
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
    let assignedShelterId = shelterId

    // PostgreSQL transaction with row-level lock
    const result = await prisma.$transaction(async (tx) => {
      
      // Step 1: SELECT FOR UPDATE — row lock lagao
      // Koi doosra driver yeh row read/modify nahi kar sakta
      // jab tak yeh transaction complete nahi hota
      const pickup = await tx.$queryRaw`
        SELECT
          p.*,
          fp.status as posting_status,
          fp."quantityKg",
          fp."closingTime",
          fp."foodType",
          fp."isVeg",
          d.lat as donor_lat,
          d.lng as donor_lng
        FROM "Pickup" p
        JOIN "FoodPosting" fp ON fp.id = p."foodPostingId"
        JOIN "Donor" d ON d.id = fp."donorId"
        WHERE p."foodPostingId" = ${foodPostingId}
        FOR UPDATE
       `

      if (!pickup || pickup.length === 0) {
        throw new Error('PICKUP_NOT_FOUND')
      }

      const currentPickup = pickup[0]

      if (!assignedShelterId) {
        const shelters = await tx.shelter.findMany({
          where: { isAccepting: true }
        })

        const bestShelter = selectBestShelter(
          shelters,
          {
            quantityKg: Number(currentPickup.quantityKg),
            isVeg: currentPickup.isVeg
          },
          Number(currentPickup.donor_lat),
          Number(currentPickup.donor_lng)
        )

        if (!bestShelter) {
          throw new Error('NO_ELIGIBLE_SHELTER')
        }

        assignedShelterId = bestShelter.shelter.id
      }

      const driver = await tx.driver.findUnique({
        where: { id: driverId }
      })

      if (!driver || !driver.isAvailable) {
        throw new Error('DRIVER_NOT_AVAILABLE')
      }

      if (!Number.isFinite(driver.currentLat) || !Number.isFinite(driver.currentLng)) {
        throw new Error('DRIVER_LOCATION_MISSING')
      }

      const scoreCheck = calculateMatchScore(driver, {
        id: foodPostingId,
        donorLat: Number(currentPickup.donor_lat),
        donorLng: Number(currentPickup.donor_lng),
        quantityKg: Number(currentPickup.quantityKg),
        foodType: currentPickup.foodType,
        closingTime: currentPickup.closingTime
      })

      if (scoreCheck.invalid) {
        throw new Error(`DRIVER_CONSTRAINT_FAILED:${scoreCheck.reason}`)
      }

      if (shelterId) {
        const shelter = await tx.shelter.findUnique({
          where: { id: shelterId }
        })

        if (!shelter || !shelter.isAccepting) {
          throw new Error('SHELTER_NOT_ACCEPTING')
        }

        const remainingCapacity = Number(shelter.maxCapacityKg) - Number(shelter.currentCommittedKg)
        if (remainingCapacity < Number(currentPickup.quantityKg)) {
          throw new Error('SHELTER_CAPACITY_EXCEEDED')
        }

        const isVegFood = Boolean(currentPickup.isVeg)
        if ((isVegFood && !shelter.needsVeg) || (!isVegFood && !shelter.needsNonVeg)) {
          throw new Error('SHELTER_FOOD_TYPE_MISMATCH')
        }
      }

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
          shelterId: assignedShelterId,
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
        shelterId: assignedShelterId,
      claimedAt: result.claimedAt
    })

    const assignedPickup = await prisma.pickup.findUnique({
      where: { id: result.id },
      include: {
        foodPosting: {
          include: {
            donor: true
          }
        },
        driver: true,
        shelter: true
      }
    })

    if (assignedPickup?.shelterId) {
      emitToAll('shelter:assigned', {
        pickupId: assignedPickup.id,
        shelterId: assignedPickup.shelterId,
        shelterName: assignedPickup.shelter?.name,
        driverId: assignedPickup.driverId,
        driverName: assignedPickup.driver?.name,
        driverPhone: assignedPickup.driver?.phone,
        donorName: assignedPickup.foodPosting?.donor?.name,
        quantityKg: assignedPickup.foodPosting?.quantityKg,
        foodType: assignedPickup.foodPosting?.foodType,
        message: 'New food pickup assigned to shelter'
      })
    }

    // No-show timer start karo
    startNoShowTimer(result.id, foodPostingId, driverId)

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

    if (error.message === 'DRIVER_NOT_AVAILABLE') {
      return {
        success: false,
        message: 'Driver is not available for assignment'
      }
    }

    if (error.message === 'DRIVER_LOCATION_MISSING') {
      return {
        success: false,
        message: 'Driver live location not found. Please update location first.'
      }
    }

    if (error.message.startsWith('DRIVER_CONSTRAINT_FAILED:')) {
      return {
        success: false,
        message: error.message.replace('DRIVER_CONSTRAINT_FAILED:', '')
      }
    }

    if (error.message === 'SHELTER_NOT_ACCEPTING') {
      return {
        success: false,
        message: 'Selected shelter is not accepting deliveries right now'
      }
    }

    if (error.message === 'SHELTER_CAPACITY_EXCEEDED') {
      return {
        success: false,
        message: 'Selected shelter does not have enough remaining capacity'
      }
    }

    if (error.message === 'SHELTER_FOOD_TYPE_MISMATCH') {
      return {
        success: false,
        message: 'Selected shelter cannot accept this food type'
      }
    }

    if (error.message === 'NO_ELIGIBLE_SHELTER') {
      return {
        success: false,
        message: 'No eligible shelter available for this pickup'
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

    // No-show timer cancel karo
    cancelNoShowTimer(pickupId)
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
    const transactionOps = [
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
    ]

    if (pickup.shelterId) {
      transactionOps.push(
        prisma.shelter.update({
          where: { id: pickup.shelterId },
          data: {
            currentCommittedKg: {
              increment: pickup.foodPosting.quantityKg
            }
          }
        })
      )
    }

    await prisma.$transaction(transactionOps)

    emitToAll('pickup:delivered', {
      pickupId,
      driverId,
      kgRescued: pickup.foodPosting.quantityKg
    })

    // Impact report generate karo
generateImpactReport(pickupId).catch(console.error)
notifyDeliveryComplete(
  pickup.foodPosting.donorId,
  driverId,
  pickup.foodPosting.quantityKg
).catch(console.error)
// Achievements check karo
checkDriverAchievements(driverId).catch(console.error)
checkDonorAchievements(
  pickup.foodPosting.donorId,
  pickup.foodPosting.quantityKg
).catch(console.error)

    return { success: true, message: 'Delivery confirmed' }
  } catch (error) {
    return { success: false, message: error.message }
  }
}

module.exports = { claimPickup, markPickedUp, markDelivered }