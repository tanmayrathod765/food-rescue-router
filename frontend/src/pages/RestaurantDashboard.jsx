import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../hooks/useSocket'
import FoodPassport from '../components/FoodPassport'
import FoodSafetyBadge from '../components/FoodSafetyBadge'
import ETADisplay from '../components/ETADisplay'

function getStatusColor(status) {
  const colors = {
    AVAILABLE: 'bg-yellow-500',
    MATCHED: 'bg-blue-500',
    PICKED_UP: 'bg-purple-500',
    DELIVERED: 'bg-green-500',
    EXPIRED: 'bg-red-500'
  }
  return colors[status] || 'bg-gray-500'
}

function getStatusEmoji(status) {
  const emojis = {
    AVAILABLE: '⏳',
    MATCHED: '🚗',
    PICKED_UP: '📦',
    DELIVERED: '✅',
    EXPIRED: '❌'
  }
  return emojis[status] || '❓'
}

function formatDateTimeLocalNow() {
  const now = new Date()
  now.setSeconds(0, 0)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getScoreTone(score) {
  if (score >= 85) {
    return {
      barClass: 'bg-green-500',
      textClass: 'text-green-300'
    }
  }
  if (score >= 60) {
    return {
      barClass: 'bg-yellow-500',
      textClass: 'text-yellow-300'
    }
  }
  return {
    barClass: 'bg-red-500',
    textClass: 'text-red-300'
  }
}

export default function RestaurantDashboard() {
  const { user, logout } = useAuth()
  const { events } = useSocket(user)
  const navigate = useNavigate()
  const isAdminView = user?.role === 'ADMIN'

  const [myProfile, setMyProfile] = useState(null)
  const [adminDonors, setAdminDonors] = useState([])
  const [selectedDonorId, setSelectedDonorId] = useState('')
  const [myImpact, setMyImpact] = useState(null)
  const [myBadges, setMyBadges] = useState([])
  const [donorLeaderboard, setDonorLeaderboard] = useState([])
  const [deliveryPhotos, setDeliveryPhotos] = useState({})
  const [minClosingTime, setMinClosingTime] = useState(formatDateTimeLocalNow())
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [safetyPreview, setSafetyPreview] = useState(null)
  const [profileError, setProfileError] = useState('')

  const [form, setForm] = useState({
    foodType: 'HOT_MEAL',
    isVeg: true,
    quantityKg: '',
    description: '',
    closingTime: '',
    timeSinceCooked: '0',
    isRefrigerated: false
  })

  const fetchMyProfile = useCallback(async () => {
    if (user?.role !== 'RESTAURANT') {
      return
    }

    const res = await api.get('/api/donors/me')
    setProfileError('')
    setMyProfile(res.data.data)
  }, [user?.role])

  const handleProfileError = useCallback((error) => {
    const status = error?.response?.status

    if (status === 401 || status === 403 || status === 404) {
      setProfileError('Session mismatch detected. Please login again with a restaurant account.')
      logout()
      navigate('/login', { replace: true })
      return
    }

    console.error(error)
  }, [logout, navigate])

  const fetchAdminDonors = useCallback(async () => {
    if (!isAdminView) return

    const res = await api.get('/api/donors')
    const donors = res.data.data || []
    setAdminDonors(donors)

    if (!selectedDonorId && donors.length > 0) {
      setSelectedDonorId(donors[0].id)
    }
  }, [isAdminView, selectedDonorId])

  const fetchAdminSelectedDonor = useCallback(async () => {
    if (!isAdminView || !selectedDonorId) return

    const donorMeta = adminDonors.find(d => d.id === selectedDonorId)
    const postingsRes = await api.get(`/api/donors/${selectedDonorId}/postings`)

    setMyProfile({
      ...(donorMeta || {}),
      foodPostings: postingsRes.data.data || []
    })
    setProfileError('')
  }, [isAdminView, selectedDonorId, adminDonors])

  const fetchDeliveryPhoto = useCallback(async (pickupId) => {
    try {
      const res = await api.get(`/api/pickups/${pickupId}/delivery-photo`)
      if (res.data.photoUrl) {
        setDeliveryPhotos(prev => ({
          ...prev,
          [pickupId]: {
            url: `${api.defaults.baseURL}${res.data.photoUrl}`,
            verifiedAt: res.data.verifiedAt || null,
            verifiedByDonorId: res.data.verifiedByDonorId || null
          }
        }))
      }
    } catch {
      // Ignore missing photo and keep waiting state.
    }
  }, [])

  const verifyDeliveryPhoto = useCallback(async (pickupId) => {
    try {
      await api.post(`/api/pickups/${pickupId}/verify-delivery-photo`)
      await fetchDeliveryPhoto(pickupId)
      if (isAdminView) {
        await fetchAdminSelectedDonor()
      } else {
        await fetchMyProfile()
      }
      setSuccessMsg('Delivery photo verified. Driver can now complete delivery.')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (error) {
      alert(error?.response?.data?.message || 'Could not verify delivery photo')
    }
  }, [fetchAdminSelectedDonor, fetchDeliveryPhoto, fetchMyProfile, isAdminView])

  useEffect(() => {
    if (isAdminView) {
      fetchAdminDonors().catch(console.error)
      return
    }

    fetchMyProfile().catch(handleProfileError)
  }, [fetchMyProfile, handleProfileError, isAdminView, fetchAdminDonors])

  useEffect(() => {
    if (!isAdminView) return
    fetchAdminSelectedDonor().catch(console.error)
  }, [isAdminView, fetchAdminSelectedDonor])

  useEffect(() => {
    if (isAdminView) {
      const interval = setInterval(() => {
        fetchAdminDonors().catch(console.error)
        fetchAdminSelectedDonor().catch(console.error)
      }, 30000)
      return () => clearInterval(interval)
    }

    if (user?.role !== 'RESTAURANT') return

    const interval = setInterval(() => {
      fetchMyProfile().catch(handleProfileError)
    }, 30000)
    return () => clearInterval(interval)
  }, [
    fetchMyProfile,
    handleProfileError,
    user?.role,
    isAdminView,
    fetchAdminDonors,
    fetchAdminSelectedDonor
  ])

  useEffect(() => {
    const targetDonorId = isAdminView ? selectedDonorId : user?.entityId
    if (!targetDonorId) return

    api.get(`/api/donors/${targetDonorId}/impact`)
      .then(res => setMyImpact(res.data.data))
      .catch(console.error)
  }, [user, isAdminView, selectedDonorId])

  useEffect(() => {
    if (!user?.entityId || isAdminView) return
    api.get(`/api/gamification/badges/${user.entityId}`)
      .then(res => setMyBadges(res.data.data || []))
      .catch(console.error)
  }, [user, isAdminView])

  useEffect(() => {
    api.get('/api/gamification/leaderboard/donors')
      .then(res => setDonorLeaderboard(res.data.data || []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!form.quantityKg || !form.closingTime) {
      setSafetyPreview(null)
      return
    }

    const timeSinceCookedMinutes = (parseFloat(form.timeSinceCooked) || 0) * 60
    api.post('/api/donors/safety-score', {
      foodType: form.foodType,
      timeSinceCooked: timeSinceCookedMinutes,
      isRefrigerated: form.isRefrigerated,
      closingTime: form.closingTime,
      quantityKg: parseFloat(form.quantityKg) || 0
    })
      .then(res => setSafetyPreview(res.data.data))
      .catch(() => setSafetyPreview(null))
  }, [form])

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMinClosingTime(formatDateTimeLocalNow())
    }, 30000)

    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const postings = myProfile?.foodPostings || []
    postings.forEach(posting => {
      if (posting.pickup?.id && posting.pickup?.routeData?.deliveryPhotoUrl) {
        fetchDeliveryPhoto(posting.pickup.id)
      }
    })
  }, [myProfile, fetchDeliveryPhoto])

  useEffect(() => {
    if (!events.length) return

    const photoEvent = events.find(e => e.event === 'delivery:photo_uploaded')
    if (photoEvent?.data?.pickupId) {
      fetchDeliveryPhoto(photoEvent.data.pickupId)
    }

    const refreshEvent = events.find(e => {
      return [
        'otp:generated',
        'otp:restaurant_notified',
        'otp:verified',
        'delivery:photo_uploaded',
        'delivery:photo_verified'
      ].includes(e.event)
    })
    if (refreshEvent) {
      if (isAdminView) {
        fetchAdminSelectedDonor().catch(console.error)
      } else {
        fetchMyProfile().catch(handleProfileError)
      }
    }
  }, [events, fetchDeliveryPhoto, fetchAdminSelectedDonor, fetchMyProfile, handleProfileError, isAdminView])

  const handleSubmit = async () => {
    if (!myProfile?.id || !form.quantityKg || !form.closingTime) {
      alert('Quantity and closing time are required')
      return
    }

    const closingTimestamp = new Date(form.closingTime).getTime()
    if (!Number.isFinite(closingTimestamp) || closingTimestamp <= Date.now()) {
      alert('Pickup deadline must be in the future')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/donors/food-posting', {
        donorId: myProfile.id,
        foodType: form.foodType,
        isVeg: form.isVeg,
        quantityKg: parseFloat(form.quantityKg),
        description: form.description,
        closingTime: form.closingTime,
        isRefrigerated: form.isRefrigerated,
        timeSinceCooked: (parseFloat(form.timeSinceCooked) || 0) * 60
      })

      await fetchMyProfile()
      setSuccessMsg('Food posted successfully! Matching in progress...')
      setForm({
        foodType: 'HOT_MEAL',
        isVeg: true,
        quantityKg: '',
        description: '',
        closingTime: '',
        timeSinceCooked: '0',
        isRefrigerated: false
      })
      setSafetyPreview(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      alert('Error posting food')
    }
    setLoading(false)
  }

  const postings = myProfile?.foodPostings || []

  if (user?.role && user.role !== 'RESTAURANT') {
    if (user.role === 'ADMIN') {
      // Admin can preview all restaurant data.
    } else {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-xl p-4 text-yellow-300">
          Restaurant dashboard is available for restaurant accounts only. Please login as a restaurant user.
        </div>
      </div>
    )
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">🏪 Restaurant Dashboard</h1>
        <p className="text-gray-400">
          {isAdminView
            ? 'Admin view: browse all restaurants and their live postings.'
            : 'Post surplus food, track driver progress, and verify delivery.'}
        </p>
        {profileError && (
          <p className="text-red-400 text-sm mt-2">{profileError}</p>
        )}
      </div>

      {isAdminView && (
        <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-6">
          <label className="text-gray-400 text-sm mb-2 block">Select Restaurant</label>
          <select
            value={selectedDonorId}
            onChange={e => setSelectedDonorId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
          >
            {adminDonors.map(donor => (
              <option key={donor.id} value={donor.id}>
                {donor.name} ({donor.email})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 bg-opacity-20 rounded-xl flex items-center justify-center text-2xl">🏪</div>
          <div>
            <h2 className="text-xl font-bold text-white">{myProfile?.name || 'Loading profile...'}</h2>
            <p className="text-gray-400 text-sm">
              {myProfile?.address || 'Fetching location...'}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Location name: {myProfile?.address || 'Location unavailable'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-3 py-1 rounded-full border border-green-500 border-opacity-30">
              {isAdminView ? '● Admin Preview Mode' : '● Restaurant Account'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{myImpact?.totalKgDonated || 0}kg</div>
          <div className="text-gray-400 text-xs">Total Donated</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">~{Math.round((myImpact?.totalKgDonated || 0) * 2.5)}</div>
          <div className="text-gray-400 text-xs">Meals Provided</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-purple-400">{myImpact?.totalDonations || 0}</div>
          <div className="text-gray-400 text-xs">Total Donations</div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-6">
        <h3 className="text-sm font-bold text-gray-400 mb-3">🏅 My Badges</h3>
        {myBadges.length === 0 ? (
          <p className="text-gray-600 text-sm">Make your first donation to earn badges!</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {myBadges.map(badge => (
              <div key={badge.id} className="flex-shrink-0 bg-gray-800 rounded-xl p-3 text-center w-24">
                <div className="text-2xl">{String(badge.badgeName || '').split(' ')[0]}</div>
                <div className="text-white text-xs mt-1">
                  {String(badge.badgeName || '').split(' ').slice(1).join(' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-green-400 mb-6">📦 Post Surplus Food</h2>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Food Type</label>
            <select
              value={form.foodType}
              onChange={e => setForm(prev => ({ ...prev, foodType: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            >
              <option value="HOT_MEAL">🍛 Hot Meal</option>
              <option value="BAKERY">🥐 Bakery</option>
              <option value="SEALED">📦 Sealed</option>
              <option value="RAW_PRODUCE">🥦 Raw Produce</option>
              <option value="BEVERAGES">🥤 Beverages</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Dietary Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm(prev => ({ ...prev, isVeg: true }))}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  form.isVeg ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                🟢 Vegetarian
              </button>
              <button
                onClick={() => setForm(prev => ({ ...prev, isVeg: false }))}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  !form.isVeg ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                🔴 Non-Veg
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Quantity (kg)</label>
            <input
              type="number"
              value={form.quantityKg}
              onChange={e => setForm(prev => ({ ...prev, quantityKg: e.target.value }))}
              placeholder="e.g. 20"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Closing Time (Pickup Deadline)</label>
            <input
              type="datetime-local"
              value={form.closingTime}
              onChange={e => setForm(prev => ({ ...prev, closingTime: e.target.value }))}
              min={minClosingTime}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Time Since Cooked (hours)</label>
            <input
              type="number"
              value={form.timeSinceCooked}
              onChange={e => setForm(prev => ({ ...prev, timeSinceCooked: e.target.value }))}
              placeholder="e.g. 2"
              min="0"
              max="24"
              step="0.5"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">Storage</label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm(prev => ({ ...prev, isRefrigerated: false }))}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  !form.isRefrigerated ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                🌡️ Room Temp
              </button>
              <button
                onClick={() => setForm(prev => ({ ...prev, isRefrigerated: true }))}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  form.isRefrigerated ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                ❄️ Refrigerated
              </button>
            </div>
          </div>

          {safetyPreview && (
            <div className="mb-4">
              <FoodSafetyBadge
                score={safetyPreview.score}
                label={safetyPreview.label}
                emoji={safetyPreview.emoji}
                recommendation={safetyPreview.recommendation}
              />
            </div>
          )}

          <div className="mb-6">
            <label className="text-gray-400 text-sm mb-2 block">Notes (optional)</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g. Contains nuts, handle carefully"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {successMsg && (
            <div className="mb-4 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg px-4 py-3 text-green-400">
              ✅ {successMsg}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !myProfile}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black font-bold py-4 rounded-xl transition-all text-lg"
          >
            {loading ? '⏳ Posting...' : '🚀 Post Food for Rescue'}
          </button>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-green-400 mb-6">📋 My Recent Postings</h2>

          {postings.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <div className="text-5xl mb-4">🍽️</div>
              <p>No postings yet</p>
              <p className="text-sm mt-2">Post your first food rescue!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[900px] overflow-y-auto pr-1">
              {postings.map(posting => {
                const minutesLeft = Math.round((new Date(posting.closingTime) - Date.now()) / 60000)

                return (
                  <div
                    key={posting.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {posting.foodType === 'HOT_MEAL' ? '🍛' : posting.foodType === 'BAKERY' ? '🥐' : posting.foodType === 'SEALED' ? '📦' : posting.foodType === 'RAW_PRODUCE' ? '🥦' : '🥤'}
                        </span>
                        <span className="font-medium text-white">{posting.foodType.replace('_', ' ')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${posting.isVeg ? 'bg-green-600' : 'bg-red-600'}`}>
                          {posting.isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full text-white ${getStatusColor(posting.status)}`}>
                        {getStatusEmoji(posting.status)} {posting.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-400">⚖️ {posting.quantityKg} kg</div>
                      <div className="text-gray-400">⏰ {new Date(posting.closingTime).toLocaleTimeString()}</div>
                    </div>

                    {minutesLeft < 30 && minutesLeft > 0 && (
                      <div className="text-red-400 text-xs mt-1 animate-pulse">⚠️ Expires in {minutesLeft} minutes!</div>
                    )}
                    {minutesLeft <= 0 && (
                      <div className="text-gray-500 text-xs mt-1">⏰ Expired</div>
                    )}

                    {posting.pickup?.driver && (
                      <div className="mt-3 bg-blue-500 bg-opacity-10 border border-blue-500 border-opacity-30 rounded-xl p-3">
                        <p className="text-blue-400 text-xs font-bold mb-2">🚗 DRIVER ASSIGNED</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Driver:</span>
                            <p className="text-white font-medium">{posting.pickup.driver.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Vehicle:</span>
                            <p className="text-white">{posting.pickup.driver.vehicleType}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Trust Score:</span>
                            <p className="text-green-400">{posting.pickup.driver.trustScore}/100</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Phone:</span>
                            <p className="text-white">{posting.pickup.driver.phone}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Live Location:</span>
                            <p className="text-white text-xs">
                              {getDriverLocationLabel(posting.pickup)}
                            </p>
                          </div>
                        </div>

                        {posting.pickup.driver.phone && (
                          <a
                            href={`tel:${posting.pickup.driver.phone}`}
                            className="inline-flex mt-3 items-center gap-2 text-xs bg-blue-500 bg-opacity-20 text-blue-300 px-3 py-1.5 rounded-full border border-blue-500 border-opacity-40"
                          >
                            📞 Call Driver
                          </a>
                        )}

                        <ETADisplay
                          driverLat={posting.pickup.driver.currentLat}
                          driverLng={posting.pickup.driver.currentLng}
                          donorLat={myProfile?.lat}
                          donorLng={myProfile?.lng}
                        />
                      </div>
                    )}

                    {posting.pickup?.shelter && (
                      <div className="mt-2 bg-purple-500 bg-opacity-10 border border-purple-500 border-opacity-30 rounded-xl p-3">
                        <p className="text-purple-400 text-xs font-bold mb-2">🏠 DELIVERY DESTINATION</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-400 text-xs">Shelter:</span>
                            <p className="text-white font-medium">{posting.pickup.shelter.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Address:</span>
                            <p className="text-white text-xs">{posting.pickup.shelter.address}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Location:</span>
                            <p className="text-white text-xs">
                              {posting.pickup.shelter.address || posting.pickup.shelter.name || 'Location unavailable'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Contact:</span>
                            <p className="text-white">{posting.pickup.shelter.contactName}</p>
                          </div>
                          <div>
                            <span className="text-gray-400 text-xs">Accepts Till:</span>
                            <p className="text-white">{posting.pickup.shelter.acceptingTill}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {posting.status === 'MATCHED' && posting.pickup?.id && (
                      <div className="mt-3 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl p-3">
                        <p className="text-yellow-400 text-xs font-bold mb-2">🔑 OTP FLOW</p>
                        {posting.pickup?.routeData?.restaurantOtpCode ? (
                          <>
                            <p className="text-gray-300 text-xs">Use this OTP to verify assigned driver pickup:</p>
                            <div className="mt-2 bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-lg px-3 py-2">
                              <p className="text-yellow-300 text-xs">Restaurant OTP:</p>
                              <p className="text-yellow-400 font-bold tracking-widest">{posting.pickup.routeData.restaurantOtpCode}</p>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">Share this OTP only after driver identity confirmation.</p>
                          </>
                        ) : posting.pickup?.routeData?.restaurantOtpVerifiedAt ? (
                          <p className="text-green-300 text-xs">✅ OTP verified. Pickup handoff completed.</p>
                        ) : (
                          <p className="text-gray-300 text-xs">Waiting for driver to generate OTP in app...</p>
                        )}
                      </div>
                    )}

                    {(posting.pickup?.status === 'IN_PROGRESS' || posting.status === 'DELIVERED' || posting.pickup?.routeData?.deliveryPhotoUrl) && posting.pickup?.id && (
                      <div className="mt-3">
                        {deliveryPhotos[posting.pickup.id]?.url ? (
                          <div>
                            <p className="text-gray-400 text-xs mb-2">📸 Delivery Proof:</p>
                            <img
                              src={deliveryPhotos[posting.pickup.id].url}
                              alt="Delivery proof"
                              className="w-full rounded-xl border border-gray-700 max-h-48 object-cover"
                            />
                            {deliveryPhotos[posting.pickup.id].verifiedAt ? (
                              <p className="text-green-400 text-xs mt-1">
                                ✅ Photo verified by restaurant
                              </p>
                            ) : (
                              <div className="mt-2">
                                {!isAdminView && (
                                  <button
                                    onClick={() => verifyDeliveryPhoto(posting.pickup.id)}
                                    className="w-full bg-green-500 bg-opacity-20 border border-green-500 text-green-300 font-bold py-2 rounded-lg text-sm"
                                  >
                                    Verify Delivery Photo
                                  </button>
                                )}
                                <p className="text-yellow-400 text-xs mt-1">
                                  ⏳ Driver can complete delivery only after your verification.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">📸 Waiting for delivery photo from driver...</p>
                        )}
                      </div>
                    )}

                    {(posting.safetyScore !== undefined || posting.urgencyScore !== undefined) && (
                      <div className="mt-3 bg-gray-900 rounded-xl border border-gray-700 p-3">
                        <p className="text-xs font-bold text-gray-300 mb-2">Safety and Urgency Breakdown</p>

                        {posting.safetyScore !== undefined && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-400">Safety Score</span>
                              <span className={`${getScoreTone(posting.safetyScore).textClass} font-bold`}>{posting.safetyScore}/100</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getScoreTone(posting.safetyScore).barClass}`}
                                style={{ width: `${Math.max(0, Math.min(100, posting.safetyScore))}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Safety formula: (Shelf-life remaining 60% + time till deadline 40%) x quantity factor (max 1.2x)
                            </p>
                          </div>
                        )}

                        {posting.urgencyScore !== undefined && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-400">Urgency Score</span>
                              <span className={`${getScoreTone(posting.urgencyScore).textClass} font-bold`}>{posting.urgencyScore}/100</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getScoreTone(posting.urgencyScore).barClass}`}
                                style={{ width: `${Math.max(0, Math.min(100, posting.urgencyScore))}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Urgency formula: (1000/minutes left) x food type weight x quantity factor (max 1.5x) x safety-risk boost.
                            </p>
                          </div>
                        )}

                        {posting.safetyScore !== undefined && (
                          <FoodSafetyBadge
                            score={posting.safetyScore}
                            label={posting.safetyScore >= 90 ? 'Safe' : posting.safetyScore >= 70 ? 'Consume Soon' : posting.safetyScore >= 50 ? 'Urgent' : 'Risk'}
                            emoji={posting.safetyScore >= 90 ? '✅' : posting.safetyScore >= 70 ? '⚠️' : posting.safetyScore >= 50 ? '🔶' : '❌'}
                            recommendation={posting.safetyScore >= 90 ? 'Food is fresh' : 'Deliver as soon as possible'}
                          />
                        )}
                      </div>
                    )}

                    <div className="mt-2">
                      <FoodPassport
                        foodPostingId={posting.id}
                        donorName={myProfile?.name}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h3 className="text-sm font-bold text-gray-400 mb-3">🏆 Donor Leaderboard</h3>
        <div className="space-y-2">
          {donorLeaderboard.map(donor => (
            <div
              key={donor.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                donor.id === user?.entityId
                  ? 'bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30'
                  : 'bg-gray-800'
              }`}
            >
              <span className="text-lg w-8 text-center">
                {donor.rank === 1 ? '🥇' : donor.rank === 2 ? '🥈' : donor.rank === 3 ? '🥉' : `#${donor.rank}`}
              </span>
              <span className={`flex-1 text-sm font-medium ${donor.id === user?.entityId ? 'text-green-400' : 'text-white'}`}>
                {donor.name} {donor.id === user?.entityId ? '(You)' : ''}
              </span>
              <span className="text-green-400 text-sm font-bold">{donor.totalKgDonated}kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function getDriverLocationLabel(pickup) {
  const hasLiveGps =
    Number.isFinite(Number(pickup?.driver?.currentLat)) &&
    Number.isFinite(Number(pickup?.driver?.currentLng))

  if (!hasLiveGps) {
    return 'Updating...'
  }

  if (pickup?.status === 'IN_PROGRESS') {
    return `Near ${pickup?.shelter?.name || 'delivery route'}`
  }

  return `Near ${pickup?.foodPosting?.donor?.name || 'restaurant pickup point'}`
}