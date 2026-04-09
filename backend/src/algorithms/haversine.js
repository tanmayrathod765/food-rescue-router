/**
 * Haversine Formula
 * Do points ke beech ki distance calculate karta hai (km mein)
 * Google Maps API use nahi kar rahe — khud calculate kar rahe hain
 */

const EARTH_RADIUS_KM = 6371

/**
 * @param {number} lat1 - Point 1 latitude
 * @param {number} lng1 - Point 1 longitude
 * @param {number} lat2 - Point 2 latitude
 * @param {number} lng2 - Point 2 longitude
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Travel time estimate karta hai (minutes mein)
 * Average speed: 30 km/h (city traffic)
 */
function estimateTravelTime(lat1, lng1, lat2, lng2) {
  const distance = haversineDistance(lat1, lng1, lat2, lng2)
  const AVG_SPEED_KMPH = 30
  return (distance / AVG_SPEED_KMPH) * 60 // minutes
}

module.exports = { haversineDistance, estimateTravelTime }