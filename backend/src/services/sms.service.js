const { emitToAll } = require('./socket.service')

async function sendSMS(phone, message) {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY

    if (!apiKey) {
      console.log(`[SMS] To: ${phone} | Message: ${message}`)
      emitToAll('sms:log', {
        mode: 'console',
        phone,
        message,
        success: true
      })
      return { success: true, mode: 'console' }
    }

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: phone
      })
    })

    const data = await response.json()
    emitToAll('sms:log', {
      mode: 'fast2sms',
      phone,
      message,
      success: Boolean(data.return),
      providerResponse: data
    })
    return { success: Boolean(data.return), mode: 'fast2sms', data }
  } catch (error) {
    console.error('[SMS Error]:', error.message)
    emitToAll('sms:log', {
      mode: 'error',
      phone,
      message,
      success: false,
      error: error.message
    })
    return { success: false, mode: 'error', error: error.message }
  }
}

function formatFoodType(foodType) {
  return String(foodType || '')
    .replace(/_/g, ' ')
    .toLowerCase()
}

function sendDriverPickupAlert(driver, foodPosting) {
  const message = `Food Rescue Alert! New pickup available near you. ${foodPosting.quantityKg}kg ${formatFoodType(foodPosting.foodType)} - closes soon. Open app to claim. - Food Rescue Router`
  return sendSMS(driver.phone, message)
}

function sendDriverOTP(driver, otp) {
  const message = `Your Food Rescue OTP is: ${otp}. Valid for 10 minutes. Show this to restaurant for verification. - Food Rescue Router`
  return sendSMS(driver.phone, message)
}

function sendRestaurantOTP(donor, otp) {
  const message = `Pickup verification OTP: ${otp}. Share this only with the assigned driver after identity check. Valid for 10 minutes. - Food Rescue Router`
  return sendSMS(donor.contactPhone, message)
}

function sendShelterDeliveryOTP(shelter, otp) {
  const message = `Delivery handoff OTP: ${otp}. Share this only after receiving food and checking driver identity. Valid for 10 minutes. - Food Rescue Router`
  return sendSMS(shelter.contactPhone, message)
}

function sendRestaurantAlert(donor, driver) {
  const message = `Driver ${driver.name} (${driver.vehicleType}) is coming to pick up your food donation. ETA: ~20 minutes. - Food Rescue Router`
  return sendSMS(donor.contactPhone, message)
}

module.exports = {
  sendSMS,
  sendDriverPickupAlert,
  sendDriverOTP,
  sendRestaurantOTP,
  sendShelterDeliveryOTP,
  sendRestaurantAlert
}
