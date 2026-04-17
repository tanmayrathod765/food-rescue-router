import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'

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

function estimateEtaMinutes(driverLat, driverLng, shelterLat, shelterLng) {
  if (
    !Number.isFinite(Number(driverLat)) ||
    !Number.isFinite(Number(driverLng)) ||
    !Number.isFinite(Number(shelterLat)) ||
    !Number.isFinite(Number(shelterLng))
  ) {
    return null
  }

  const distanceKm = haversineDistance(
    Number(driverLat),
    Number(driverLng),
    Number(shelterLat),
    Number(shelterLng)
  )

  const avgCitySpeedKmph = 28
  const etaMinutes = Math.max(1, Math.round((distanceKm / avgCitySpeedKmph) * 60))
  return {
    etaMinutes,
    distanceKm: Math.round(distanceKm * 10) / 10
  }
}

function getDriverLocationLabel(pickup, shelterName) {
  const hasLiveGps =
    Number.isFinite(Number(pickup?.driver?.currentLat)) &&
    Number.isFinite(Number(pickup?.driver?.currentLng))

  if (!hasLiveGps) {
    return 'Unavailable'
  }

  if (pickup?.status === 'CLAIMED') {
    return `Near ${pickup?.foodPosting?.donor?.name || 'restaurant pickup point'}`
  }

  return `Near ${shelterName || pickup?.shelter?.name || 'delivery destination'}`
}

export default function ShelterDashboard() {
  const [myShelter, setMyShelter] = useState(null)
  const [incomingPickups, setIncomingPickups] = useState([])
  const [deliveredPickups, setDeliveredPickups] = useState([])

  const [adminShelters, setAdminShelters] = useState([])
  const [adminDrivers, setAdminDrivers] = useState([])
  const [adminAllPickups, setAdminAllPickups] = useState([])
  const [selectedShelterId, setSelectedShelterId] = useState('')

  const [leaderboard, setLeaderboard] = useState([])
  const [msg, setMsg] = useState('')
  const [profileError, setProfileError] = useState('')
  const [deliveryOtpByPickup, setDeliveryOtpByPickup] = useState({})
  const [reportForms, setReportForms] = useState({})
  const [alerts, setAlerts] = useState([])
  const [driverHeartbeatAt, setDriverHeartbeatAt] = useState({})
  const [clockTick, setClockTick] = useState(Date.now())
  const lastHandledEventIdRef = useRef(0)

  const { user, logout } = useAuth()
  const { connected, events } = useSocket(user)
  const navigate = useNavigate()

  const isAdminView = user?.role === 'ADMIN'

  const fetchMyProfile = useCallback(async () => {
    const res = await api.get('/api/shelters/me')
    setMyShelter(res.data.data)
    setProfileError('')
  }, [])

  const fetchMyPickups = useCallback(async () => {
    const res = await api.get('/api/shelters/me/pickups')
    const all = res.data.data || []

    setIncomingPickups(all.filter(p => ['CLAIMED', 'IN_PROGRESS'].includes(p.status)))
    setDeliveredPickups(all.filter(p => p.status === 'DELIVERED'))
  }, [])

  const fetchShelterLeaderboard = useCallback(async () => {
    const res = await api.get('/api/shelters/leaderboard')
    setLeaderboard(res.data.data || [])
  }, [])

  const fetchAdminOverview = useCallback(async () => {
    const [sheltersRes, driversRes, pickupsRes, leaderboardRes] = await Promise.all([
      api.get('/api/shelters'),
      api.get('/api/drivers'),
      api.get('/api/pickups'),
      api.get('/api/shelters/leaderboard')
    ])

    const shelters = sheltersRes.data.data || []
    setAdminShelters(shelters)
    setAdminDrivers(driversRes.data.data || [])
    setAdminAllPickups(pickupsRes.data.data || [])
    setLeaderboard(leaderboardRes.data.data || [])

    if (!selectedShelterId && shelters.length > 0) {
      setSelectedShelterId(shelters[0].id)
    }

    setProfileError('')
  }, [selectedShelterId])

  useEffect(() => {
    if (user?.role && user.role !== 'SHELTER' && user.role !== 'ADMIN') {
      navigate('/login', { replace: true })
      return
    }

    const load = async () => {
      if (isAdminView) {
        await fetchAdminOverview()
      } else {
        await Promise.all([
          fetchMyProfile(),
          fetchMyPickups(),
          fetchShelterLeaderboard()
        ])
      }
    }

    load().catch(error => {
      const status = error?.response?.status
      if (status === 401 || status === 403 || status === 404) {
        setProfileError('Session mismatch detected. Please login again with a valid account.')
        logout()
        navigate('/login', { replace: true })
        return
      }
      console.error(error)
    })
  }, [
    user?.role,
    isAdminView,
    navigate,
    logout,
    fetchMyProfile,
    fetchMyPickups,
    fetchShelterLeaderboard,
    fetchAdminOverview
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      if (isAdminView) {
        fetchAdminOverview().catch(console.error)
      } else {
        fetchMyPickups().catch(console.error)
        fetchShelterLeaderboard().catch(console.error)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [isAdminView, fetchAdminOverview, fetchMyPickups, fetchShelterLeaderboard])

  const activeShelter = useMemo(() => {
    if (isAdminView) {
      return adminShelters.find(shelter => shelter.id === selectedShelterId) || null
    }
    return myShelter
  }, [isAdminView, adminShelters, selectedShelterId, myShelter])

  const activeIncomingPickups = useMemo(() => {
    if (!activeShelter) return []
    if (!isAdminView) return incomingPickups

    return adminAllPickups.filter(pickup => {
      return pickup.shelterId === activeShelter.id && ['CLAIMED', 'IN_PROGRESS'].includes(pickup.status)
    })
  }, [isAdminView, activeShelter, incomingPickups, adminAllPickups])

  const activeDeliveredPickups = useMemo(() => {
    if (!activeShelter) return []
    if (!isAdminView) return deliveredPickups

    return adminAllPickups.filter(pickup => {
      return pickup.shelterId === activeShelter.id && pickup.status === 'DELIVERED'
    })
  }, [isAdminView, activeShelter, deliveredPickups, adminAllPickups])

  useEffect(() => {
    const tickId = setInterval(() => {
      setClockTick(Date.now())
    }, 1000)

    return () => clearInterval(tickId)
  }, [])

  useEffect(() => {
    if (!events || events.length === 0 || !activeShelter) return

    const latestEvent = events[0]
    if (!latestEvent || latestEvent.id === lastHandledEventIdRef.current) return
    lastHandledEventIdRef.current = latestEvent.id

    const eventData = latestEvent.data || {}

    if (latestEvent.event === 'driver:location:update' && eventData.driverId) {
      setDriverHeartbeatAt(prev => ({
        ...prev,
        [eventData.driverId]: Date.now()
      }))

      setAdminDrivers(prev => prev.map(driver => {
        if (driver.id !== eventData.driverId) return driver
        return {
          ...driver,
          currentLat: eventData.lat,
          currentLng: eventData.lng,
          isAvailable: eventData.isAvailable
        }
      }))

      setAdminAllPickups(prev => prev.map(pickup => {
        if (pickup.driverId !== eventData.driverId || !pickup.driver) return pickup
        return {
          ...pickup,
          driver: {
            ...pickup.driver,
            currentLat: eventData.lat,
            currentLng: eventData.lng,
            isAvailable: eventData.isAvailable
          }
        }
      }))

      setIncomingPickups(prev => prev.map(pickup => {
        if (pickup.driverId !== eventData.driverId || !pickup.driver) return pickup
        return {
          ...pickup,
          driver: {
            ...pickup.driver,
            currentLat: eventData.lat,
            currentLng: eventData.lng,
            isAvailable: eventData.isAvailable
          }
        }
      }))

      return
    }

    const forCurrentShelter = isAdminView || eventData.shelterId === activeShelter.id

    if (latestEvent.event === 'shelter:assigned' && forCurrentShelter) {
      const text = `New pickup assigned: ${eventData.donorName || 'Restaurant'} • Driver ${eventData.driverName || 'Unknown'}`
      setAlerts(prev => [{ id: latestEvent.id, type: 'success', text }, ...prev].slice(0, 8))
      setMsg('✅ New food assignment received')
    }

    if (latestEvent.event === 'noshow:detected' && forCurrentShelter) {
      const text = `Driver no-show: ${eventData.driverName || 'Unknown'}${eventData.driverPhone ? ` (${eventData.driverPhone})` : ''}`
      setAlerts(prev => [{ id: latestEvent.id, type: 'danger', text }, ...prev].slice(0, 8))
      setMsg('⚠️ Driver could not arrive. Backup process started.')
    }

    if (latestEvent.event === 'noshow:backup_driver' && forCurrentShelter) {
      const text = `Backup driver assigned: ${eventData.backupDriver?.name || 'Unknown'}${eventData.backupDriver?.phone ? ` (${eventData.backupDriver.phone})` : ''}`
      setAlerts(prev => [{ id: latestEvent.id, type: 'info', text }, ...prev].slice(0, 8))
      setMsg('ℹ️ Backup driver notified for pending food')
    }

    if (latestEvent.event === 'otp:delivery_verified' && forCurrentShelter) {
      setMsg('✅ Driver verified delivery OTP. Handover can be completed.')
    }

    if (latestEvent.event === 'pickup:delivered' && forCurrentShelter) {
      setMsg('🎉 Delivery completed successfully')
    }

    if (latestEvent.event === 'shelter:driver_reported' && forCurrentShelter) {
      setMsg('📝 Driver issue report submitted')
    }

    if (isAdminView) {
      fetchAdminOverview().catch(console.error)
    } else {
      fetchMyPickups().catch(console.error)
      fetchShelterLeaderboard().catch(console.error)
    }
  }, [
    events,
    activeShelter,
    isAdminView,
    fetchAdminOverview,
    fetchMyPickups,
    fetchShelterLeaderboard
  ])

  const handleAccepting = async () => {
    if (!activeShelter) return
    try {
      const res = await api.put(`/api/shelters/${activeShelter.id}/accepting`, {
        isAccepting: !activeShelter.isAccepting
      })

      if (isAdminView) {
        setAdminShelters(prev => prev.map(shelter => {
          return shelter.id === res.data.data.id ? res.data.data : shelter
        }))
      } else {
        setMyShelter(res.data.data)
      }

      setMsg(res.data.data.isAccepting ? '✅ Now accepting donations' : '❌ Temporarily not accepting donations')
    } catch (error) {
      console.error(error)
      setMsg('❌ Failed to update accepting status')
    }
  }

  const handleGenerateDeliveryOtp = async (pickupId) => {
    try {
      const res = await api.post(`/api/pickups/${pickupId}/generate-delivery-otp`)
      const payload = res.data?.data || res.data || {}
      const dashboardOtp = payload.dashboardOtp || ''
      const smsMode = payload.smsMode || 'none'
      const shelterNotified = Boolean(payload.shelterNotified)

      setDeliveryOtpByPickup(prev => ({
        ...prev,
        [pickupId]: {
          dashboardOtp,
          smsMode,
          shelterNotified,
          generatedAt: Date.now()
        }
      }))

      // Ensure OTP is visible immediately in the active card even before next polling refresh.
      setIncomingPickups(prev => prev.map(pickup => {
        if (pickup.id !== pickupId) return pickup
        const routeData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
          ? pickup.routeData
          : {}

        return {
          ...pickup,
          routeData: {
            ...routeData,
            shelterDeliveryOtpCode: dashboardOtp || routeData.shelterDeliveryOtpCode || null
          }
        }
      }))

      setAdminAllPickups(prev => prev.map(pickup => {
        if (pickup.id !== pickupId) return pickup
        const routeData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
          ? pickup.routeData
          : {}

        return {
          ...pickup,
          routeData: {
            ...routeData,
            shelterDeliveryOtpCode: dashboardOtp || routeData.shelterDeliveryOtpCode || null
          }
        }
      }))

      setMsg(dashboardOtp ? '🔑 Delivery OTP generated and shown on shelter dashboard.' : '⚠️ OTP generated but code not returned. Retry once.')
    } catch (error) {
      setMsg(`❌ ${error.response?.data?.message || 'Failed to generate delivery OTP'}`)
    }
  }

  const toggleReportForm = (pickupId) => {
    setReportForms(prev => ({
      ...prev,
      [pickupId]: prev[pickupId]
        ? null
        : { reason: '', details: '' }
    }))
  }

  const updateReportField = (pickupId, field, value) => {
    setReportForms(prev => ({
      ...prev,
      [pickupId]: {
        ...(prev[pickupId] || { reason: '', details: '' }),
        [field]: value
      }
    }))
  }

  const submitDriverReport = async (pickupId) => {
    const report = reportForms[pickupId]
    if (!report?.reason?.trim()) {
      setMsg('❌ Report reason is required')
      return
    }

    try {
      await api.post('/api/shelters/me/report-driver', {
        pickupId,
        reason: report.reason.trim(),
        details: String(report.details || '').trim()
      })
      setMsg('✅ Driver issue reported to system')
      setReportForms(prev => ({ ...prev, [pickupId]: null }))
    } catch (error) {
      setMsg(`❌ ${error.response?.data?.message || 'Could not submit driver report'}`)
    }
  }

  const totalKgIncoming = activeIncomingPickups.reduce((sum, pickup) => {
    return sum + Number(pickup.foodPosting?.quantityKg || 0)
  }, 0)

  const totalKgDelivered = activeDeliveredPickups.reduce((sum, pickup) => {
    return sum + Number(pickup.foodPosting?.quantityKg || 0)
  }, 0)

  const capacityUsed = useMemo(() => {
    if (!activeShelter) return 0
    const used = Number(activeShelter.currentCommittedKg || 0)
    const max = Number(activeShelter.maxCapacityKg || 1)
    return Math.round((used / max) * 100)
  }, [activeShelter])

  if (!activeShelter) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        {profileError ? (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 text-red-300 text-sm">
            {profileError}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center text-gray-400">
            {isAdminView ? 'No shelters found to preview.' : 'Loading authenticated shelter profile...'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🏠 Shelter Dashboard</h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-400">
            {isAdminView
              ? 'Admin preview mode: all shelters and drivers visible'
              : 'Shelter panel: incoming food, ETA, OTP handover and issue reporting'}
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

      {isAdminView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <label className="text-gray-400 text-sm mb-2 block">Select Shelter</label>
            <select
              value={selectedShelterId}
              onChange={e => setSelectedShelterId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            >
              {adminShelters.map(shelter => (
                <option key={shelter.id} value={shelter.id}>
                  {shelter.name} ({shelter.contactPhone})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-2">All Drivers ({adminDrivers.length})</h3>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {adminDrivers.map(driver => (
                <div key={driver.id} className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1 flex items-center justify-between">
                  <span>{driver.name} ({driver.phone})</span>
                  <span className={driver.isAvailable ? 'text-green-400' : 'text-gray-500'}>
                    {driver.isAvailable ? 'Available' : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className="mb-4 bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg px-4 py-3 text-blue-300 text-sm">
          {msg}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`rounded-lg px-4 py-2 text-sm border ${
                alert.type === 'danger'
                  ? 'bg-red-500 bg-opacity-10 border-red-500 text-red-300'
                  : alert.type === 'success'
                    ? 'bg-green-500 bg-opacity-10 border-green-500 text-green-300'
                    : 'bg-yellow-500 bg-opacity-10 border-yellow-500 text-yellow-200'
              }`}
            >
              {alert.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">{isAdminView ? '🏠 Selected Shelter' : '🏠 My Shelter'}</h2>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏠</div>
            <h3 className="text-xl font-bold text-white">{activeShelter.name}</h3>
            <p className="text-gray-400 text-sm">{activeShelter.address}</p>
            <p className="text-gray-500 text-xs mt-1">{activeShelter.contactPhone}</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Capacity Used</span>
              <span className="text-white font-bold">{activeShelter.currentCommittedKg}kg / {activeShelter.maxCapacityKg}kg</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  capacityUsed > 80 ? 'bg-red-500' :
                  capacityUsed > 50 ? 'bg-yellow-500' :
                  'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, capacityUsed)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">{capacityUsed}% full</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">⏰ Accepting Window</h3>
            <p className="text-white font-medium">{activeShelter.acceptingFrom} — {activeShelter.acceptingTill}</p>
          </div>

          <button
            onClick={handleAccepting}
            className={`w-full py-3 rounded-xl font-bold transition-all ${
              activeShelter.isAccepting
                ? 'bg-green-500 text-black'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {activeShelter.isAccepting
              ? '✅ Accepting — Click to Pause'
              : '❌ Paused — Click to Resume'}
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 lg:col-span-2">
          <h2 className="text-lg font-bold text-green-400 mb-2">🚗 Incoming Food For This Shelter</h2>
          <p className="text-gray-500 text-sm mb-4">Total incoming: {totalKgIncoming}kg (~{Math.round(totalKgIncoming * 2.5)} meals)</p>

          {activeIncomingPickups.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <div className="text-5xl mb-3">🕐</div>
              <p>No active incoming deliveries</p>
              <p className="text-sm mt-2">{isAdminView ? 'Admin can switch shelter to inspect others.' : 'You will get a live alert when food is assigned to your shelter.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1">
              {activeIncomingPickups.map(pickup => {
                const eta = estimateEtaMinutes(
                  pickup.driver?.currentLat,
                  pickup.driver?.currentLng,
                  activeShelter.lat,
                  activeShelter.lng
                )
                const lastSeenMs = pickup.driver?.id ? driverHeartbeatAt[pickup.driver.id] : null
                const secondsAgo = lastSeenMs ? Math.max(0, Math.floor((clockTick - lastSeenMs) / 1000)) : null
                const remainingMinutes = eta
                  ? Math.max(1, eta.etaMinutes - Math.floor((secondsAgo || 0) / 60))
                  : null

                const deliveryOtpMeta = deliveryOtpByPickup[pickup.id]
                const routeData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
                  ? pickup.routeData
                  : {}
                const deliveryOtpVerified = Boolean(routeData.deliveryOtpVerifiedAt)
                const deliveryPhotoUploaded = Boolean(routeData.deliveryPhotoUrl)
                const restaurantPhotoVerified = Boolean(routeData.deliveryPhotoVerifiedAt)

                let deliveryBlockReason = null
                if (pickup.status === 'IN_PROGRESS') {
                  if (!deliveryOtpVerified) {
                    deliveryBlockReason = 'Waiting for driver to verify shelter OTP'
                  } else if (!deliveryPhotoUploaded) {
                    deliveryBlockReason = 'Waiting for driver to upload delivery photo'
                  } else if (!restaurantPhotoVerified) {
                    deliveryBlockReason = 'Waiting for restaurant to verify delivery photo'
                  }
                }

                const visibleShelterOtp = routeData.shelterDeliveryOtpCode || deliveryOtpMeta?.dashboardOtp || ''
                const report = reportForms[pickup.id]

                return (
                  <div key={pickup.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-medium text-sm">{pickup.foodPosting?.donor?.name}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        pickup.status === 'IN_PROGRESS'
                          ? 'bg-blue-500 text-white'
                          : 'bg-yellow-500 text-black'
                      }`}>
                        {pickup.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-gray-300">
                      <div className="flex justify-between"><span>Driver</span><span>{pickup.driver?.name || 'TBD'}</span></div>
                      <div className="flex justify-between"><span>Driver Phone</span><span>{pickup.driver?.phone || 'N/A'}</span></div>
                      <div className="flex justify-between"><span>Live Location</span><span>{getDriverLocationLabel(pickup, activeShelter.name)}</span></div>
                      <div className="flex justify-between"><span>Food</span><span>{pickup.foodPosting?.quantityKg}kg • {pickup.foodPosting?.isVeg ? 'VEG' : 'NON-VEG'}</span></div>
                      <div className="flex justify-between">
                        <span>ETA</span>
                        <span className="text-green-400">
                          {eta ? `~${remainingMinutes} min left (${eta.distanceKm} km)` : 'Waiting for driver live location'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Live Ping</span>
                        <span className="text-blue-300">{secondsAgo !== null ? `${secondsAgo}s ago` : 'Pending'}</span>
                      </div>
                    </div>

                    {pickup.status === 'IN_PROGRESS' && (
                      <div className="mt-3">
                        {deliveryBlockReason ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-500 bg-opacity-20 border border-yellow-500 border-opacity-40 px-3 py-1 text-[11px] font-semibold text-yellow-300">
                            ⏳ {deliveryBlockReason}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-500 bg-opacity-20 border border-green-500 border-opacity-40 px-3 py-1 text-[11px] font-semibold text-green-300">
                            ✅ All delivery checks complete, driver can mark delivered
                          </span>
                        )}
                      </div>
                    )}

                    {pickup.driver?.phone && (
                      <a
                        href={`tel:${pickup.driver.phone}`}
                        className="inline-flex mt-3 items-center gap-2 text-xs bg-blue-500 bg-opacity-20 text-blue-300 px-3 py-1.5 rounded-full border border-blue-500 border-opacity-40"
                      >
                        📞 Call Driver
                      </a>
                    )}

                    {['CLAIMED', 'IN_PROGRESS'].includes(pickup.status) && (
                      <div className="mt-3 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl p-3">
                        <p className="text-yellow-300 text-xs font-bold mb-2">🔐 Delivery OTP (Shelter to Driver)</p>
                        {!isAdminView ? (
                          <button
                            onClick={() => handleGenerateDeliveryOtp(pickup.id)}
                            className="w-full bg-yellow-500 text-black font-bold py-2 rounded-lg text-sm"
                          >
                            Generate Delivery OTP
                          </button>
                        ) : (
                          <p className="text-gray-300 text-xs">Admin preview is read-only. OTP can be generated by shelter account.</p>
                        )}
                        <p className="text-gray-400 text-xs mt-2">Generate OTP anytime after assignment. Driver must verify before marking delivery complete.</p>
                        <p className="text-gray-500 text-xs">OTP delivery mode: dashboard</p>
                        {visibleShelterOtp && (
                          <div className="mt-2 bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg px-3 py-2">
                            <p className="text-yellow-300 text-xs">Delivery OTP (share with assigned driver):</p>
                            <p className="text-yellow-400 font-bold tracking-widest">{visibleShelterOtp}</p>
                          </div>
                        )}
                        {!visibleShelterOtp && (
                          <p className="text-yellow-300 text-xs mt-2">OTP not generated yet for this pickup.</p>
                        )}
                      </div>
                    )}

                    {!isAdminView && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleReportForm(pickup.id)}
                          className="w-full bg-red-500 bg-opacity-15 border border-red-500 text-red-300 font-bold py-2 rounded-lg text-sm"
                        >
                          ⚠️ Report Driver Issue
                        </button>

                        {report && (
                          <div className="mt-2 bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                            <input
                              type="text"
                              value={report.reason}
                              onChange={e => updateReportField(pickup.id, 'reason', e.target.value)}
                              placeholder="Reason (required)"
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                            />
                            <textarea
                              value={report.details}
                              onChange={e => updateReportField(pickup.id, 'details', e.target.value)}
                              placeholder="Optional details"
                              rows={2}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                            />
                            <button
                              onClick={() => submitDriverReport(pickup.id)}
                              className="w-full bg-red-500 text-white font-bold py-2 rounded-lg text-sm"
                            >
                              Submit Report
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">📊 Shelter Stats</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-sm">Food Received</span>
              <span className="text-white font-bold">{totalKgDelivered}kg</span>
            </div>
            <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-sm">Meals Served</span>
              <span className="text-green-400 font-bold">~{Math.round(totalKgDelivered * 2.5)}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-sm">Deliveries Done</span>
              <span className="text-blue-400 font-bold">{activeDeliveredPickups.length}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
              <span className="text-gray-400 text-sm">Incoming</span>
              <span className="text-yellow-400 font-bold">{activeIncomingPickups.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 lg:col-span-2">
          <h2 className="text-lg font-bold text-green-400 mb-4">✅ Delivery History</h2>
          {activeDeliveredPickups.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No completed deliveries yet</div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {activeDeliveredPickups.map(pickup => (
                <div key={pickup.id} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{pickup.foodPosting?.donor?.name}</p>
                    <p className="text-gray-400 text-xs">{pickup.foodPosting?.quantityKg}kg • Driver: {pickup.driver?.name || 'N/A'} ({pickup.driver?.phone || 'N/A'})</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-sm font-bold">~{Math.round((pickup.foodPosting?.quantityKg || 0) * 2.5)} meals</p>
                    <p className="text-gray-500 text-xs">{pickup.deliveredAt ? new Date(pickup.deliveredAt).toLocaleTimeString() : '-'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-bold text-green-400 mb-4">🏆 Shelter Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map(entry => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                entry.id === activeShelter.id
                  ? 'bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30'
                  : 'bg-gray-800'
              }`}
            >
              <span className="text-lg w-8 text-center">
                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
              </span>
              <span className={`flex-1 text-sm font-medium ${entry.id === activeShelter.id ? 'text-green-400' : 'text-white'}`}>
                {entry.name} {entry.id === activeShelter.id ? '(Selected)' : ''}
              </span>
              <span className="text-blue-400 text-xs">{entry.totalDeliveries} deliveries</span>
              <span className="text-green-400 text-sm font-bold">{entry.totalKgReceived}kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
