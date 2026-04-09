/**
 * Time Window Validator
 * Har stop ke liye check karta hai ki hum time pe pahunch sakte hain ya nahi
 */

/**
 * Check karta hai ki driver ek stop pe time window ke andar pahunch sakta hai
 * @param {Date} arrivalTime - Estimated arrival time
 * @param {Date} closingTime - Stop ki closing time
 * @param {number} bufferMinutes - Safety buffer (default 5 min)
 * @returns {boolean}
 */
function isWithinTimeWindow(arrivalTime, closingTime, bufferMinutes = 5) {
  const arrival = new Date(arrivalTime).getTime()
  const closing = new Date(closingTime).getTime()
  const buffer = bufferMinutes * 60 * 1000
  return arrival <= closing - buffer
}

/**
 * Ek poori route ke liye time windows validate karta hai
 * @param {Array} stops - Array of stops with lat, lng, closingTime
 * @param {Object} startPos - Driver ki current position {lat, lng}
 * @param {Function} travelTimeFn - Travel time calculate karne ka function
 * @returns {Object} { valid: boolean, violations: Array }
 */
function validateRouteTimeWindows(stops, startPos, travelTimeFn) {
  const violations = []
  let currentTime = Date.now()
  let currentLat = startPos.lat
  let currentLng = startPos.lng

  for (const stop of stops) {
    const travelMins = travelTimeFn(
      currentLat,
      currentLng,
      stop.lat,
      stop.lng
    )

    const arrivalTime = new Date(currentTime + travelMins * 60 * 1000)

    if (stop.closingTime) {
      const valid = isWithinTimeWindow(arrivalTime, stop.closingTime)
      if (!valid) {
        violations.push({
          stopId: stop.id,
          stopName: stop.name,
          estimatedArrival: arrivalTime,
          closingTime: stop.closingTime,
          lateBy: Math.round(
            (arrivalTime - new Date(stop.closingTime)) / 60000
          ) + ' minutes'
        })
      }
    }

    // Next stop ke liye current position update karo
    currentTime = arrivalTime.getTime() + 5 * 60 * 1000 // 5 min stop time
    currentLat = stop.lat
    currentLng = stop.lng
  }

  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * Minutes remaining before closing
 */
function minutesUntilClosing(closingTime) {
  const now = Date.now()
  const closing = new Date(closingTime).getTime()
  return Math.max(0, Math.round((closing - now) / 60000))
}

module.exports = {
  isWithinTimeWindow,
  validateRouteTimeWindows,
  minutesUntilClosing
}