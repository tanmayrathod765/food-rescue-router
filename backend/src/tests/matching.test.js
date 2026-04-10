const { calculateMatchScore } = require('../algorithms/matching/scoreCalculator')
const { greedyBipartiteMatch } = require('../algorithms/matching/bipartiteMatch')
const { buildCascadePlan, rankDriversForPosting } = require('../algorithms/matching/cascadeMatch')
const { findBestDriver, batchMatch } = require('../algorithms/matching/index')

// ─────────────────────────────────────
// Test Data
// ─────────────────────────────────────
const drivers = [
  {
    id: 'd1',
    name: 'Amit Sharma',
    vehicleType: 'CAR',
    capacityKg: 50,
    currentLat: 22.7400,
    currentLng: 75.8800,
    isAvailable: true,
    trustScore: 92
  },
  {
    id: 'd2',
    name: 'Priya Verma',
    vehicleType: 'BIKE',
    capacityKg: 10,
    currentLat: 22.7200,
    currentLng: 75.8600,
    isAvailable: true,
    trustScore: 87
  },
  {
    id: 'd3',
    name: 'Rahul Singh',
    vehicleType: 'VAN',
    capacityKg: 100,
    currentLat: 22.7600,
    currentLng: 75.9000,
    isAvailable: true,
    trustScore: 78
  }
]

const foodPostings = [
  {
    id: 'f1',
    name: 'Pizza Hut',
    donorLat: 22.7533,
    donorLng: 75.8937,
    quantityKg: 20,
    foodType: 'HOT_MEAL',
    closingTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  },
  {
    id: 'f2',
    name: 'City Bakery',
    donorLat: 22.7196,
    donorLng: 75.8577,
    quantityKg: 5,
    foodType: 'BAKERY',
    closingTime: new Date(Date.now() + 90 * 60 * 1000) // 1.5 hours
  }
]

// ─────────────────────────────────────
// SCORE CALCULATOR TESTS
// ─────────────────────────────────────
describe('Score Calculator', () => {
  test('Bike cannot carry 20kg food — score should be 0', () => {
    const score = calculateMatchScore(drivers[1], foodPostings[0])
    expect(score.totalScore).toBe(0)
    expect(score.invalid).toBe(true)
  })

  test('Car can carry 20kg food — score should be positive', () => {
    const score = calculateMatchScore(drivers[0], foodPostings[0])
    expect(score.totalScore).toBeGreaterThan(0)
    expect(score.invalid).toBe(false)
  })

  test('Score breakdown should have all 4 components', () => {
    const score = calculateMatchScore(drivers[0], foodPostings[0])
    expect(score.breakdown).toHaveProperty('proximity')
    expect(score.breakdown).toHaveProperty('capacity')
    expect(score.breakdown).toHaveProperty('time')
    expect(score.breakdown).toHaveProperty('trust')
  })

  test('Higher trust score driver should score better', () => {
    const score1 = calculateMatchScore(drivers[0], foodPostings[1]) // trust 92
    const score2 = calculateMatchScore(drivers[2], foodPostings[1]) // trust 78
    expect(score1.totalScore).toBeGreaterThan(score2.totalScore)
  })
})

// ─────────────────────────────────────
// BIPARTITE MATCHING TESTS
// ─────────────────────────────────────
describe('Bipartite Matching', () => {
  test('Should match drivers to food postings', () => {
    const result = greedyBipartiteMatch(drivers, foodPostings)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  test('Same driver should not be matched twice', () => {
    const result = greedyBipartiteMatch(drivers, foodPostings)
    const driverIds = result.matches.map(m => m.driver.id)
    const uniqueIds = new Set(driverIds)
    expect(driverIds.length).toBe(uniqueIds.size)
  })

  test('Same food posting should not be matched twice', () => {
    const result = greedyBipartiteMatch(drivers, foodPostings)
    const foodIds = result.matches.map(m => m.foodPosting.id)
    const uniqueIds = new Set(foodIds)
    expect(foodIds.length).toBe(uniqueIds.size)
  })

  test('Empty drivers should return no matches', () => {
    const result = greedyBipartiteMatch([], foodPostings)
    expect(result.matches).toHaveLength(0)
  })
})

// ─────────────────────────────────────
// CASCADE MATCHING TESTS
// ─────────────────────────────────────
describe('Cascade Matching', () => {
  test('Should build cascade plan with 5 levels', () => {
    const plan = buildCascadePlan(drivers, foodPostings[0])
    expect(plan.cascadePlan).toHaveLength(5)
  })

  test('Best driver should be in level 1', () => {
    const plan = buildCascadePlan(drivers, foodPostings[0])
    expect(plan.cascadePlan[0].drivers).toHaveLength(1)
  })

  test('No eligible drivers should trigger admin alert', () => {
    const plan = buildCascadePlan([], foodPostings[0])
    expect(plan.requiresAdminAlert).toBe(true)
  })
})

// ─────────────────────────────────────
// FIND BEST DRIVER TESTS
// ─────────────────────────────────────
describe('Find Best Driver', () => {
  test('Should find best driver for food posting', () => {
    const result = findBestDriver(drivers, foodPostings[0])
    expect(result.success).toBe(true)
    expect(result.matchedDriver).toBeDefined()
  })

  test('Matched driver should have enough capacity', () => {
    const result = findBestDriver(drivers, foodPostings[0])
    expect(result.matchedDriver.capacityKg).toBeGreaterThanOrEqual(
      foodPostings[0].quantityKg
    )
  })

  test('Should return all candidates ranked by score', () => {
    const result = findBestDriver(drivers, foodPostings[0])
    const scores = result.allCandidates.map(c => c.score)
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
  })
})

// ─────────────────────────────────────
// BATCH MATCH TESTS
// ─────────────────────────────────────
describe('Batch Match', () => {
  test('Should match multiple postings at once', () => {
    const result = batchMatch(drivers, foodPostings)
    expect(result.success).toBe(true)
    expect(result.matches.length).toBeGreaterThan(0)
  })

  test('Match rate should be a percentage string', () => {
    const result = batchMatch(drivers, foodPostings)
    expect(result.matchRate).toContain('%')
  })

  test('Compute time should be under 1 second', () => {
    const result = batchMatch(drivers, foodPostings)
    expect(result.computeTimeMs).toBeLessThan(1000)
  })
})