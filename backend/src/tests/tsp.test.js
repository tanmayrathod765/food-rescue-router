                      const { haversineDistance, estimateTravelTime } = require('../algorithms/haversine')
const { nearestNeighborRoute } = require('../algorithms/tsp/nearestNeighbor')
const { twoOptImprove } = require('../algorithms/tsp/twoOpt')
const { calculateUrgencyScore } = require('../algorithms/tsp/urgencyWeight')
const { isWithinTimeWindow } = require('../algorithms/tsp/timeWindows')
const { solveTSP } = require('../algorithms/tsp/index')
const { calculateFoodSafetyScore } = require('../algorithms/foodSafety')
// ─────────────────────────────────────
// Test Data — Indore Locations
// ─────────────────────────────────────
const driver = { lat: 22.7400, lng: 75.8800 }

const pickups = [
  {
    id: 'p1',
    name: 'Pizza Hut Vijay Nagar',
    lat: 22.7533,
    lng: 75.8937,
    foodType: 'HOT_MEAL',
    quantityKg: 20,
    closingTime: new Date(Date.now() + 45 * 60 * 1000), // 45 min baad
    stopType: 'PICKUP'
  },
  {
    id: 'p2',
    name: 'City Bakery Palasia',
    lat: 22.7196,
    lng: 75.8577,
    foodType: 'BAKERY',
    quantityKg: 10,
    closingTime: new Date(Date.now() + 90 * 60 * 1000), // 90 min baad
    stopType: 'PICKUP'
  }
]

const shelters = [
  {
    id: 's1',
    name: 'City Care Shelter',
    lat: 22.7196,
    lng: 75.8577,
    closingTime: new Date(Date.now() + 480 * 60 * 1000), // 8 hours baad // 3 hours baad
    stopType: 'DELIVERY'
  }
]

// ─────────────────────────────────────
// HAVERSINE TESTS
// ─────────────────────────────────────
describe('Haversine Distance', () => {
  test('Same point distance should be 0', () => {
    const dist = haversineDistance(22.74, 75.88, 22.74, 75.88)
    expect(dist).toBe(0)
  })

  test('Indore to Mumbai should be ~550km', () => {
    const dist = haversineDistance(22.7196, 75.8577, 19.0760, 72.8777)
    expect(dist).toBeGreaterThan(500)
    expect(dist).toBeLessThan(600)
  })

  test('Travel time should be positive', () => {
    const time = estimateTravelTime(22.74, 75.88, 22.75, 75.89)
    expect(time).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────
// TIME WINDOW TESTS
// ─────────────────────────────────────
describe('Time Windows', () => {
  test('Should be valid if arrival before closing', () => {
    const arrival = new Date(Date.now() + 10 * 60 * 1000)  // 10 min baad
    const closing = new Date(Date.now() + 30 * 60 * 1000)  // 30 min baad
    expect(isWithinTimeWindow(arrival, closing)).toBe(true)
  })

  test('Should be invalid if arrival after closing', () => {
    const arrival = new Date(Date.now() + 60 * 60 * 1000)  // 60 min baad
    const closing = new Date(Date.now() + 30 * 60 * 1000)  // 30 min baad
    expect(isWithinTimeWindow(arrival, closing)).toBe(false)
  })
})

// ─────────────────────────────────────
// URGENCY TESTS
// ─────────────────────────────────────
describe('Urgency Score', () => {
  test('Hot meal closing soon should have high urgency', () => {
    const urgentFood = {
      foodType: 'HOT_MEAL',
      quantityKg: 10,
      closingTime: new Date(Date.now() + 10 * 60 * 1000) // 10 min
    }
    const score = calculateUrgencyScore(urgentFood)
    expect(score).toBeGreaterThan(50)
  })

  test('Sealed food with lots of time should have low urgency', () => {
    const relaxedFood = {
      foodType: 'SEALED',
      quantityKg: 5,
      closingTime: new Date(Date.now() + 240 * 60 * 1000) // 4 hours
    }
    const score = calculateUrgencyScore(relaxedFood)
    expect(score).toBeLessThan(20)
  })
})

// ─────────────────────────────────────
// NEAREST NEIGHBOR TESTS
// ─────────────────────────────────────
describe('Nearest Neighbor', () => {
  test('Should return route with all reachable stops', () => {
    const allStops = [...pickups, ...shelters]
    const result = nearestNeighborRoute(driver, allStops)
    expect(result.route.length).toBeGreaterThan(0)
    expect(result.totalDistance).toBeGreaterThan(0)
  })

  test('Empty stops should return empty route', () => {
    const result = nearestNeighborRoute(driver, [])
    expect(result.route).toHaveLength(0)
  })
})

// ─────────────────────────────────────
// FULL TSP TESTS
// ─────────────────────────────────────
describe('Full TSP', () => {
  test('Should solve TSP successfully', () => {
    const result = solveTSP(driver, pickups, shelters)
    expect(result.success).toBe(true)
    expect(result.route.length).toBeGreaterThan(0)
    expect(result.totalDistance).toBeGreaterThan(0)
  })

 test('Route should have correct stop types', () => {
  const result = solveTSP(driver, pickups, shelters)
  expect(result.route.length).toBeGreaterThan(0)
  expect(result.summary.pickups).toBeGreaterThan(0)
})

  test('Compute time should be fast (under 1 second)', () => {
    const result = solveTSP(driver, pickups, shelters)
    expect(result.computeTimeMs).toBeLessThan(1000)
  })
describe('Food Safety Score', () => {
  test('Hot meal just cooked should be safe', () => {
    const result = calculateFoodSafetyScore({
      foodType: 'HOT_MEAL',
      timeSinceCooked: 10,
      isRefrigerated: false,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      quantityKg: 20
    })
    expect(result.score).toBeGreaterThan(50)
    expect(result.label).toBeDefined()
  })

  test('Refrigerated food should have higher score', () => {
    const normal = calculateFoodSafetyScore({
      foodType: 'HOT_MEAL',
      timeSinceCooked: 60,
      isRefrigerated: false,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      quantityKg: 10
    })
    const refrigerated = calculateFoodSafetyScore({
      foodType: 'HOT_MEAL',
      timeSinceCooked: 60,
      isRefrigerated: true,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      quantityKg: 10
    })
    expect(refrigerated.score).toBeGreaterThan(normal.score)
  })

  test('Sealed food should always be safe', () => {
    const result = calculateFoodSafetyScore({
      foodType: 'SEALED',
      timeSinceCooked: 0,
      isRefrigerated: false,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      quantityKg: 5
    })
    expect(result.score).toBeGreaterThan(70)
  })
})
})