/**
 * Food Passport Service
 * Har food donation ka digital identity banata hai
 * 
 * Format: FP-YYYYMMDD-XXXX
 * Tracks: Posted → Matched → Picked Up → Delivered
 */

const QRCode = require('qrcode')
const prisma = require('../prisma/client')

/**
 * Unique Food Passport ID generate karta hai
 */
function generatePassportId() {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `FP-${dateStr}-${random}`
}

/**
 * Food Passport data banata hai
 */
async function generatePassport(foodPostingId) {
  try {
    const posting = await prisma.foodPosting.findUnique({
      where: { id: foodPostingId },
      include: {
        donor: true,
        pickup: {
          include: {
            driver: true,
            shelter: true
          }
        }
      }
    })

    if (!posting) {
      return { success: false, message: 'Food posting not found' }
    }

    const passportId = generatePassportId()

    // Journey timeline banao
    const journey = [
      {
        stage: 'POSTED',
        label: 'Food Posted',
        timestamp: posting.createdAt,
        location: posting.donor.name,
        details: `${posting.quantityKg}kg ${posting.foodType.replace('_', ' ')}`
      }
    ]

    if (posting.pickup?.claimedAt) {
      journey.push({
        stage: 'MATCHED',
        label: 'Driver Assigned',
        timestamp: posting.pickup.claimedAt,
        location: posting.donor.address,
        details: `Driver: ${posting.pickup.driver?.name}`
      })
    }

    if (posting.pickup?.pickedUpAt) {
      journey.push({
        stage: 'PICKED_UP',
        label: 'Food Collected',
        timestamp: posting.pickup.pickedUpAt,
        location: posting.donor.name,
        details: `Collected by ${posting.pickup.driver?.name}`
      })
    }

    if (posting.pickup?.deliveredAt) {
      journey.push({
        stage: 'DELIVERED',
        label: 'Delivered to Shelter',
        timestamp: posting.pickup.deliveredAt,
        location: posting.pickup.shelter?.name,
        details: `${Math.round(posting.quantityKg * 2.5)} meals provided`
      })
    }

    const passport = {
      passportId,
      foodPostingId,
      createdAt: new Date(),

      // Food details
      food: {
        type: posting.foodType,
        isVeg: posting.isVeg,
        quantityKg: posting.quantityKg,
        description: posting.description,
        closingTime: posting.closingTime,
        urgencyScore: posting.urgencyScore
      },

      // Origin
      origin: {
        name: posting.donor.name,
        address: posting.donor.address,
        contact: posting.donor.contactName
      },

      // Handler
      handler: posting.pickup?.driver
        ? {
            name: posting.pickup.driver.name,
            vehicle: posting.pickup.driver.vehicleType,
            trustScore: posting.pickup.driver.trustScore
          }
        : null,

      // Destination
      destination: posting.pickup?.shelter
        ? {
            name: posting.pickup.shelter.name,
            address: posting.pickup.shelter.address
          }
        : null,

      // Impact
      impact: {
        mealsProvided: Math.round(posting.quantityKg * 2.5),
        co2Saved: Math.round(posting.quantityKg * 2.5 * 10) / 10,
        moneyValue: Math.round(posting.quantityKg * 150)
      },

      // Current status
      status: posting.status,
      journey
    }

    // QR Code generate karo
    const qrData = JSON.stringify({
      passportId,
      foodPostingId,
      status: posting.status,
      origin: posting.donor.name,
      quantity: posting.quantityKg
    })

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })

    return {
      success: true,
      passport,
      qrCode: qrCodeDataUrl
    }

  } catch (error) {
    console.error('Passport generation error:', error)
    return { success: false, message: error.message }
  }
}

module.exports = { generatePassport, generatePassportId }