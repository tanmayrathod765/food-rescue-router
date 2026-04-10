const { claimPickup } = require('../services/claim.service')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─────────────────────────────────────
// Test Data Setup
// ─────────────────────────────────────
let testDonorId, testDriverId1, testDriverId2
let testPostingId, testShelterId

beforeAll(async () => {
  // Test donor
  const donor = await prisma.donor.create({
    data: {
      name: 'Test Donor',
      address: 'Test Address',
      lat: 22.74,
      lng: 75.88,
      contactName: 'Test',
      contactPhone: '9999999999',
      email: `testdonor_${Date.now()}@test.com`,
      password: 'test123'
    }
  })
  testDonorId = donor.id

  // Test drivers
  const driver1 = await prisma.driver.create({
    data: {
      name: 'Test Driver 1',
      email: `testdriver1_${Date.now()}@test.com`,
      password: 'test123',
      phone: '9999999991',
      vehicleType: 'CAR',
      capacityKg: 50,
      currentLat: 22.74,
      currentLng: 75.88,
      isAvailable: true,
      trustScore: 90
    }
  })
  testDriverId1 = driver1.id

  const driver2 = await prisma.driver.create({
    data: {
      name: 'Test Driver 2',
      email: `testdriver2_${Date.now()}@test.com`,
      password: 'test123',
      phone: '9999999992',
      vehicleType: 'CAR',
      capacityKg: 50,
      currentLat: 22.74,
      currentLng: 75.88,
      isAvailable: true,
      trustScore: 85
    }
  })
  testDriverId2 = driver2.id

  // Test shelter
  const shelter = await prisma.shelter.create({
    data: {
      name: 'Test Shelter',
      address: 'Test Address',
      lat: 22.72,
      lng: 75.86,
      contactName: 'Test',
      contactPhone: '9999999993',
      email: `testshelter_${Date.now()}@test.com`,
      password: 'test123',
      maxCapacityKg: 100,
      acceptingFrom: '18:00',
      acceptingTill: '22:00'
    }
  })
  testShelterId = shelter.id
})

// Cleanup after tests
afterAll(async () => {
  await prisma.pickup.deleteMany({
    where: { foodPosting: { donorId: testDonorId } }
  })
  await prisma.foodPosting.deleteMany({ where: { donorId: testDonorId } })
  await prisma.donor.delete({ where: { id: testDonorId } })
  await prisma.driver.delete({ where: { id: testDriverId1 } })
  await prisma.driver.delete({ where: { id: testDriverId2 } })
  await prisma.shelter.delete({ where: { id: testShelterId } })
  await prisma.$disconnect()
})

// Helper — fresh food posting + pickup banao
async function createTestPosting() {
  const posting = await prisma.foodPosting.create({
    data: {
      donorId: testDonorId,
      foodType: 'HOT_MEAL',
      isVeg: true,
      quantityKg: 20,
      closingTime: new Date(Date.now() + 60 * 60 * 1000),
      urgencyScore: 50
    }
  })
  await prisma.pickup.create({
    data: { foodPostingId: posting.id }
  })
  return posting
}

// ─────────────────────────────────────
// CONCURRENCY TESTS
// ─────────────────────────────────────
describe('Concurrency — Race Condition Prevention', () => {

  test('Single driver can claim pickup successfully', async () => {
    const posting = await createTestPosting()
    const result = await claimPickup(
      posting.id, testDriverId1, testShelterId
    )
    expect(result.success).toBe(true)
  }, 10000)

  test('Two drivers claiming simultaneously — only one wins', async () => {
    const posting = await createTestPosting()

    // Dono drivers ek saath claim karte hain
    const [result1, result2] = await Promise.all([
      claimPickup(posting.id, testDriverId1, testShelterId),
      claimPickup(posting.id, testDriverId2, testShelterId)
    ])

    // Exactly ek successful hona chahiye
    const successCount = [result1, result2]
      .filter(r => r.success).length
    const failCount = [result1, result2]
      .filter(r => !r.success).length

    expect(successCount).toBe(1)
    expect(failCount).toBe(1)
  }, 10000)

  test('Already claimed pickup cannot be claimed again', async () => {
    const posting = await createTestPosting()

    // First claim
    await claimPickup(posting.id, testDriverId1, testShelterId)

    // Second claim same driver
    const result = await claimPickup(
      posting.id, testDriverId1, testShelterId
    )

    expect(result.success).toBe(false)
    expect(result.raceConditionBlocked).toBe(true)
  }, 10000)

  test('Failed claim should return raceConditionBlocked flag', async () => {
    const posting = await createTestPosting()

    await Promise.all([
      claimPickup(posting.id, testDriverId1, testShelterId),
      claimPickup(posting.id, testDriverId2, testShelterId)
    ])

    const pickup = await prisma.pickup.findUnique({
      where: { foodPostingId: posting.id }
    })

    // Version 1 hona chahiye (ek update hua)
    expect(pickup.version).toBe(1)
    expect(pickup.status).toBe('CLAIMED')
  }, 10000)

})