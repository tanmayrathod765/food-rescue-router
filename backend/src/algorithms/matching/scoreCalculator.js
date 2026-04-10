/**
 * Score Calculator
 * Har driver-food pair ka match score calculate karta hai
 * 
 * SCORE = (0.35 × proximity) + (0.30 × capacity) + 
 *         (0.20 × time) + (0.15 × trust)
 */

const { haversineDistance, estimateTravelTime } = require('../haversine')

const WEIGHTS = {
  PROXIMITY: 0.35,
  CAPACITY:  0.30,
  TIME:      0.20,
  TRUST:     0.15
}

/**
 * Proximity Score — driver kitna paas hai pickup se
 * Closer = higher score (0 to 100)
 */
function proximityScore(driver, foodPosting) {
  const distance = haversineDistance(
    driver.currentLat,
    driver.currentLng,
    foodPosting.donorLat,
    foodPosting.donorLng
  )
  // 0km = 100, 10km = 50, 20km+ = ~0
  return Math.max(0, 100 - distance * 5)
}

/**
 * Capacity Score — driver ki vehicle food uthaa sakti hai?
 * Exact fit = highest score
 */
function capacityScore(driver, foodPosting) {
  const { capacityKg } = driver
  const { quantityKg } = foodPosting

  // Driver ke paas capacity nahi — invalid
  if (capacityKg < quantityKg) return 0

  // Efficiency — kitna capacity use hoga
  const utilization = quantityKg / capacityKg
  
  if (utilization >= 0.5) return 100      // 50%+ full — perfect
  if (utilization >= 0.25) return 75      // 25-50% full — good
  if (utilization >= 0.1) return 50       // 10-25% full — okay
  return 25                               // Under 10% — wasteful
}

/**
 * Time Score — kya driver time window mein pahunch sakta hai?
 */
function timeScore(driver, foodPosting) {
  const travelMins = estimateTravelTime(
    driver.currentLat,
    driver.currentLng,
    foodPosting.donorLat,
    foodPosting.donorLng
  )

  const arrivalTime = new Date(Date.now() + travelMins * 60 * 1000)
  const closingTime = new Date(foodPosting.closingTime)

  // Pahunch nahi sakta — score 0
  if (arrivalTime >= closingTime) return 0

  // Kitna time bachega pahunchne ke baad
  const bufferMins = (closingTime - arrivalTime) / 60000

  if (bufferMins >= 30) return 100   // 30+ min buffer — great
  if (bufferMins >= 15) return 75    // 15-30 min — good
  if (bufferMins >= 5) return 50     // 5-15 min — tight
  return 25                          // Under 5 min — very tight
}

/**
 * Trust Score — driver ka historical performance
 */
function trustScore(driver) {
  return Math.min(100, Math.max(0, driver.trustScore || 80))
}

/**
 * Final Match Score calculate karta hai
 * @param {Object} driver
 * @param {Object} foodPosting
 * @returns {Object} Detailed score breakdown
 */
function calculateMatchScore(driver, foodPosting) {
  const proximity = proximityScore(driver, foodPosting)
  const capacity  = capacityScore(driver, foodPosting)
  const time      = timeScore(driver, foodPosting)
  const trust     = trustScore(driver)

  // Capacity 0 hai to match invalid hai
  if (capacity === 0) {
    return {
      driverId: driver.id,
      driverName: driver.name,
      totalScore: 0,
      invalid: true,
      reason: `Vehicle capacity (${driver.capacityKg}kg) less than food weight (${foodPosting.quantityKg}kg)`,
      breakdown: { proximity: 0, capacity: 0, time: 0, trust: 0 }
    }
  }

  // Time 0 hai to match invalid hai
  if (time === 0) {
    return {
      driverId: driver.id,
      driverName: driver.name,
      totalScore: 0,
      invalid: true,
      reason: 'Cannot reach before closing time',
      breakdown: { proximity, capacity, time: 0, trust }
    }
  }

  const totalScore =
    WEIGHTS.PROXIMITY * proximity +
    WEIGHTS.CAPACITY  * capacity  +
    WEIGHTS.TIME      * time      +
    WEIGHTS.TRUST     * trust

  return {
    driverId: driver.id,
    driverName: driver.name,
    vehicleType: driver.vehicleType,
    totalScore: Math.round(totalScore * 10) / 10,
    invalid: false,
    breakdown: {
      proximity: Math.round(proximity),
      capacity: Math.round(capacity),
      time: Math.round(time),
      trust: Math.round(trust)
    },
    distance: Math.round(
      haversineDistance(
        driver.currentLat, driver.currentLng,
        foodPosting.donorLat, foodPosting.donorLng
      ) * 10
    ) / 10
  }
}

module.exports = {
  calculateMatchScore,
  proximityScore,
  capacityScore,
  timeScore,
  trustScore,
  WEIGHTS
}