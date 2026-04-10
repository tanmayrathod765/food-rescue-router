/**
 * Matching Service
 * Algorithms ko database ke saath connect karta hai
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { findBestDriver } = require('../algorithms/matching/index')
const { solveTSP } = require('../algorithms/tsp/index')
const { claimPickup } = require('./claim.service')
const { emitToAll } = require('./socket.service')

/**
 * Naye food posting ke liye matching run karo
 * @param {string} foodPostingId
 */
async function runMatchingForPosting(foodPostingId) {
  try {
    // Food posting fetch karo
    const foodPosting = await prisma.foodPosting.findUnique({
      where: { id: foodPostingId },
      include: { donor: true }
    })

    if (!foodPosting) throw new Error('Food posting not found')

    // Available drivers fetch karo
    const availableDrivers = await prisma.driver.findMany({
      where: { isAvailable: true }
    })

    if (availableDrivers.length === 0) {
      emitToAll('matching:no_drivers', { foodPostingId })
      return { success: false, message: 'No drivers available' }
    }

    // Food posting ko matching format mein convert karo
    const postingForMatching = {
      id: foodPosting.id,
      donorLat: foodPosting.donor.lat,
      donorLng: foodPosting.donor.lng,
      quantityKg: foodPosting.quantityKg,
      foodType: foodPosting.foodType,
      closingTime: foodPosting.closingTime
    }

    // Best driver find karo
    const matchResult = findBestDriver(availableDrivers, postingForMatching)

    if (!matchResult.success) {
      emitToAll('matching:no_match', { foodPostingId })
      return matchResult
    }

    // Available shelters fetch karo
    const shelters = await prisma.shelter.findMany({
      where: { isAccepting: true }
    })

    // TSP route calculate karo
    const driverPos = {
      lat: matchResult.matchedDriver.currentLat,
      lng: matchResult.matchedDriver.currentLng
    }

    const pickupStops = [{
      id: foodPosting.id,
      name: foodPosting.donor.name,
      lat: foodPosting.donor.lat,
      lng: foodPosting.donor.lng,
      closingTime: foodPosting.closingTime,
      foodType: foodPosting.foodType,
      quantityKg: foodPosting.quantityKg
    }]

    const deliveryStops = shelters.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      closingTime: new Date(`${new Date().toDateString()} ${s.acceptingTill}`)
    }))

    const routeResult = solveTSP(driverPos, pickupStops, deliveryStops)

    // Broadcast matching result
    emitToAll('matching:driver_found', {
      foodPostingId,
      driverId: matchResult.matchedDriver.id,
      driverName: matchResult.matchedDriver.name,
      matchScore: matchResult.matchScore,
      scoreBreakdown: matchResult.scoreBreakdown,
      allCandidates: matchResult.allCandidates,
      route: routeResult.route
    })

    return {
      success: true,
      matchedDriver: matchResult.matchedDriver,
      matchScore: matchResult.matchScore,
      route: routeResult
    }

  } catch (error) {
    console.error('Matching error:', error)
    return { success: false, message: error.message }
  }
}

module.exports = { runMatchingForPosting }