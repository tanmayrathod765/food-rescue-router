/**
 * Matching Algorithm — Main Entry Point
 */

const { greedyBipartiteMatch } = require('./bipartiteMatch')
const { buildCascadePlan, rankDriversForPosting } = require('./cascadeMatch')
const { calculateMatchScore } = require('./scoreCalculator')

/**
 * Single food posting ke liye best driver find karo
 * @param {Array} availableDrivers
 * @param {Object} foodPosting
 * @returns {Object} Match result
 */
function findBestDriver(availableDrivers, foodPosting) {
  const startTime = Date.now()

  const ranked = rankDriversForPosting(availableDrivers, foodPosting)

  if (ranked.length === 0) {
    return {
      success: false,
      message: 'No eligible driver found',
      foodPostingId: foodPosting.id,
      cascadePlan: buildCascadePlan(availableDrivers, foodPosting)
    }
  }

  const best = ranked[0]

  return {
    success: true,
    foodPostingId: foodPosting.id,
    matchedDriver: best.driver,
    matchScore: best.scoreDetails.totalScore,
    scoreBreakdown: best.scoreDetails.breakdown,
    allCandidates: ranked.map(r => ({
      driverId: r.driver.id,
      driverName: r.driver.name,
      score: r.scoreDetails.totalScore,
      breakdown: r.scoreDetails.breakdown
    })),
    cascadePlan: buildCascadePlan(availableDrivers, foodPosting),
    computeTimeMs: Date.now() - startTime
  }
}

/**
 * Multiple food postings ke liye batch matching
 * @param {Array} availableDrivers
 * @param {Array} foodPostings
 * @returns {Object} Batch match results
 */
function batchMatch(availableDrivers, foodPostings) {
  const startTime = Date.now()

  const result = greedyBipartiteMatch(availableDrivers, foodPostings)

  return {
    success: true,
    totalPostings: foodPostings.length,
    totalDrivers: availableDrivers.length,
    matches: result.matches,
    unmatchedPostings: result.unmatchedPostings,
    unmatchedDrivers: result.unmatchedDrivers,
    matchRate: Math.round(
      (result.matches.length / foodPostings.length) * 100
    ) + '%',
    computeTimeMs: Date.now() - startTime
  }
}

module.exports = { findBestDriver, batchMatch, calculateMatchScore }