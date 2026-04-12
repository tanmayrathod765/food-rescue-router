import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import Achievements from '../components/Achievements'
import BadgeNotification from '../components/BadgeNotification'
export default function DriverDashboard() {
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [pickups, setPickups] = useState([])
  const [myPickup, setMyPickup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const { connected, events } = useSocket()
  useAuth()
  
  // Drivers fetch karo
  useEffect(() => {
    api.get('/api/drivers')
      .then(res => {
        setDrivers(res.data.data)
        if (res.data.data.length > 0) {
          setSelectedDriver(res.data.data[0])
        }
      })
      .catch(console.error)
  }, [])

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

  const handleDriverChange = (driver) => {
    setSelectedDriver(driver)
    const myActive = pickups.find(p =>
      p.driverId === driver.id &&
      ['CLAIMED', 'IN_PROGRESS'].includes(p.status)
    )
    setMyPickup(myActive || null)
  }

  const handleAvailability = async () => {
    if (!selectedDriver) return
    try {
      const res = await api.put(
        `/api/drivers/${selectedDriver.id}/availability`,
        { isAvailable: !selectedDriver.isAvailable }
      )
      setSelectedDriver(res.data.data)
      setDrivers(prev =>
        prev.map(d => d.id === res.data.data.id ? res.data.data : d)
      )
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

  const handleDelivered = async () => {
    if (!myPickup) return
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

      {/* Driver Selector */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-6">
        <label className="text-gray-400 text-sm mb-2 block">
          Select Driver
        </label>
        <div className="flex flex-wrap gap-3">
          {drivers.map(d => (
            <button
              key={d.id}
              onClick={() => handleDriverChange(d)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedDriver?.id === d.id
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {d.vehicleType === 'BIKE' ? '🚲' :
               d.vehicleType === 'CAR' ? '🚗' :
               d.vehicleType === 'VAN' ? '🚐' : '🚛'} {d.name}
            </button>
          ))}
        </div>
      </div>

      {selectedDriver && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Driver Profile */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-green-400 mb-4">
              👤 Profile
            </h2>

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">
                {selectedDriver.vehicleType === 'BIKE' ? '🚲' :
                 selectedDriver.vehicleType === 'CAR' ? '🚗' :
                 selectedDriver.vehicleType === 'VAN' ? '🚐' : '🚛'}
              </div>
              <h3 className="text-xl font-bold text-white">
                {selectedDriver.name}
              </h3>
              <p className="text-gray-400 text-sm">
                {selectedDriver.vehicleType} •{' '}
                {selectedDriver.capacityKg}kg capacity
              </p>
            </div>

            {/* Trust Score */}
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

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {selectedDriver.totalDeliveries}
                </div>
                <div className="text-gray-400 text-xs">Deliveries</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {selectedDriver.totalKgRescued}kg
                </div>
                <div className="text-gray-400 text-xs">Rescued</div>
              </div>
            </div>

            {/* Meals Impact */}
            <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-3 text-center mb-4">
              <div className="text-2xl font-bold text-green-400">
                ~{Math.round(selectedDriver.totalKgRescued * 2.5)}
              </div>
              <div className="text-green-400 text-xs">Meals Provided 🍽️</div>
            </div>

            {/* Availability Toggle */}
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

          {/* Active Pickup */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-green-400 mb-4">
              📍 Active Pickup
            </h2>

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
                      myPickup.status === 'CLAIMED'
                        ? 'bg-yellow-400'
                        : 'bg-blue-400'
                    } animate-pulse`} />
                    <span className="font-bold text-white">
                      {myPickup.status === 'CLAIMED'
                        ? 'Heading to Pickup'
                        : 'Food Collected — Delivering'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>🏪</span>
                      <span>{myPickup.foodPosting?.donor?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>⚖️</span>
                      <span>{myPickup.foodPosting?.quantityKg}kg food</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>🍽️</span>
                      <span>
                        ~{Math.round(
                          myPickup.foodPosting?.quantityKg * 2.5
                        )} meals
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>⏰</span>
                      <span>
                        Closes:{' '}
                        {new Date(
                          myPickup.foodPosting?.closingTime
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                    {myPickup.shelter && (
                      <div className="flex items-center gap-2 text-purple-400">
                        <span>🏠</span>
                        <span>
                          Deliver to: {myPickup.shelter?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Route Steps */}
                <div className="bg-gray-800 rounded-xl p-4 mb-4">
                  <h3 className="text-sm font-bold text-gray-400 mb-3">
                    📍 Route
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <span className="text-sm text-white">
                        {myPickup.foodPosting?.donor?.name}
                      </span>
                      <span className="text-xs text-yellow-400 ml-auto">
                        PICKUP
                      </span>
                    </div>
                    <div className="ml-3 border-l-2 border-gray-600 h-4" />
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <span className="text-sm text-white">
                        {myPickup.shelter?.name || 'Shelter (TBD)'}
                      </span>
                      <span className="text-xs text-green-400 ml-auto">
                        DELIVER
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {myPickup.status === 'CLAIMED' && (
                    <button
                      onClick={handlePickedUp}
                      className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 rounded-xl transition-all"
                    >
                      📦 Mark as Picked Up
                    </button>
                  )}
                  {myPickup.status === 'IN_PROGRESS' && (
                    <button
                      onClick={handleDelivered}
                      className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-all"
                    >
                      ✅ Mark as Delivered
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">🚗</div>
                <p>No active pickup</p>
                <p className="text-sm mt-2">
                  Claim a pickup from the list →
                </p>
              </div>
            )}
          </div>

          {/* Available Pickups */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-green-400 mb-4">
              📋 Available Pickups
              <span className="ml-2 text-sm bg-yellow-500 text-black px-2 py-0.5 rounded-full">
                {pickups.length}
              </span>
            </h2>

            {pickups.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">✨</div>
                <p>No pickups available</p>
                <p className="text-sm mt-2">
                  All food has been claimed!
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {pickups.map(pickup => (
                  <div
                    key={pickup.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-white text-sm">
                          {pickup.foodPosting?.donor?.name}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {pickup.foodPosting?.foodType?.replace('_', ' ')}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${
                        pickup.foodPosting?.isVeg
                          ? 'bg-green-600'
                          : 'bg-red-600'
                      }`}>
                        {pickup.foodPosting?.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 mb-3">
                      <span>⚖️ {pickup.foodPosting?.quantityKg}kg</span>
                      <span>
                        ⏰{' '}
                        {new Date(
                          pickup.foodPosting?.closingTime
                        ).toLocaleTimeString()}
                      </span>
                      <span>
                        🍽️ ~{Math.round(
                          pickup.foodPosting?.quantityKg * 2.5
                        )} meals
                      </span>
                    </div>

                    <button
                      onClick={() => handleClaim(pickup)}
                      disabled={
                        loading ||
                        !selectedDriver.isAvailable ||
                        selectedDriver.capacityKg <
                          pickup.foodPosting?.quantityKg
                      }
                      className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2 rounded-lg transition-all text-sm"
                    >
                      {!selectedDriver.isAvailable
                        ? '❌ Go Online First'
                        : selectedDriver.capacityKg <
                            pickup.foodPosting?.quantityKg
                        ? '❌ Insufficient Capacity'
                        : loading
                        ? '⏳ Claiming...'
                        : '🚀 Claim Pickup'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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