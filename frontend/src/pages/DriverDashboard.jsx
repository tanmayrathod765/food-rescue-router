import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import Achievements from '../components/Achievements'
import BadgeNotification from '../components/BadgeNotification'
import LiveMap from '../components/Map/LiveMap'

function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = value => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function estimateTravelTime(lat1, lng1, lat2, lng2) {
  const distance = haversineDistance(lat1, lng1, lat2, lng2)
  return (distance / 30) * 60
}

function isPickupEligible(pickup, driver) {
  if (!pickup?.foodPosting || !driver) return false

  const quantityKg = Number(pickup.foodPosting.quantityKg || 0)
  const donorLat = Number(pickup.foodPosting?.donor?.lat)
  const donorLng = Number(pickup.foodPosting?.donor?.lng)
  const driverLat = Number(driver.currentLat)
  const driverLng = Number(driver.currentLng)
  const closingTime = new Date(pickup.foodPosting.closingTime)

  if (!Number.isFinite(driverLat) || !Number.isFinite(driverLng)) return false
  if (!Number.isFinite(donorLat) || !Number.isFinite(donorLng)) return false
  if ((driver.capacityKg || 0) < quantityKg) return false

  const travelMinutes = estimateTravelTime(driverLat, driverLng, donorLat, donorLng)
  const arrivalTime = new Date(Date.now() + travelMinutes * 60 * 1000)
  return arrivalTime < closingTime
}

function getPickupEligibilityInfo(pickup, driver) {
  if (!pickup?.foodPosting || !driver) {
    return { eligible: false, reason: 'Driver profile not loaded' }
  }

  const quantityKg = Number(pickup.foodPosting.quantityKg || 0)
  const donorLat = Number(pickup.foodPosting?.donor?.lat)
  const donorLng = Number(pickup.foodPosting?.donor?.lng)
  const driverLat = Number(driver.currentLat)
  const driverLng = Number(driver.currentLng)
  const closingTime = new Date(pickup.foodPosting.closingTime)

  if (!driver.isAvailable) {
    return { eligible: false, reason: 'Go online first' }
  }

  if (!Number.isFinite(driverLat) || !Number.isFinite(driverLng)) {
    return { eligible: false, reason: 'Live driver location not available' }
  }

  if (!Number.isFinite(donorLat) || !Number.isFinite(donorLng)) {
    return { eligible: false, reason: 'Restaurant location missing' }
  }

  if ((driver.capacityKg || 0) < quantityKg) {
    return { eligible: false, reason: 'Insufficient vehicle capacity' }
  }

  const travelMinutes = estimateTravelTime(driverLat, driverLng, donorLat, donorLng)
  const arrivalTime = new Date(Date.now() + travelMinutes * 60 * 1000)
  if (arrivalTime >= closingTime) {
    return { eligible: false, reason: 'Cannot reach before closing time' }
  }

  return { eligible: true, reason: 'Eligible for claim' }
}

function formatVehicleIcon(vehicleType) {
  if (vehicleType === 'BIKE') return '🚲'
  if (vehicleType === 'CAR') return '🚗'
  if (vehicleType === 'VAN') return '🚐'
  return '🚛'
}

export default function DriverDashboard() {
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [pickups, setPickups] = useState([])
  const [myPickup, setMyPickup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [debugOtp, setDebugOtp] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpReadyForVerification, setOtpReadyForVerification] = useState(false)
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('')
  const [deliveryOtpLoading, setDeliveryOtpLoading] = useState(false)
  const [deliveryOtpReady, setDeliveryOtpReady] = useState(false)
  const [deliveryOtpVerified, setDeliveryOtpVerified] = useState(false)
  const [deliveryPhoto, setDeliveryPhoto] = useState(null)
  const [deliveryPhotoUploaded, setDeliveryPhotoUploaded] = useState(false)
  const [deliveryPhotoVerifiedByRestaurant, setDeliveryPhotoVerifiedByRestaurant] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const lastHandledOtpEventIdRef = useRef(0)
  const locationWatchIdRef = useRef(null)
  const [profileError, setProfileError] = useState('')
  const { connected, events } = useSocket()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role && user.role !== 'DRIVER') {
      navigate('/login', { replace: true })
      return
    }

    api.get('/api/drivers/me')
      .then(res => {
        setSelectedDriver(res.data.data)
        setMyPickup(res.data.data.activePickup || null)
        setProfileError('')
      })
      .catch(error => {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404) {
          setProfileError('Session mismatch detected. Please login again with a driver account.')
          logout()
          navigate('/login', { replace: true })
          return
        }
        console.error(error)
      })
  }, [user?.role, logout, navigate])

  const fetchPickups = useCallback(async () => {
    try {
      const res = await api.get('/api/pickups')
      const all = res.data.data
      setPickups(all.filter(p => p.status === 'PENDING'))
      if (selectedDriver) {
        setMyPickup(
          all.find(p =>
            p.driverId === selectedDriver?.id &&
            ['CLAIMED', 'IN_PROGRESS'].includes(p.status)
          ) || null
        )
      }
    } catch {
      console.error('Failed to fetch pickups')
    }
  }, [selectedDriver])

  // Available pickups fetch karo
  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchPickups()
    })
  }, [fetchPickups])

  // Socket events pe refresh
  useEffect(() => {
    if (events.length > 0) {
      void Promise.resolve().then(() => {
        fetchPickups()
      })
    }
  }, [events, fetchPickups])

  useEffect(() => {
    if (selectedDriver?.activePickup) {
      setMyPickup(selectedDriver.activePickup)
    }
  }, [selectedDriver])

  useEffect(() => {
    if (!selectedDriver?.id) return undefined
    if (!navigator.geolocation) return undefined

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude)
        const lng = Number(position.coords.longitude)

        setSelectedDriver(prev => {
          if (!prev) return prev
          return {
            ...prev,
            currentLat: lat,
            currentLng: lng
          }
        })

        api.put(`/api/drivers/${selectedDriver.id}/location`, { lat, lng })
          .catch(() => {
            // Ignore transient location sync failures and keep UI responsive.
          })
      },
      () => {
        // Location permission denied or unavailable.
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    return () => {
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current)
      }
      locationWatchIdRef.current = null
    }
  }, [selectedDriver?.id])

  useEffect(() => {
    if (!events || events.length === 0) return
    const latestEvent = events[0]
    if (!latestEvent) return
    if (latestEvent.id === lastHandledOtpEventIdRef.current) return
    lastHandledOtpEventIdRef.current = latestEvent.id

    if (!myPickup || !selectedDriver) return

    if (
      latestEvent.event === 'otp:restaurant_notified' &&
      latestEvent.data?.pickupId === myPickup.id &&
      latestEvent.data?.driverId === selectedDriver.id
    ) {
      if (latestEvent.data?.restaurantNotified) {
        setOtpReadyForVerification(true)
        setMsg('✅ Restaurant confirmation received. Enter OTP now.')
      } else {
        setOtpReadyForVerification(false)
        setMsg('❌ Restaurant notification not confirmed. Please resend OTP.')
      }
      return
    }

    if (
      latestEvent.event === 'otp:delivery_generated' &&
      latestEvent.data?.pickupId === myPickup.id &&
      latestEvent.data?.driverId === selectedDriver.id
    ) {
      setDeliveryOtpReady(true)
      setMsg('🔐 Shelter generated delivery OTP. Ask shelter and verify to complete handoff.')
      return
    }

    if (
      latestEvent.event === 'otp:delivery_verified' &&
      latestEvent.data?.pickupId === myPickup.id &&
      latestEvent.data?.driverId === selectedDriver.id
    ) {
      setDeliveryOtpVerified(true)
      setMsg('✅ Shelter delivery OTP verified. Upload proof photo and complete delivery.')
    }

    if (
      latestEvent.event === 'delivery:photo_verified' &&
      latestEvent.data?.pickupId === myPickup.id
    ) {
      setDeliveryPhotoVerifiedByRestaurant(true)
      setMsg('✅ Restaurant verified your delivery photo. You can now mark as delivered.')
    }
  }, [events, myPickup, selectedDriver])

  useEffect(() => {
    setOtpReadyForVerification(false)
    setOtpInput('')
    setDebugOtp('')
    setDeliveryOtpReady(false)
    setDeliveryOtpInput('')
    setDeliveryOtpVerified(false)
    setDeliveryPhoto(null)
    setDeliveryPhotoUploaded(false)
    setDeliveryPhotoVerifiedByRestaurant(false)
  }, [myPickup?.id, selectedDriver?.id])

  useEffect(() => {
    const routeData = myPickup?.routeData
    if (routeData && typeof routeData === 'object' && !Array.isArray(routeData)) {
      setDeliveryOtpVerified(Boolean(routeData.deliveryOtpVerifiedAt))
      setDeliveryPhotoUploaded(Boolean(routeData.deliveryPhotoUrl))
      setDeliveryPhotoVerifiedByRestaurant(Boolean(routeData.deliveryPhotoVerifiedAt))
    }
  }, [myPickup?.routeData])

  const handleAvailability = async () => {
    if (!selectedDriver) return
    try {
      const res = await api.put(
        `/api/drivers/${selectedDriver.id}/availability`,
        { isAvailable: !selectedDriver.isAvailable }
      )
      setSelectedDriver(res.data.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleClaim = async (pickup) => {
    if (!selectedDriver) return
    setLoading(true)
    try {
      const res = await api.post('/api/pickups/claim', {
        foodPostingId: pickup.foodPostingId,
        driverId: selectedDriver.id,
        shelterId: null
      })

      if (res.data.raceConditionBlocked) {
        setMsg('⚡ Race condition blocked! Another driver just claimed this.')
      } else if (res.data.success) {
        setMsg('✅ Pickup claimed successfully!')
        fetchPickups()
      } else {
        setMsg('❌ ' + res.data.message)
      }
      setTimeout(() => setMsg(''), 4000)
    } catch {
      setMsg('❌ Error claiming pickup')
    }
    setLoading(false)
  }

  const handlePickedUp = async () => {
    if (!myPickup) return
    try {
      await api.put(`/api/pickups/${myPickup.id}/picked-up`, {
        driverId: selectedDriver.id
      })
      setMsg('📦 Marked as picked up!')
      fetchPickups()
      setTimeout(() => setMsg(''), 3000)
    } catch {
      setMsg('❌ Error updating status')
    }
  }

  const generateOTP = async () => {
    if (!myPickup) return
    setOtpLoading(true)
    setOtpReadyForVerification(false)
    setDebugOtp('')
    try {
      const res = await api.post(`/api/pickups/${myPickup.id}/generate-otp`, {
        driverId: selectedDriver?.id
      })
      const debugOtp = res.data?.debugOtp || ''

      if (debugOtp) {
        setDebugOtp(debugOtp)
        setOtpReadyForVerification(true)
        setMsg('⚠️ Fallback OTP received. Use it for verification now.')
      } else if (!res.data?.restaurantNotified) {
        setMsg('⚠️ OTP generated but restaurant dashboard sync is pending. Wait a moment and retry.')
      } else {
        setMsg('🔑 OTP generated on restaurant dashboard. Ask restaurant for OTP and verify.')
      }
    } catch (error) {
      console.error(error)
      setMsg('❌ OTP generation failed')
    }
    setOtpLoading(false)
  }

  const verifyPickupOtp = async () => {
    if (!myPickup || !selectedDriver) return
    if (!otpReadyForVerification) {
      setMsg('❌ Verification locked until restaurant confirmation event is received')
      return
    }
    if (!otpInput.trim()) {
      setMsg('❌ Please enter OTP from restaurant')
      return
    }

    setOtpLoading(true)
    try {
      const res = await api.post(`/api/pickups/${myPickup.id}/verify-otp`, {
        otp: otpInput.trim(),
        driverId: selectedDriver.id
      })

      if (res.data?.success) {
        setMsg('✅ OTP verified. Pickup is now in progress.')
        setOtpInput('')
        setOtpReadyForVerification(false)
        fetchPickups()
      } else {
        setMsg('❌ OTP verification failed')
      }
    } catch (error) {
      setMsg(`❌ ${error.response?.data?.message || 'OTP verification failed'}`)
    }
    setOtpLoading(false)
  }

  const uploadDeliveryPhoto = async (pickupId) => {
    if (!deliveryPhoto) return
    if (!deliveryOtpVerified) {
      setMsg('❌ Verify shelter delivery OTP before uploading delivery proof')
      return
    }
    setPhotoUploading(true)

    const formData = new FormData()
    formData.append('photo', deliveryPhoto)

    try {
      await api.post(`/api/pickups/${pickupId}/delivery-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setDeliveryPhoto(null)
      setDeliveryPhotoUploaded(true)
      setDeliveryPhotoVerifiedByRestaurant(false)
      setMsg('📸 Photo uploaded! Waiting for restaurant verification.')
    } catch (error) {
      console.error(error)
      setMsg('❌ Photo upload failed')
    }

    setPhotoUploading(false)
  }

  const verifyDeliveryOtp = async () => {
    if (!myPickup || !selectedDriver) return
    if (!deliveryOtpInput.trim()) {
      setMsg('❌ Enter delivery OTP from shelter')
      return
    }

    setDeliveryOtpLoading(true)
    try {
      const res = await api.post(`/api/pickups/${myPickup.id}/verify-delivery-otp`, {
        otp: deliveryOtpInput.trim(),
        driverId: selectedDriver.id
      })

      if (res.data?.success) {
        setDeliveryOtpVerified(true)
        setDeliveryOtpReady(true)
        setDeliveryOtpInput('')
        setMsg('✅ Delivery OTP verified. Now upload proof photo and mark delivered.')
      } else {
        setMsg('❌ Delivery OTP verification failed')
      }
    } catch (error) {
      setMsg(`❌ ${error.response?.data?.message || 'Delivery OTP verification failed'}`)
    }
    setDeliveryOtpLoading(false)
  }

  const handleDelivered = async () => {
    if (!myPickup) return
    if (!deliveryOtpVerified) {
      setMsg('❌ Delivery OTP verification required before completion')
      return
    }
    if (!deliveryPhotoUploaded) {
      setMsg('❌ Upload delivery proof photo before marking delivered')
      return
    }
    if (!deliveryPhotoVerifiedByRestaurant) {
      setMsg('❌ Restaurant must verify delivery photo before completion')
      return
    }
    try {
      await api.put(`/api/pickups/${myPickup.id}/delivered`, {
        driverId: selectedDriver.id
      })
      setMsg('🎉 Delivery complete! Impact recorded.')
      setMyPickup(null)
      fetchPickups()
      setTimeout(() => setMsg(''), 4000)
    } catch {
      setMsg('❌ Error completing delivery')
    }
  }

  const getTrustColor = (score) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 75) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getTrustBadge = (score) => {
    if (score >= 90) return '🏆 Elite'
    if (score >= 75) return '⭐ Good'
    return '📈 Growing'
  }

  const visiblePickups = useMemo(() => pickups, [pickups])

  const routePoints = useMemo(() => {
    if (
      !selectedDriver ||
      !myPickup?.foodPosting?.donor ||
      !Number.isFinite(Number(selectedDriver.currentLat)) ||
      !Number.isFinite(Number(selectedDriver.currentLng))
    ) {
      return []
    }

    const donorPoint = [
      Number(myPickup.foodPosting.donor.lat),
      Number(myPickup.foodPosting.donor.lng)
    ]
    const driverPoint = [
      Number(selectedDriver.currentLat),
      Number(selectedDriver.currentLng)
    ]

    const routes = [
      {
        label: 'Path A: Driver -> Restaurant',
        points: [driverPoint, donorPoint],
        color: '#3b82f6'
      }
    ]

    if (myPickup?.shelter && Number.isFinite(Number(myPickup.shelter.lat)) && Number.isFinite(Number(myPickup.shelter.lng))) {
      routes.push({
        label: 'Path B: Restaurant -> Shelter',
        points: [
          donorPoint,
          [Number(myPickup.shelter.lat), Number(myPickup.shelter.lng)]
        ],
        color: '#22c55e'
      })
    }

    return routes
  }, [selectedDriver, myPickup])

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          🚗 Driver Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-400">
            Volunteer driver portal — accept pickups and deliver food
          </p>
          <span className={`text-xs px-2 py-1 rounded-full ${
            connected
              ? 'bg-green-500 bg-opacity-20 text-green-400'
              : 'bg-red-500 bg-opacity-20 text-red-400'
          }`}>
            {connected ? '● Live' : '○ Offline'}
          </span>
        </div>
      </div>

      {selectedDriver ? (
        <>
          {profileError && (
            <div className="mb-6 bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 text-red-300 text-sm">
              {profileError}
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 bg-opacity-20 rounded-xl flex items-center justify-center text-2xl">
                {formatVehicleIcon(selectedDriver.vehicleType)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedDriver.name}</h2>
                <p className="text-gray-400 text-sm">
                  {selectedDriver.vehicleType} • {selectedDriver.capacityKg}kg capacity • {selectedDriver.phone}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Live location: {Number.isFinite(Number(selectedDriver.currentLat)) && Number.isFinite(Number(selectedDriver.currentLng))
                    ? `${Number(selectedDriver.currentLat).toFixed(5)}, ${Number(selectedDriver.currentLng).toFixed(5)}`
                    : 'Not available'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-3 py-1 rounded-full border border-green-500 border-opacity-30">
                  ● Driver Account
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  connected
                    ? 'bg-green-500 bg-opacity-20 text-green-400'
                    : 'bg-red-500 bg-opacity-20 text-red-400'
                }`}>
                  {connected ? '● Live' : '○ Offline'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-green-400 mb-4">👤 Profile</h2>
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">{formatVehicleIcon(selectedDriver.vehicleType)}</div>
                <h3 className="text-xl font-bold text-white">{selectedDriver.name}</h3>
                <p className="text-gray-400 text-sm">
                  {selectedDriver.vehicleType} • {selectedDriver.capacityKg}kg capacity
                </p>
              </div>

              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400 text-sm">Trust Score</span>
                  <span className={`font-bold ${getTrustColor(selectedDriver.trustScore)}`}>
                    {getTrustBadge(selectedDriver.trustScore)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        selectedDriver.trustScore >= 90 ? 'bg-green-500' :
                        selectedDriver.trustScore >= 75 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${selectedDriver.trustScore}%` }}
                    />
                  </div>
                  <span className={`font-bold text-lg ${getTrustColor(selectedDriver.trustScore)}`}>
                    {selectedDriver.trustScore}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-white">{selectedDriver.totalDeliveries}</div>
                  <div className="text-gray-400 text-xs">Deliveries</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{selectedDriver.totalKgRescued}kg</div>
                  <div className="text-gray-400 text-xs">Rescued</div>
                </div>
              </div>

              <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-3 text-center mb-4">
                <div className="text-2xl font-bold text-green-400">
                  ~{Math.round(selectedDriver.totalKgRescued * 2.5)}
                </div>
                <div className="text-green-400 text-xs">Meals Provided 🍽️</div>
              </div>

              <button
                onClick={handleAvailability}
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  selectedDriver.isAvailable
                    ? 'bg-green-500 text-black'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {selectedDriver.isAvailable
                  ? '✅ Available — Click to go Offline'
                  : '❌ Offline — Click to go Online'}
              </button>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 lg:col-span-2">
              <h2 className="text-lg font-bold text-green-400 mb-4">📍 Active Pickup</h2>

              {msg && (
                <div className="mb-4 bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg px-4 py-3 text-blue-400 text-sm">
                  {msg}
                </div>
              )}

              {myPickup ? (
                <div>
                  <div className="bg-gray-800 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-3 h-3 rounded-full ${
                        myPickup.status === 'CLAIMED' ? 'bg-yellow-400' : 'bg-blue-400'
                      } animate-pulse`} />
                      <span className="font-bold text-white">
                        {myPickup.status === 'CLAIMED' ? 'Heading to Pickup' : 'Food Collected — Delivering'}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-300"><span>🏪</span><span>{myPickup.foodPosting?.donor?.name}</span></div>
                      <div className="flex items-center gap-2 text-gray-300"><span>⚖️</span><span>{myPickup.foodPosting?.quantityKg}kg food</span></div>
                      <div className="flex items-center gap-2 text-gray-300"><span>🍽️</span><span>~{Math.round(myPickup.foodPosting?.quantityKg * 2.5)} meals</span></div>
                      <div className="flex items-center gap-2 text-gray-300"><span>⏰</span><span>Closes: {new Date(myPickup.foodPosting?.closingTime).toLocaleTimeString()}</span></div>
                      {myPickup.shelter && (
                        <div className="flex items-center gap-2 text-purple-400"><span>🏠</span><span>Deliver to: {myPickup.shelter?.name}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-bold text-gray-400 mb-3">📍 Route</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">1</div>
                        <span className="text-sm text-white">{myPickup.foodPosting?.donor?.name}</span>
                        <span className="text-xs text-blue-400 ml-auto">PATH A • RESTAURANT</span>
                      </div>
                      <div className="ml-3 border-l-2 border-gray-600 h-4" />
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">2</div>
                        <span className="text-sm text-white">{myPickup.shelter?.name || 'Shelter (auto-assigned)'}</span>
                        <span className="text-xs text-green-400 ml-auto">PATH B • SHELTER</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <LiveMap
                        drivers={[selectedDriver]}
                        donors={myPickup?.foodPosting?.donor ? [myPickup.foodPosting.donor] : []}
                        shelters={myPickup?.shelter ? [myPickup.shelter] : []}
                        routes={routePoints}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {myPickup.status === 'CLAIMED' && (
                      <>
                        <div className="mb-3">
                          <button
                            onClick={generateOTP}
                            disabled={otpLoading}
                            className="w-full bg-yellow-500 bg-opacity-20 border border-yellow-500 text-yellow-400 font-bold py-3 rounded-xl mb-2"
                          >
                            {otpLoading ? '⏳ Sending OTP...' : '🔑 Send OTP to Restaurant'}
                          </button>

                          <div className="bg-gray-800 rounded-xl p-4 border border-yellow-500 border-opacity-50">
                            <p className="text-gray-400 text-xs mb-2">Enter OTP received by restaurant:</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={otpInput}
                                onChange={e => setOtpInput(e.target.value)}
                                placeholder="6-digit OTP"
                                maxLength={6}
                                disabled={!otpReadyForVerification}
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-mono tracking-widest focus:outline-none focus:border-yellow-400"
                              />
                              <button
                                onClick={verifyPickupOtp}
                                disabled={otpLoading || !otpReadyForVerification}
                                className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg"
                              >
                                Verify
                              </button>
                            </div>
                            <p className="text-gray-500 text-xs mt-2">Restaurant OTP appears on restaurant dashboard. Verify unlocks after restaurant confirmation event.</p>
                            {debugOtp && (
                              <div className="mt-2 bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg px-3 py-2">
                                <p className="text-yellow-300 text-xs">Fallback OTP:</p>
                                <p className="text-yellow-400 font-bold tracking-widest">{debugOtp}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500">Pickup will automatically move to in-progress after OTP verification.</p>
                      </>
                    )}

                    {myPickup.status === 'IN_PROGRESS' && (
                      <>
                        <div className="bg-gray-800 rounded-xl p-4 border border-purple-500 border-opacity-50">
                          <p className="text-purple-300 text-xs font-bold mb-2">🔐 Shelter Delivery OTP</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={deliveryOtpInput}
                              onChange={e => setDeliveryOtpInput(e.target.value)}
                              placeholder={deliveryOtpReady ? 'Enter OTP from shelter' : 'Waiting for shelter OTP generation'}
                              maxLength={6}
                              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-center font-mono tracking-widest focus:outline-none focus:border-purple-400"
                            />
                            <button
                              onClick={verifyDeliveryOtp}
                              disabled={deliveryOtpLoading || !deliveryOtpInput.trim()}
                              className="bg-purple-500 text-white font-bold px-4 py-2 rounded-lg disabled:opacity-60"
                            >
                              {deliveryOtpLoading ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                          <p className="text-gray-500 text-xs mt-2">Shelter generates OTP on its dashboard. Verify OTP before final delivery steps.</p>
                          {deliveryOtpVerified && (
                            <p className="text-green-400 text-xs mt-2">✅ Delivery OTP verified</p>
                          )}
                        </div>

                        <div className="mt-3 bg-gray-800 rounded-xl p-3">
                          <p className="text-gray-400 text-xs mb-2">📸 Upload delivery proof photo</p>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={!deliveryOtpVerified}
                            onChange={e => setDeliveryPhoto(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-green-500 file:bg-opacity-20 file:text-green-400 file:font-bold"
                          />
                          {deliveryPhoto && (
                            <button
                              onClick={() => uploadDeliveryPhoto(myPickup.id)}
                              disabled={photoUploading}
                              className="w-full mt-2 bg-green-500 bg-opacity-20 border border-green-500 text-green-400 font-bold py-2 rounded-lg text-sm"
                            >
                              {photoUploading ? '⏳ Uploading...' : '📤 Send Photo to Restaurant'}
                            </button>
                          )}
                          {!deliveryOtpVerified && (
                            <p className="text-yellow-400 text-xs mt-2">Verify shelter OTP first, then upload photo.</p>
                          )}
                          {deliveryPhotoUploaded && (
                            <p className="text-green-400 text-xs mt-2">✅ Delivery proof uploaded</p>
                          )}
                          {deliveryPhotoUploaded && !deliveryPhotoVerifiedByRestaurant && (
                            <p className="text-yellow-400 text-xs mt-2">⏳ Waiting for restaurant verification</p>
                          )}
                          {deliveryPhotoVerifiedByRestaurant && (
                            <p className="text-green-400 text-xs mt-2">✅ Restaurant verified delivery proof</p>
                          )}
                        </div>

                        <button
                          onClick={handleDelivered}
                          disabled={!deliveryOtpVerified || !deliveryPhotoUploaded || !deliveryPhotoVerifiedByRestaurant}
                          className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-400 text-black font-bold py-3 rounded-xl transition-all"
                        >
                          ✅ Mark as Delivered
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <div className="text-5xl mb-4">🚗</div>
                  <p>No active pickup</p>
                  <p className="text-sm mt-2">Claim a pickup from the eligible list below.</p>
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 lg:col-span-3">
              <h2 className="text-lg font-bold text-green-400 mb-4">
                📋 Restaurant Pickups
                <span className="ml-2 text-sm bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                  {visiblePickups.length}
                </span>
              </h2>

              {visiblePickups.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <div className="text-4xl mb-3">✨</div>
                  <p>No restaurant pickups right now</p>
                  <p className="text-sm mt-2">We’ll notify you by SMS when a restaurant posts surplus food you can claim.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[520px] overflow-y-auto pr-1">
                  {visiblePickups.map(pickup => {
                    const eligibility = getPickupEligibilityInfo(pickup, selectedDriver)
                    return (
                    <div key={pickup.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-white text-sm">{pickup.foodPosting?.donor?.name}</p>
                          <p className="text-gray-400 text-xs">{pickup.foodPosting?.foodType?.replace('_', ' ')}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full text-white ${pickup.foodPosting?.isVeg ? 'bg-green-600' : 'bg-red-600'}`}>
                          {pickup.foodPosting?.isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 mb-3">
                        <span>⚖️ {pickup.foodPosting?.quantityKg}kg</span>
                        <span>⏰ {new Date(pickup.foodPosting?.closingTime).toLocaleTimeString()}</span>
                        <span>🍽️ ~{Math.round(pickup.foodPosting?.quantityKg * 2.5)} meals</span>
                        <span className={eligibility.eligible ? 'text-green-400' : 'text-yellow-400'}>
                          {eligibility.reason}
                        </span>
                      </div>

                      <button
                        onClick={() => handleClaim(pickup)}
                        disabled={loading || !eligibility.eligible}
                        className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2 rounded-lg transition-all text-sm"
                      >
                        {!eligibility.eligible ? `❌ ${eligibility.reason}` : loading ? '⏳ Claiming...' : '🚀 Claim Pickup'}
                      </button>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-400">
          Loading authenticated driver profile...
        </div>
      )}
       {/* Achievements */}
{selectedDriver && (
  <div className="mt-6">
    <Achievements
      entityId={selectedDriver.id}
      entityType="DRIVER"
    />
  </div>
)}

<BadgeNotification events={events} />
      {/* Live Events Log */}
      {events.length > 0 && (
        <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">
            ⚡ Live System Events
          </h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm bg-gray-800 rounded-lg px-4 py-2"
              >
                <span className="text-gray-500 text-xs font-mono">
                  {e.timestamp}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  e.event.includes('claimed') ? 'bg-green-500 text-black' :
                  e.event.includes('blocked') ? 'bg-red-500 text-white' :
                  e.event.includes('delivered') ? 'bg-purple-500 text-white' :
                  'bg-blue-500 text-white'
                }`}>
                  {e.event}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}