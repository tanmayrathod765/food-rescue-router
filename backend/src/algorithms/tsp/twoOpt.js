/**
 * 2-opt Algorithm
 * Nearest Neighbor se mili route ko improve karta hai
 * Do edges swap karke better route dhundhta hai
 * Time Complexity: O(n²) per iteration
 */

const { haversineDistance } = require('../haversine')
const { validateRouteTimeWindows } = require('./timeWindows')
const { estimateTravelTime } = require('../haversine')

/**
 * Route ki total distance calculate karta hai
 */
function calculateTotalDistance(route) {
  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineDistance(
      route[i].lat, route[i].lng,
      route[i + 1].lat, route[i + 1].lng
    )
  }
  return total
}

/**
 * Route ke do segments reverse karta hai (2-opt swap)
 */
function twoOptSwap(route, i, k) {
  const newRoute = [
    ...route.slice(0, i),
    ...route.slice(i, k + 1).reverse(),
    ...route.slice(k + 1)
  ]
  return newRoute
}

/**
 * 2-opt improvement apply karta hai
 * @param {Array} route - Initial route from nearest neighbor
 * @param {Object} startPos - Driver position
 * @param {number} maxIterations - Max improvement attempts
 * @returns {Object} { route, totalDistance, improved }
 */
function twoOptImprove(route, startPos, maxIterations = 100) {
  if (route.length <= 2) {
    return {
      route,
      totalDistance: calculateTotalDistance(route),
      improved: false
    }
  }

  let bestRoute = [...route]
  let bestDistance = calculateTotalDistance(route)
  let improved = false
  let iterations = 0

  let foundImprovement = true

  while (foundImprovement && iterations < maxIterations) {
    foundImprovement = false
    iterations++

    for (let i = 0; i < bestRoute.length - 1; i++) {
      for (let k = i + 1; k < bestRoute.length; k++) {
        const newRoute = twoOptSwap(bestRoute, i, k)
        const newDistance = calculateTotalDistance(newRoute)

        if (newDistance < bestDistance) {
          // Time windows check karo — valid hai?
          const validation = validateRouteTimeWindows(
            newRoute,
            startPos,
            estimateTravelTime
          )

          if (validation.valid) {
            bestRoute = newRoute
            bestDistance = newDistance
            foundImprovement = true
            improved = true
          }
        }
      }
    }
  }

  return {
    route: bestRoute,
    totalDistance: Math.round(bestDistance * 10) / 10,
    improved,
    iterations
  }
}

module.exports = { twoOptImprove, calculateTotalDistance }