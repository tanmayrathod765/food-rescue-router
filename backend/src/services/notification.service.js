/**
 * Notification Service
 * Browser push notifications + in-app notifications
 */

const prisma = require('../prisma/client')
const { emitToAll } = require('./socket.service')

/**
 * In-app notification store karo
 */
async function createNotification(userId, type, message) {
  try {
    // Socket se real-time bhejo
    emitToAll(`notification:${userId}`, { type, message })

    // General broadcast bhi karo
    emitToAll('notification:new', { userId, type, message })

    return { success: true }
  } catch (err) {
    console.error('Notification error:', err)
    return { success: false }
  }
}

/**
 * Driver ko new pickup alert
 */
async function notifyDriverNewPickup(driver, foodPosting) {
  const message = `🍱 New pickup near you! ${foodPosting.quantityKg}kg ${foodPosting.foodType.replace('_', ' ')} — closes soon`
  await createNotification(driver.id, 'NEW_PICKUP', message)
}

/**
 * Donor ko pickup confirmed
 */
async function notifyDonorPickupConfirmed(donor, driver) {
  const message = `✅ ${driver.name} is coming to pick up your donation!`
  await createNotification(donor.id, 'PICKUP_CONFIRMED', message)
}

/**
 * Shelter ko incoming food alert
 */
async function notifyShelterIncoming(shelter, pickup) {
  const message = `🚗 Food incoming! ${pickup.foodPosting?.quantityKg}kg — ETA ~${pickup.etaMinutes || 20} minutes`
  await createNotification(shelter.id, 'FOOD_INCOMING', message)
}

/**
 * Delivery complete notification
 */
async function notifyDeliveryComplete(donorId, driverId, kgRescued) {
  const meals = Math.round(kgRescued * 2.5)
  await createNotification(
    donorId,
    'DELIVERY_COMPLETE',
    `🎉 Your ${kgRescued}kg donation fed ~${meals} people today!`
  )
  await createNotification(
    driverId,
    'DELIVERY_COMPLETE',
    `🏅 Delivery complete! You rescued ${kgRescued}kg — ~${meals} meals provided`
  )
}

module.exports = {
  createNotification,
  notifyDriverNewPickup,
  notifyDonorPickupConfirmed,
  notifyShelterIncoming,
  notifyDeliveryComplete
}