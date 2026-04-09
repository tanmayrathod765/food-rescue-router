/**
 * Urgency Score Calculator
 * Food ki urgency calculate karta hai based on:
 * - Time remaining before closing
 * - Food type (hot food expires faster)
 * - Quantity (zyada food = zyada impact)
 */

const FOOD_TYPE_WEIGHTS = {
  HOT_MEAL: 1.0,      // Sabse urgent — jaldi kharab hota hai
  BAKERY: 0.8,        // Moderate urgent
  RAW_PRODUCE: 0.7,   // Moderate
  BEVERAGES: 0.4,     // Less urgent
  SEALED: 0.2         // Least urgent — sealed hai
}

/**
 * Urgency score calculate karta hai (0 to 100)
 * Higher score = zyada urgent = route mein pehle aayega
 */
function calculateUrgencyScore(foodPosting) {
  const { closingTime, foodType, quantityKg } = foodPosting

  // Minutes remaining
  const now = Date.now()
  const closing = new Date(closingTime).getTime()
  const minutesRemaining = Math.max(1, (closing - now) / 60000)

  // Time score — jitna kam time, utna zyada score
  const timeScore = Math.min(100, 1000 / minutesRemaining)

  // Food type weight
  const typeWeight = FOOD_TYPE_WEIGHTS[foodType] || 0.5

  // Quantity factor — zyada food = zyada impact
  const quantityFactor = Math.min(1.5, 1 + quantityKg / 100)

  // Final score
  const urgencyScore = timeScore * typeWeight * quantityFactor

  return Math.min(100, Math.round(urgencyScore * 10) / 10)
}

/**
 * Stops ko urgency ke basis pe sort karta hai
 */
function sortByUrgency(stops) {
  return [...stops].sort((a, b) => {
    const scoreA = calculateUrgencyScore(a)
    const scoreB = calculateUrgencyScore(b)
    return scoreB - scoreA // High urgency pehle
  })
}

module.exports = { calculateUrgencyScore, sortByUrgency, FOOD_TYPE_WEIGHTS }