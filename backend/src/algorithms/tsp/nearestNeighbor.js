/**
 * Nearest Neighbor Heuristic
 * TSP ka greedy solution — har baar sabse naya closest stop choose karta hai
 * Time Complexity: O(n²)
 */

const { haversineDistance, estimateTravelTime } = require('../haversine')
const { isWithinTimeWindow } = require('./timeWindows')
const { calculateUrgencyScore } = require('./urgencyWeight')

/**
 * Nearest Neighbor se initial route banata hai
 * @param {Object} startPos - Driver position {lat, lng}
 * @param {Array} stops - All stops to visit
 * @returns {Object} { route, totalDistance, skipped }
 */
function nearestNeighborRoute(startPos, stops) {
  if (!stops || stops.length === 0) {
    return { route: [], totalDistance: 0, skipped: [] }
  }

  const unvisited = [...stops]
  const route = []
  const skipped = []
  let currentLat = startPos.lat
  let currentLng = startPos.lng
  let currentTime = Date.now()
  let totalDistance = 0

  while (unvisited.length > 0) {
    let bestStop = null
    let bestScore = -Infinity
    let bestIndex = -1
    let bestDistance = 0

    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i]
      const distance = haversineDistance(
        currentLat, currentLng,
        stop.lat, stop.lng
      )
      const travelMins = estimateTravelTime(
        currentLat, currentLng,
        stop.lat, stop.lng
      )
      const arrivalTime = new Date(currentTime + travelMins * 60 * 1000)

      // Time window check — agar pahunch nahi sakte to skip
      if (stop.closingTime) {
        const canReach = isWithinTimeWindow(arrivalTime, stop.closingTime)
        if (!canReach) continue
      }

      // Score = urgency / distance (urgent + nearby = best)
      const urgency = calculateUrgencyScore(stop)
      const score = (urgency + 1) / (distance + 0.1)

      if (score > bestScore) {
        bestScore = score
        bestStop = stop
        bestIndex = i
        bestDistance = distance
      }
    }

    if (bestStop === null) {
      // Koi bhi reachable nahi — remaining skip karo
      skipped.push(...unvisited)
      break
    }

    // Best stop visit karo
    const travelMins = estimateTravelTime(
      currentLat, currentLng,
      bestStop.lat, bestStop.lng
    )

    route.push({
      ...bestStop,
      distanceFromPrev: Math.round(bestDistance * 10) / 10,
      travelTimeMinutes: Math.round(travelMins),
      estimatedArrival: new Date(currentTime + travelMins * 60 * 1000),
      urgencyScore: calculateUrgencyScore(bestStop)
    })

    // Position update karo
    currentTime += (travelMins + 5) * 60 * 1000 // 5 min stop time
    currentLat = bestStop.lat
    currentLng = bestStop.lng
    totalDistance += bestDistance

    unvisited.splice(bestIndex, 1)
  }

  return {
    route,
    totalDistance: Math.round(totalDistance * 10) / 10,
    skipped
  }
}

module.exports = { nearestNeighborRoute }