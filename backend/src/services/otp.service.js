const otpStore = new Map()

function buildOtpKey(pickupId, purpose = 'pickup') {
  return `${pickupId}:${purpose}`
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function createOTP(pickupId, driverId, purpose = 'pickup') {
  const otp = generateOTP()
  const expiresAt = Date.now() + 10 * 60 * 1000
  const key = buildOtpKey(pickupId, purpose)

  otpStore.set(key, {
    otp,
    driverId,
    expiresAt,
    used: false
  })

  return otp
}

function verifyOTP(pickupId, enteredOTP, driverId, purpose = 'pickup') {
  const key = buildOtpKey(pickupId, purpose)
  const stored = otpStore.get(key)
  if (!stored) return { valid: false, reason: 'OTP not found' }
  if (stored.used) return { valid: false, reason: 'OTP already used' }
  if (Date.now() > stored.expiresAt) return { valid: false, reason: 'OTP expired' }
  if (driverId && stored.driverId && stored.driverId !== driverId) {
    return { valid: false, reason: 'OTP is not issued for this driver' }
  }
  if (stored.otp !== enteredOTP) return { valid: false, reason: 'Invalid OTP' }

  otpStore.set(key, { ...stored, used: true })
  return { valid: true }
}

function getOTP(pickupId, purpose = 'pickup') {
  return otpStore.get(buildOtpKey(pickupId, purpose))
}

module.exports = {
  createOTP,
  verifyOTP,
  getOTP
}
