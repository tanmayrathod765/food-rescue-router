/**
 * TSP Main Entry Point
 * Sab algorithms ko combine karta hai
 */

const { nearestNeighborRoute } = require('./nearestNeighbor')
const { twoOptImprove } = require('./twoOpt')
const { validateRouteTimeWindows } = require('./timeWindows')
const { estimateTravelTime } = require('../haversine')
const { calculateUrgencyScore } = require('./urgencyWeight')

/**
 * Complete TSP solve karta hai
 * @param {Object} driverPos - {lat, lng}
 * @param {Array} pickupStops - Food donor locations
 * @param {Array} deliveryStops - Shelter locations
 * @returns {Object} Complete optimized route
 */
function solveTSP(driverPos, pickupStops, deliveryStops) {
  const startTime = Date.now()

  // Urgency scores calculate karo
  const scoredPickups = pickupStops.map(stop => ({
    ...stop,
    urgencyScore: calculateUrgencyScore(stop),
    stopType: 'PICKUP'
  }))

  const scoredDeliveries = deliveryStops.map(stop => ({
    ...stop,
    stopType: 'DELIVERY'
  }))

  // Sab stops combine karo
  const allStops = [...scoredPickups, ...scoredDeliveries]

  // Step 1: Nearest Neighbor se initial route
  const { route: initialRoute, totalDistance: initialDistance, skipped } =
    nearestNeighborRoute(driverPos, allStops)

  if (initialRoute.length === 0) {
    return {
      success: false,
      message: 'No reachable stops within time windows',
      route: [],
      skipped
    }
  }

  // Step 2: 2-opt improvement
  const { route: optimizedRoute, totalDistance, improved, iterations } =
    twoOptImprove(initialRoute, driverPos)

  // Step 3: Final time window validation
  const validation = validateRouteTimeWindows(
    optimizedRoute,
    driverPos,
    estimateTravelTime
  )

  const computeTime = Date.now() - startTime

  return {
    success: true,
    route: optimizedRoute,
    totalDistance,
    totalStops: optimizedRoute.length,
    skippedStops: skipped,
    timeWindowsValid: validation.valid,
    timeWindowViolations: validation.violations,
    improved,
    iterations,
    computeTimeMs: computeTime,
    summary: {
      pickups: optimizedRoute.filter(s => s.stopType === 'PICKUP').length,
      deliveries: optimizedRoute.filter(s => s.stopType === 'DELIVERY').length,
      estimatedTotalTime: optimizedRoute.reduce(
        (sum, stop) => sum + (stop.travelTimeMinutes || 0), 0
      ) + ' minutes'
    }
  }
}

module.exports = { solveTSP }