/**
 * Gamification Service
 * Badges, streaks, levels — driver aur donor ke liye
 */

const prisma = require('../prisma/client')
const { emitToAll } = require('./socket.service')

// ─────────────────────────────────────
// BADGE DEFINITIONS
// ─────────────────────────────────────
const DRIVER_BADGES = {
  FIRST_DELIVERY: {
    name: '🌟 First Rescue',
    description: 'Completed your first food rescue!'
  },
  TEN_DELIVERIES: {
    name: '🏅 Rescue Hero',
    description: '10 deliveries completed!'
  },
  FIFTY_DELIVERIES: {
    name: '🏆 Rescue Legend',
    description: '50 deliveries — you are a legend!'
  },
  HUNDRED_KG: {
    name: '⚖️ Century Rescuer',
    description: 'Rescued 100kg of food!'
  },
  WEEK_STREAK: {
    name: '🔥 7-Day Streak',
    description: 'Active for 7 days straight!'
  },
  SPEED_DEMON: {
    name: '⚡ Speed Demon',
    description: 'Delivered within 15 minutes!'
  },
  TRUST_ELITE: {
    name: '💎 Elite Driver',
    description: 'Trust score above 90!'
  }
}

const DONOR_BADGES = {
  FIRST_DONATION: {
    name: '🌱 First Donor',
    description: 'Made your first food donation!'
  },
  TEN_DONATIONS: {
    name: '🥈 Silver Donor',
    description: '10 donations — thank you!'
  },
  FIFTY_KG: {
    name: '🥇 Gold Donor',
    description: 'Donated 50kg of food!'
  },
  HUNDRED_KG: {
    name: '💎 Diamond Donor',
    description: 'Donated 100kg — incredible impact!'
  },
  WEEK_STREAK: {
    name: '🔥 Weekly Hero',
    description: 'Donated 7 days in a row!'
  }
}

// ─────────────────────────────────────
// LEVEL SYSTEM (Drivers)
// ─────────────────────────────────────
function getDriverLevel(totalDeliveries, trustScore) {
  if (totalDeliveries >= 50 && trustScore >= 85) return 'LEGEND'
  if (totalDeliveries >= 20 && trustScore >= 75) return 'HERO'
  if (totalDeliveries >= 5) return 'RISING'
  return 'ROOKIE'
}

const LEVEL_INFO = {
  ROOKIE:  { emoji: '🌱', label: 'Rookie',  color: 'gray' },
  RISING:  { emoji: '⭐', label: 'Rising',  color: 'blue' },
  HERO:    { emoji: '🦸', label: 'Hero',    color: 'purple' },
  LEGEND:  { emoji: '👑', label: 'Legend',  color: 'yellow' }
}

// ─────────────────────────────────────
// BADGE AWARD
// ─────────────────────────────────────
async function awardBadge(entityId, entityType, badgeType, badgeDefs) {
  // Already has badge?
  const existing = await prisma.badge.findFirst({
    where: { entityId, badgeType }
  })
  if (existing) return null

  const badgeDef = badgeDefs[badgeType]
  if (!badgeDef) return null

  const badge = await prisma.badge.create({
    data: {
      entityId,
      entityType,
      badgeType,
      badgeName: badgeDef.name,
      description: badgeDef.description
    }
  })

  // Broadcast badge earned
  emitToAll('gamification:badge_earned', {
    entityId,
    entityType,
    badge: {
      type: badgeType,
      name: badgeDef.name,
      description: badgeDef.description
    }
  })

  return badge
}

// ─────────────────────────────────────
// STREAK UPDATE
// ─────────────────────────────────────
async function updateStreak(entityId, entityType) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = await prisma.streak.findUnique({
    where: { entityId }
  })

  if (!streak) {
    streak = await prisma.streak.create({
      data: {
        entityId,
        entityType,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveAt: new Date()
      }
    })
    return streak
  }

  const lastActive = new Date(streak.lastActiveAt)
  lastActive.setHours(0, 0, 0, 0)

  const daysDiff = Math.floor(
    (today - lastActive) / (1000 * 60 * 60 * 24)
  )

  let newStreak = streak.currentStreak

  if (daysDiff === 0) {
    // Already active today
    return streak
  } else if (daysDiff === 1) {
    // Consecutive day
    newStreak = streak.currentStreak + 1
  } else {
    // Streak broken
    newStreak = 1
  }

  const updated = await prisma.streak.update({
    where: { entityId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(streak.longestStreak, newStreak),
      lastActiveAt: new Date()
    }
  })

  // Streak milestone broadcast
  if (newStreak === 7 || newStreak === 30) {
    emitToAll('gamification:streak_milestone', {
      entityId,
      entityType,
      streak: newStreak
    })
  }

  return updated
}

// ─────────────────────────────────────
// DRIVER ACHIEVEMENT CHECK
// ─────────────────────────────────────
async function checkDriverAchievements(driverId) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId }
  })
  if (!driver) return

  const badges = []

  // First delivery
  if (driver.totalDeliveries >= 1) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'FIRST_DELIVERY', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // 10 deliveries
  if (driver.totalDeliveries >= 10) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'TEN_DELIVERIES', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // 50 deliveries
  if (driver.totalDeliveries >= 50) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'FIFTY_DELIVERIES', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // 100kg rescued
  if (driver.totalKgRescued >= 100) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'HUNDRED_KG', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // Trust elite
  if (driver.trustScore >= 90) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'TRUST_ELITE', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // Update streak
  const streak = await updateStreak(driverId, 'DRIVER')

  // Week streak badge
  if (streak.currentStreak >= 7) {
    const b = await awardBadge(
      driverId, 'DRIVER', 'WEEK_STREAK', DRIVER_BADGES
    )
    if (b) badges.push(b)
  }

  // Update level
  const newLevel = getDriverLevel(
    driver.totalDeliveries,
    driver.trustScore
  )

  if (newLevel !== driver.level) {
    await prisma.driver.update({
      where: { id: driverId },
      data: { level: newLevel }
    })

    emitToAll('gamification:level_up', {
      driverId,
      driverName: driver.name,
      newLevel,
      levelInfo: LEVEL_INFO[newLevel]
    })
  }

  return { badges, streak, level: newLevel }
}

// ─────────────────────────────────────
// DONOR ACHIEVEMENT CHECK
// ─────────────────────────────────────
async function checkDonorAchievements(donorId, kgDonated) {
  const donor = await prisma.donor.findUnique({
    where: { id: donorId }
  })
  if (!donor) return

  // Donor stats derived from delivered postings (schema-safe)
  const deliveredStats = await prisma.foodPosting.aggregate({
    where: {
      donorId,
      status: 'DELIVERED'
    },
    _sum: { quantityKg: true },
    _count: { id: true }
  })

  const totalKgDonated = deliveredStats._sum.quantityKg || 0
  const totalDonations = deliveredStats._count.id || 0

  const badges = []

  // First donation
  if (totalDonations >= 1) {
    const b = await awardBadge(
      donorId, 'DONOR', 'FIRST_DONATION', DONOR_BADGES
    )
    if (b) badges.push(b)
  }

  // 10 donations
  if (totalDonations >= 10) {
    const b = await awardBadge(
      donorId, 'DONOR', 'TEN_DONATIONS', DONOR_BADGES
    )
    if (b) badges.push(b)
  }

  // 50kg donated
  if (totalKgDonated >= 50) {
    const b = await awardBadge(
      donorId, 'DONOR', 'FIFTY_KG', DONOR_BADGES
    )
    if (b) badges.push(b)
  }

  // 100kg donated
  if (totalKgDonated >= 100) {
    const b = await awardBadge(
      donorId, 'DONOR', 'HUNDRED_KG', DONOR_BADGES
    )
    if (b) badges.push(b)
  }

  // Derived badge level (not persisted in Donor model)
  let badgeLevel = 'BRONZE'
  if (totalKgDonated >= 100) badgeLevel = 'DIAMOND'
  else if (totalKgDonated >= 50) badgeLevel = 'GOLD'
  else if (totalKgDonated >= 10) badgeLevel = 'SILVER'

  // Streak
  const streak = await updateStreak(donorId, 'DONOR')

  return { badges, streak, badgeLevel }
}

// ─────────────────────────────────────
// GET LEADERBOARD
// ─────────────────────────────────────
async function getDriverLeaderboard() {
  const drivers = await prisma.driver.findMany({
    orderBy: { totalKgRescued: 'desc' },
    take: 10
  })

  return drivers.map((d, i) => ({
    rank: i + 1,
    id: d.id,
    name: d.name,
    vehicleType: d.vehicleType,
    totalKgRescued: d.totalKgRescued,
    totalDeliveries: d.totalDeliveries,
    trustScore: d.trustScore,
    level: d.level || 'ROOKIE',
    levelInfo: LEVEL_INFO[d.level || 'ROOKIE']
  }))
}

async function getDonorLeaderboard() {
  const donors = await prisma.donor.findMany({
    select: {
      id: true,
      name: true
    }
  })

  const donorStats = await Promise.all(
    donors.map(async (d) => {
      const stats = await prisma.foodPosting.aggregate({
        where: {
          donorId: d.id,
          status: 'DELIVERED'
        },
        _sum: { quantityKg: true },
        _count: { id: true }
      })

      const totalKgDonated = stats._sum.quantityKg || 0
      const totalDonations = stats._count.id || 0

      let badgeLevel = 'BRONZE'
      if (totalKgDonated >= 100) badgeLevel = 'DIAMOND'
      else if (totalKgDonated >= 50) badgeLevel = 'GOLD'
      else if (totalKgDonated >= 10) badgeLevel = 'SILVER'

      return {
        id: d.id,
        name: d.name,
        totalKgDonated,
        totalDonations,
        badgeLevel
      }
    })
  )

  return donorStats
    .sort((a, b) => b.totalKgDonated - a.totalKgDonated)
    .slice(0, 10)
    .map((d, i) => ({
    rank: i + 1,
    id: d.id,
    name: d.name,
    totalKgDonated: d.totalKgDonated,
    totalDonations: d.totalDonations,
    badgeLevel: d.badgeLevel
  }))
}

// GET BADGES FOR ENTITY
async function getBadges(entityId) {
  return prisma.badge.findMany({
    where: { entityId },
    orderBy: { earnedAt: 'desc' }
  })
}

// GET STREAK FOR ENTITY
async function getStreak(entityId) {
  return prisma.streak.findUnique({
    where: { entityId }
  })
}

module.exports = {
  checkDriverAchievements,
  checkDonorAchievements,
  getDriverLeaderboard,
  getDonorLeaderboard,
  getBadges,
  getStreak,
  LEVEL_INFO,
  DRIVER_BADGES,
  DONOR_BADGES
}