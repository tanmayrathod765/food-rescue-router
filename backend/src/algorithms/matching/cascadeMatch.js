/**
 * Cascade Matching
 * 
 * Agar best driver accept nahi karta →
 * automatically next best driver ko notify karo
 * 
 * Level 1: Best matched driver (2 min wait)
 * Level 2: Next 2 best drivers (2 min wait)
 * Level 3: All nearby available drivers (2 min wait)
 * Level 4: Off-duty drivers alert
 * Level 5: Admin emergency alert
 */

const { calculateMatchScore } = require('./scoreCalculator')

const CASCADE_LEVELS = {
  LEVEL_1: { waitMinutes: 2,  driversToNotify: 1,  label: 'Best Match' },
  LEVEL_2: { waitMinutes: 2,  driversToNotify: 2,  label: 'Top 3' },
  LEVEL_3: { waitMinutes: 2,  driversToNotify: 10, label: 'All Nearby' },
  LEVEL_4: { waitMinutes: 2,  driversToNotify: 50, label: 'Off-duty Alert' },
  LEVEL_5: { waitMinutes: 0,  driversToNotify: 0,  label: 'Admin Emergency' }
}

/**
 * Drivers ko score ke basis pe rank karta hai
 * @param {Array} drivers
 * @param {Object} foodPosting
 * @returns {Array} Ranked drivers with scores
 */
function rankDriversForPosting(drivers, foodPosting) {
  const scored = drivers
    .map(driver => ({
      driver,
      scoreDetails: calculateMatchScore(driver, foodPosting)
    }))
    .filter(item => !item.scoreDetails.invalid)
    .sort((a, b) => b.scoreDetails.totalScore - a.scoreDetails.totalScore)

  return scored
}

/**
 * Cascade plan banata hai ek food posting ke liye
 * @param {Array} availableDrivers
 * @param {Object} foodPosting
 * @returns {Object} Cascade plan with levels
 */
function buildCascadePlan(availableDrivers, foodPosting) {
  const rankedDrivers = rankDriversForPosting(availableDrivers, foodPosting)

  if (rankedDrivers.length === 0) {
    return {
      success: false,
      message: 'No eligible drivers found',
      cascadePlan: [],
      requiresAdminAlert: true
    }
  }

  const cascadePlan = [
    {
      level: 1,
      label: CASCADE_LEVELS.LEVEL_1.label,
      waitMinutes: CASCADE_LEVELS.LEVEL_1.waitMinutes,
      drivers: rankedDrivers.slice(0, 1).map(r => ({
        ...r.driver,
        matchScore: r.scoreDetails.totalScore,
        scoreBreakdown: r.scoreDetails.breakdown
      }))
    },
    {
      level: 2,
      label: CASCADE_LEVELS.LEVEL_2.label,
      waitMinutes: CASCADE_LEVELS.LEVEL_2.waitMinutes,
      drivers: rankedDrivers.slice(1, 3).map(r => ({
        ...r.driver,
        matchScore: r.scoreDetails.totalScore,
        scoreBreakdown: r.scoreDetails.breakdown
      }))
    },
    {
      level: 3,
      label: CASCADE_LEVELS.LEVEL_3.label,
      waitMinutes: CASCADE_LEVELS.LEVEL_3.waitMinutes,
      drivers: rankedDrivers.slice(3).map(r => ({
        ...r.driver,
        matchScore: r.scoreDetails.totalScore,
        scoreBreakdown: r.scoreDetails.breakdown
      }))
    },
    {
      level: 4,
      label: CASCADE_LEVELS.LEVEL_4.label,
      waitMinutes: CASCADE_LEVELS.LEVEL_4.waitMinutes,
      drivers: [] // Off-duty drivers — DB se fetch hote hain runtime pe
    },
    {
      level: 5,
      label: CASCADE_LEVELS.LEVEL_5.label,
      waitMinutes: 0,
      drivers: [],
      action: 'ADMIN_EMERGENCY_ALERT'
    }
  ]

  return {
    success: true,
    foodPostingId: foodPosting.id,
    totalEligibleDrivers: rankedDrivers.length,
    bestDriver: rankedDrivers[0]?.driver,
    bestScore: rankedDrivers[0]?.scoreDetails.totalScore,
    cascadePlan
  }
}

/**
 * Current cascade level determine karta hai
 * based on kitni baar already try ho chuka hai
 */
function getCurrentCascadeLevel(attemptCount) {
  if (attemptCount === 0) return 1
  if (attemptCount === 1) return 2
  if (attemptCount === 2) return 3
  if (attemptCount === 3) return 4
  return 5
}

module.exports = {
  rankDriversForPosting,
  buildCascadePlan,
  getCurrentCascadeLevel,
  CASCADE_LEVELS
}