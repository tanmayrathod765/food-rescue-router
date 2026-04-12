/**
 * Food Safety Score Calculator
 * 
 * Factors:
 * 1. Food type (hot food expires faster)
 * 2. Time since cooked (minutes)
 * 3. Is refrigerated?
 * 4. Time until closing
 * 
 * Score: 0-100
 * 90-100 → Safe ✅ (green)
 * 70-89  → Consume soon ⚠️ (yellow)
 * Below 70 → Risk ❌ (red)
 */

const FOOD_TYPE_SHELF_LIFE = {
  HOT_MEAL:    120,  // 2 hours
  BAKERY:      360,  // 6 hours
  RAW_PRODUCE: 480,  // 8 hours
  BEVERAGES:   720,  // 12 hours
  SEALED:      4320  // 3 days
}

const REFRIGERATION_MULTIPLIER = 3 // 3x shelf life if refrigerated

/**
 * Food safety score calculate karta hai
 * @param {Object} foodPosting
 * @returns {Object} { score, label, color, recommendation }
 */
function calculateFoodSafetyScore(foodPosting) {
  const {
    foodType,
    timeSinceCooked = 0,
    isRefrigerated = false,
    closingTime,
    quantityKg
  } = foodPosting

  // Base shelf life (minutes)
  let shelfLife = FOOD_TYPE_SHELF_LIFE[foodType] || 240

  // Refrigeration boost
  if (isRefrigerated) {
    shelfLife *= REFRIGERATION_MULTIPLIER
  }

  // Time remaining on shelf life
  const timeUsed = timeSinceCooked
  const timeRemaining = Math.max(0, shelfLife - timeUsed)
  const shelfLifeScore = (timeRemaining / shelfLife) * 100

  // Time until closing (urgency factor)
  const minutesUntilClosing = Math.max(
    0,
    (new Date(closingTime) - Date.now()) / 60000
  )
  const closingScore = Math.min(100, minutesUntilClosing / 60 * 100)

  // Quantity factor (larger = more important to rescue)
  const quantityFactor = Math.min(1.2, 1 + quantityKg / 100)

  // Final score (weighted)
  const score = Math.round(
    (shelfLifeScore * 0.6 + closingScore * 0.4) * quantityFactor
  )

  const finalScore = Math.min(100, Math.max(0, score))

  // Label + recommendation
  let label, color, recommendation, emoji

  if (finalScore >= 90) {
    label = 'Safe'
    color = 'green'
    emoji = '✅'
    recommendation = 'Food is fresh and safe to consume'
  } else if (finalScore >= 70) {
    label = 'Consume Soon'
    color = 'yellow'
    emoji = '⚠️'
    recommendation = 'Deliver within 1 hour for best quality'
  } else if (finalScore >= 50) {
    label = 'Urgent'
    color = 'orange'
    emoji = '🔶'
    recommendation = 'Deliver immediately — quality degrading'
  } else {
    label = 'Risk'
    color = 'red'
    emoji = '❌'
    recommendation = 'Assess food quality before accepting'
  }

  return {
    score: finalScore,
    label,
    color,
    emoji,
    recommendation,
    shelfLifeRemaining: Math.round(timeRemaining),
    isRefrigerated
  }
}

/**
 * Safety score TSP urgency mein feed karta hai
 * Higher safety risk = higher urgency
 */
function safetyToUrgencyBoost(safetyScore) {
  if (safetyScore < 50) return 2.0   // Double urgency
  if (safetyScore < 70) return 1.5   // 50% more urgent
  if (safetyScore < 90) return 1.2   // 20% more urgent
  return 1.0                          // Normal urgency
}

module.exports = {
  calculateFoodSafetyScore,
  safetyToUrgencyBoost,
  FOOD_TYPE_SHELF_LIFE
}