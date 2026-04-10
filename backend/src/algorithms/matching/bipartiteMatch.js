/**
 * Bipartite Matching Algorithm
 * 
 * Ek side: Food Postings (jo rescue karne hain)
 * Doosri side: Drivers (jo available hain)
 * 
 * Goal: Best possible driver-food pairing find karo
 * based on weighted scoring
 */

const { calculateMatchScore } = require('./scoreCalculator')

/**
 * Score matrix banata hai — har driver vs har food posting
 * @param {Array} drivers - Available drivers
 * @param {Array} foodPostings - Available food postings
 * @returns {Array} 2D score matrix
 */
function buildScoreMatrix(drivers, foodPostings) {
  const matrix = []

  for (const driver of drivers) {
    const row = []
    for (const posting of foodPostings) {
      const score = calculateMatchScore(driver, posting)
      row.push(score)
    }
    matrix.push(row)
  }

  return matrix
}

/**
 * Greedy Bipartite Matching
 * Sabse high score wala pair pehle match karta hai
 * 
 * @param {Array} drivers - Available drivers
 * @param {Array} foodPostings - Food postings to match
 * @returns {Object} { matches, unmatched }
 */
function greedyBipartiteMatch(drivers, foodPostings) {
  if (!drivers.length || !foodPostings.length) {
    return {
      matches: [],
      unmatchedPostings: foodPostings,
      unmatchedDrivers: drivers
    }
  }

  // Score matrix banao
  const matrix = buildScoreMatrix(drivers, foodPostings)

  // Sabhi valid pairs ko flat list mein daalo
  const allPairs = []
  for (let d = 0; d < drivers.length; d++) {
    for (let f = 0; f < foodPostings.length; f++) {
      const score = matrix[d][f]
      if (!score.invalid && score.totalScore > 0) {
        allPairs.push({
          driverIndex: d,
          foodIndex: f,
          score: score.totalScore,
          details: score
        })
      }
    }
  }

  // Score ke basis pe sort karo (highest first)
  allPairs.sort((a, b) => b.score - a.score)

  // Greedy matching — highest score pehle
  const matchedDrivers = new Set()
  const matchedFoods = new Set()
  const matches = []

  for (const pair of allPairs) {
    // Dono already matched nahi hone chahiye
    if (
      matchedDrivers.has(pair.driverIndex) ||
      matchedFoods.has(pair.foodIndex)
    ) continue

    matches.push({
      driver: drivers[pair.driverIndex],
      foodPosting: foodPostings[pair.foodIndex],
      score: pair.score,
      scoreDetails: pair.details
    })

    matchedDrivers.add(pair.driverIndex)
    matchedFoods.add(pair.foodIndex)
  }

  // Unmatched find karo
  const unmatchedPostings = foodPostings.filter(
    (_, i) => !matchedFoods.has(i)
  )
  const unmatchedDrivers = drivers.filter(
    (_, i) => !matchedDrivers.has(i)
  )

  return {
    matches,
    unmatchedPostings,
    unmatchedDrivers,
    totalMatches: matches.length,
    scoreMatrix: matrix
  }
}

module.exports = { greedyBipartiteMatch, buildScoreMatrix }