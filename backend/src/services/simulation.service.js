/**
 * Simulation Service
 * Judges ke liye live demo scenarios
 * Fake drivers, donors, shelters use karte hain
 */

const prisma = require('../prisma/client')
const { emitToAll } = require('./socket.service')
const { findBestDriver } = require('../algorithms/matching/index')
const { solveTSP } = require('../algorithms/tsp/index')
const { claimPickup } = require('./claim.service')

// Simulation state
let simulationActive = false
let simulationInterval = null

/**
 * Delay helper
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Simulation emit — with label for transparency panel
 */
function simEmit(event, data, label) {
  emitToAll(event, { ...data, simulation: true, label })
  emitToAll('simulation:log', {
    timestamp: new Date().toLocaleTimeString(),
    event,
    label,
    data
  })
}

// ─────────────────────────────────────
// SCENARIO A — Normal Full Flow
// ─────────────────────────────────────
async function scenarioA(speed = 1) {
  const wait = (ms) => delay(ms / speed)

  simEmit('simulation:started', { scenario: 'A' },
    '🎬 Scenario A: Normal Flow Started')

  // Step 1: Food posted
  await wait(1000)
  const donors = await prisma.donor.findMany({ take: 1 })
  const donor = donors[0]

  const posting = await prisma.foodPosting.create({
    data: {
      donorId: donor.id,
      foodType: 'HOT_MEAL',
      isVeg: true,
      quantityKg: 20,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      urgencyScore: 65,
      status: 'AVAILABLE'
    }
  })

  await prisma.pickup.create({
    data: { foodPostingId: posting.id }
  })

  simEmit('simulation:food_posted', {
    donorName: donor.name,
    quantity: 20,
    foodType: 'HOT_MEAL'
  }, `📦 ${donor.name} posted 20kg Hot Meal`)

  // Step 2: Matching engine runs
  await wait(2000)
  const drivers = await prisma.driver.findMany({
    where: { isAvailable: true }
  })

  const postingForMatch = {
    id: posting.id,
    donorLat: donor.lat,
    donorLng: donor.lng,
    quantityKg: 20,
    foodType: 'HOT_MEAL',
    closingTime: posting.closingTime
  }

  const matchResult = findBestDriver(drivers, postingForMatch)

  simEmit('matching:driver_found', {
    driverName: matchResult.matchedDriver?.name,
    matchScore: matchResult.matchScore,
    scoreBreakdown: matchResult.scoreBreakdown,
    allCandidates: matchResult.allCandidates
  }, `🎯 Matching: ${matchResult.matchedDriver?.name} wins with score ${matchResult.matchScore}`)

  // Step 3: TSP Route
  await wait(2000)
  const shelters = await prisma.shelter.findMany({
    where: { isAccepting: true }, take: 1
  })

  const driverPos = {
    lat: matchResult.matchedDriver.currentLat,
    lng: matchResult.matchedDriver.currentLng
  }

  const route = solveTSP(
    driverPos,
    [{
      id: posting.id,
      name: donor.name,
      lat: donor.lat,
      lng: donor.lng,
      closingTime: posting.closingTime,
      foodType: 'HOT_MEAL',
      quantityKg: 20
    }],
    shelters.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      closingTime: new Date(
        `${new Date().toDateString()} ${s.acceptingTill}`
      )
    }))
  )

  simEmit('simulation:route_calculated', {
    route: route.route,
    totalDistance: route.totalDistance,
    stops: route.totalStops
  }, `🗺️ TSP Route: ${route.totalStops} stops, ${route.totalDistance}km`)

  // Step 4: Driver claims
  await wait(2000)
  const shelter = shelters[0]
  await claimPickup(
    posting.id,
    matchResult.matchedDriver.id,
    shelter?.id || null,
    route
  )

  simEmit('pickup:claimed', {
    driverName: matchResult.matchedDriver.name,
    foodPostingId: posting.id
  }, `🔒 ${matchResult.matchedDriver.name} claimed pickup`)

  // Step 5: Driver moving
  await wait(2000)
  simEmit('simulation:driver_moving', {
    driverId: matchResult.matchedDriver.id,
    driverName: matchResult.matchedDriver.name,
    heading: 'pickup'
  }, '🚗 Driver heading to pickup location')

  // Step 6: Picked up
  await wait(3000)
  const pickup = await prisma.pickup.findUnique({
    where: { foodPostingId: posting.id }
  })

  await prisma.pickup.update({
    where: { id: pickup.id },
    data: { status: 'IN_PROGRESS', pickedUpAt: new Date() }
  })

  simEmit('pickup:picked_up', {
    driverName: matchResult.matchedDriver.name
  }, '📦 Food collected from donor')

  // Step 7: Delivered
  await wait(3000)
  await prisma.$transaction([
    prisma.pickup.update({
      where: { id: pickup.id },
      data: { status: 'DELIVERED', deliveredAt: new Date() }
    }),
    prisma.foodPosting.update({
      where: { id: posting.id },
      data: { status: 'DELIVERED' }
    }),
    prisma.driver.update({
      where: { id: matchResult.matchedDriver.id },
      data: {
        totalDeliveries: { increment: 1 },
        totalKgRescued: { increment: 20 }
      }
    })
  ])

  simEmit('pickup:delivered', {
    driverName: matchResult.matchedDriver.name,
    kgRescued: 20,
    mealsProvided: 50,
    shelterName: shelter?.name
  }, '✅ 20kg delivered! ~50 meals provided')

  simEmit('simulation:completed', { scenario: 'A' },
    '🎉 Scenario A Complete!')
}

// ─────────────────────────────────────
// SCENARIO B — Race Condition Demo
// ─────────────────────────────────────
async function scenarioB(speed = 1) {
  const wait = (ms) => delay(ms / speed)

  simEmit('simulation:started', { scenario: 'B' },
    '🎬 Scenario B: Race Condition Demo')

  // Food post karo
  await wait(1000)
  const donors = await prisma.donor.findMany({ take: 1 })
  const donor = donors[0]

  const posting = await prisma.foodPosting.create({
    data: {
      donorId: donor.id,
      foodType: 'BAKERY',
      isVeg: true,
      quantityKg: 15,
      closingTime: new Date(Date.now() + 45 * 60 * 1000),
      urgencyScore: 55
    }
  })

  await prisma.pickup.create({
    data: { foodPostingId: posting.id }
  })

  simEmit('simulation:food_posted', {
    donorName: donor.name,
    quantity: 15
  }, `📦 ${donor.name} posted 15kg Bakery items`)

  await wait(2000)

  // 2 drivers simultaneously claim
  const drivers = await prisma.driver.findMany({
    where: { isAvailable: true }, take: 2
  })

  if (drivers.length < 2) {
    simEmit('simulation:error', {},
      '❌ Need at least 2 drivers for this scenario')
    return
  }

  simEmit('simulation:race_starting', {
    driver1: drivers[0].name,
    driver2: drivers[1].name
  }, `⚡ ${drivers[0].name} AND ${drivers[1].name} claiming SIMULTANEOUSLY!`)

  await wait(1000)

  // Simultaneous claims
  const [result1, result2] = await Promise.all([
    claimPickup(posting.id, drivers[0].id, null),
    claimPickup(posting.id, drivers[1].id, null)
  ])

  const winner = result1.success ? drivers[0] : drivers[1]
  const loser = result1.success ? drivers[1] : drivers[0]

  simEmit('pickup:claimed', {
    driverName: winner.name
  }, `🔒 ${winner.name} — CLAIM SUCCESSFUL`)

  simEmit('pickup:race_condition_blocked', {
    blockedDriverId: loser.id,
    blockedDriverName: loser.name
  }, `⚡ ${loser.name} — BLOCKED by DB lock! No double booking.`)

  await wait(2000)
  simEmit('simulation:completed', { scenario: 'B' },
    '🎉 Race Condition Demo Complete — DB prevented double booking!')
}

// ─────────────────────────────────────
// SCENARIO C — Dynamic Re-routing
// ─────────────────────────────────────
async function scenarioC(speed = 1) {
  const wait = (ms) => delay(ms / speed)

  simEmit('simulation:started', { scenario: 'C' },
    '🎬 Scenario C: Dynamic Re-routing Demo')

  const donors = await prisma.donor.findMany({ take: 2 })
  const drivers = await prisma.driver.findMany({
    where: { isAvailable: true }, take: 1
  })

  if (!drivers.length || donors.length < 1) {
    simEmit('simulation:error', {}, '❌ Not enough data')
    return
  }

  const driver = drivers[0]
  const donor1 = donors[0]

  // First posting
  await wait(1000)
  const posting1 = await prisma.foodPosting.create({
    data: {
      donorId: donor1.id,
      foodType: 'HOT_MEAL',
      isVeg: false,
      quantityKg: 25,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      urgencyScore: 60
    }
  })
  await prisma.pickup.create({ data: { foodPostingId: posting1.id } })

  simEmit('simulation:food_posted', {
    donorName: donor1.name
  }, `📦 Posting 1: ${donor1.name} — 25kg`)

  // Route calculate
  await wait(1500)
  const shelters = await prisma.shelter.findMany({ take: 1 })

  const route1 = solveTSP(
    { lat: driver.currentLat, lng: driver.currentLng },
    [{
      id: posting1.id,
      name: donor1.name,
      lat: donor1.lat,
      lng: donor1.lng,
      closingTime: posting1.closingTime,
      foodType: 'HOT_MEAL',
      quantityKg: 25
    }],
    shelters.map(s => ({
      id: s.id, name: s.name,
      lat: s.lat, lng: s.lng,
      closingTime: new Date(`${new Date().toDateString()} ${s.acceptingTill}`)
    }))
  )

  simEmit('simulation:route_calculated', {
    route: route1.route,
    totalDistance: route1.totalDistance
  }, `🗺️ Initial Route: ${route1.totalDistance}km`)

  await claimPickup(posting1.id, driver.id, shelters[0]?.id, route1)

  simEmit('simulation:driver_moving', {
    driverName: driver.name
  }, `🚗 ${driver.name} is on route...`)

  // New food appears mid-route
  await wait(3000)

  if (donors.length > 1) {
    const donor2 = donors[1]
    const posting2 = await prisma.foodPosting.create({
      data: {
        donorId: donor2.id,
        foodType: 'BAKERY',
        isVeg: true,
        quantityKg: 8,
        closingTime: new Date(Date.now() + 30 * 60 * 1000),
        urgencyScore: 80
      }
    })
    await prisma.pickup.create({ data: { foodPostingId: posting2.id } })

    simEmit('simulation:new_food_mid_route', {
      donorName: donor2.name,
      quantity: 8
    }, `⚡ NEW FOOD APPEARED: ${donor2.name} — 8kg Bakery (urgent!)`)

    await wait(1500)

    // Re-route
    const route2 = solveTSP(
      { lat: driver.currentLat, lng: driver.currentLng },
      [
        {
          id: posting1.id, name: donor1.name,
          lat: donor1.lat, lng: donor1.lng,
          closingTime: posting1.closingTime,
          foodType: 'HOT_MEAL', quantityKg: 25
        },
        {
          id: posting2.id, name: donor2.name,
          lat: donor2.lat, lng: donor2.lng,
          closingTime: posting2.closingTime,
          foodType: 'BAKERY', quantityKg: 8
        }
      ],
      shelters.map(s => ({
        id: s.id, name: s.name,
        lat: s.lat, lng: s.lng,
        closingTime: new Date(
          `${new Date().toDateString()} ${s.acceptingTill}`
        )
      }))
    )

    simEmit('simulation:route_updated', {
      newRoute: route2.route,
      newDistance: route2.totalDistance,
      addedStop: donor2.name
    }, `🔄 ROUTE UPDATED! New stop added: ${donor2.name} (${route2.totalDistance}km)`)
  }

  await wait(2000)
  simEmit('simulation:completed', { scenario: 'C' },
    '🎉 Dynamic Re-routing Demo Complete!')
}

// ─────────────────────────────────────
// SCENARIO D — Shelter Full
// ─────────────────────────────────────
async function scenarioD(speed = 1) {
  const wait = (ms) => delay(ms / speed)

  simEmit('simulation:started', { scenario: 'D' },
    '🎬 Scenario D: Shelter Full — Redirect Demo')

  await wait(1000)

  const shelters = await prisma.shelter.findMany()
  if (shelters.length < 2) {
    simEmit('simulation:error', {}, '❌ Need 2 shelters')
    return
  }

  // Shelter A full kar do
  await prisma.shelter.update({
    where: { id: shelters[0].id },
    data: {
      currentCommittedKg: shelters[0].maxCapacityKg,
      isAccepting: false
    }
  })

  simEmit('simulation:shelter_full', {
    shelterName: shelters[0].name,
    capacity: shelters[0].maxCapacityKg
  }, `🚫 ${shelters[0].name} is FULL — not accepting!`)

  await wait(2000)

  simEmit('simulation:redirect', {
    from: shelters[0].name,
    to: shelters[1].name
  }, `🔄 Redirecting to ${shelters[1].name} instead`)

  await wait(2000)

  // Reset shelter
  await prisma.shelter.update({
    where: { id: shelters[0].id },
    data: { currentCommittedKg: 0, isAccepting: true }
  })

  simEmit('simulation:shelter_reset', {
    shelterName: shelters[0].name
  }, `✅ ${shelters[0].name} reset — accepting again`)

  simEmit('simulation:completed', { scenario: 'D' },
    '🎉 Shelter Redirect Demo Complete!')
}

/**
 * Run scenario by name
 */
async function runScenario(scenario, speed = 1) {
  if (simulationActive) {
    return { success: false, message: 'Simulation already running' }
  }

  simulationActive = true
  emitToAll('simulation:active', { active: true, scenario })

  try {
    switch (scenario) {
      case 'A': await scenarioA(speed); break
      case 'B': await scenarioB(speed); break
      case 'C': await scenarioC(speed); break
      case 'D': await scenarioD(speed); break
      default:
        return { success: false, message: 'Unknown scenario' }
    }
    return { success: true, scenario }
  } catch (err) {
    console.error('Simulation error:', err)
    emitToAll('simulation:error', { error: err.message })
    return { success: false, message: err.message }
  } finally {
    simulationActive = false
    emitToAll('simulation:active', { active: false })
  }
}

module.exports = { runScenario }