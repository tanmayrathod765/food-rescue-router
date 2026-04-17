import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../utils/api'
import { useSocket } from '../hooks/useSocket'
import { useAuth } from '../context/AuthContext'
import LiveMap from '../components/Map/LiveMap'
import StatsBar from '../components/StatsBar'
import AlgorithmPanel from '../components/AlgorithmPanel'
import SimulationControl from '../components/SimulationControl'
import Leaderboard from '../components/Leaderboard'
export default function AdminDashboard() {
  const { user } = useAuth()
  const [drivers, setDrivers] = useState([])
  const [donors, setDonors] = useState([])
  const [shelters, setShelters] = useState([])
  const [stats, setStats] = useState({})
  const [routes, setRoutes] = useState([])
  const [pickups, setPickups] = useState([])
  const [raceConditionsBlocked, setRaceConditionsBlocked] = useState(0)
  const { connected, events } = useSocket(user)
  const [simLogs, setSimLogs] = useState([])
  const [simActive, setSimActive] = useState(false)
  const lastRefreshAtRef = useRef(0)

  const fetchAll = useCallback(async () => {
    try {
      const [driversRes, donorsRes, sheltersRes, statsRes, pickupsRes] =
        await Promise.all([
          api.get('/api/drivers'),
          api.get('/api/donors'),
          api.get('/api/shelters'),
          api.get('/api/admin/stats'),
          api.get('/api/pickups')
        ])

      setDrivers(driversRes.data.data)
      setShelters(sheltersRes.data.data)
      setStats(statsRes.data.data)
      setPickups(pickupsRes.data.data)

      // Donors with latest posting
      const donorsWithPostings = donorsRes.data.data.map(donor => {
        const donorPickups = pickupsRes.data.data.filter(
          p => p.foodPosting?.donorId === donor.id
        )
        const latest = donorPickups[0]
        return {
          ...donor,
          latestPosting: latest?.foodPosting || null
        }
      })
      setDonors(donorsWithPostings)

      // Route lines banao active pickups se
      const activePickups = pickupsRes.data.data.filter(p =>
        ['CLAIMED', 'IN_PROGRESS'].includes(p.status) &&
        p.driver?.currentLat
      )

      const newRoutes = activePickups.map((pickup, i) => {
        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6']
        const points = []

        if (pickup.driver?.currentLat) {
          points.push([pickup.driver.currentLat, pickup.driver.currentLng])
        }
        if (pickup.foodPosting?.donor?.lat) {
          points.push([
            pickup.foodPosting.donor.lat,
            pickup.foodPosting.donor.lng
          ])
        }
        if (pickup.shelter?.lat) {
          points.push([pickup.shelter.lat, pickup.shelter.lng])
        }

        return {
          id: pickup.id,
          points,
          color: colors[i % colors.length]
        }
      })
      setRoutes(newRoutes)

    } catch {
      console.error('Failed to load admin dashboard data')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchAll()
    })
    const interval = setInterval(fetchAll, 10000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Socket events pe refresh
  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent) return

    if (latestEvent.event === 'pickup:race_condition_blocked') {
      void Promise.resolve().then(() => {
        setRaceConditionsBlocked(prev => prev + 1)
      })
    }

    const refreshEvents = new Set([
      'pickup:claimed',
      'pickup:picked_up',
      'pickup:delivered',
      'matching:driver_found',
      'matching:no_drivers',
      'simulation:active'
    ])

    if (refreshEvents.has(latestEvent.event)) {
      const now = Date.now()
      // Burst events ke time pe aggressive refetch avoid karo.
      if (now - lastRefreshAtRef.current >= 3000) {
        lastRefreshAtRef.current = now
        void Promise.resolve().then(() => {
          fetchAll()
        })
      }
    }
  }, [events, fetchAll])

  // Driver location real-time update
  useEffect(() => {
    const locationEvent = events.find(
      e => e.event === 'driver:location:update'
    )
    if (locationEvent) {
      const { driverId, lat, lng } = locationEvent.data
      setDrivers(prev =>
        prev.map(d =>
          d.id === driverId
            ? { ...d, currentLat: lat, currentLng: lng }
            : d
        )
      )
    }
  }, [events])

  useEffect(() => {
    if (events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent) return

    if (latestEvent.event === 'simulation:log') {
      void Promise.resolve().then(() => {
        setSimLogs(prev => [latestEvent.data, ...prev].slice(0, 100))
      })
    }

    if (latestEvent.event === 'simulation:active') {
      void Promise.resolve().then(() => {
        setSimActive(latestEvent.data?.active || false)
      })
    }
  }, [events])

  return (
    <div className="max-w-7xl mx-auto p-6">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              📊 Admin Dashboard
            </h1>
            <p className="text-gray-400">
              Live system overview — all algorithms running
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm ${
              connected
                ? 'bg-green-500 bg-opacity-20 text-green-400 border border-green-500'
                : 'bg-red-500 bg-opacity-20 text-red-400 border border-red-500'
            }`}>
              {connected ? '● Live Connected' : '○ Disconnected'}
            </span>
            <button
              onClick={fetchAll}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} />

      {/* Map + Algorithm Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Map */}
        <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-green-400">
              🗺️ Live Map — Indore
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>🏪 Donor</span>
              <span>🚗 Driver</span>
              <span>🏠 Shelter</span>
            </div>
          </div>
          <LiveMap
            drivers={drivers}
            donors={donors}
            shelters={shelters}
            routes={routes}
          />

          {/* Map Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Available Driver</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span>Offline Driver</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Urgent Food</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Moderate Urgency</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span>Shelter</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-green-400 border-dashed border" />
              <span>Active Route</span>
            </div>
          </div>
        </div>

        {/* Algorithm Panel */}
        <div>
          <AlgorithmPanel
            events={events}
            raceConditionsBlocked={raceConditionsBlocked}
          />
        </div>
      </div>

      {/* Bottom — Drivers + Donors + Shelters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Drivers */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">
            🚗 Drivers ({drivers.length})
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {drivers.map(driver => (
              <div
                key={driver.id}
                className="bg-gray-800 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {driver.vehicleType === 'BIKE' ? '🚲' :
                     driver.vehicleType === 'CAR' ? '🚗' :
                     driver.vehicleType === 'VAN' ? '🚐' : '🚛'}
                  </span>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {driver.name}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {driver.capacityKg}kg • Trust: {driver.trustScore}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  driver.isAvailable
                    ? 'bg-green-500 bg-opacity-20 text-green-400'
                    : 'bg-gray-700 text-gray-500'
                }`}>
                  {driver.isAvailable ? '● Online' : '○ Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Food Donors */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">
            🏪 Donors ({donors.length})
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {donors.map(donor => (
              <div
                key={donor.id}
                className="bg-gray-800 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white text-sm font-medium">
                    {donor.name}
                  </p>
                  {donor.latestPosting && (
                    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                      donor.latestPosting.status === 'AVAILABLE'
                        ? 'bg-yellow-600'
                        : donor.latestPosting.status === 'MATCHED'
                        ? 'bg-blue-600'
                        : donor.latestPosting.status === 'DELIVERED'
                        ? 'bg-green-600'
                        : 'bg-gray-600'
                    }`}>
                      {donor.latestPosting.status}
                    </span>
                  )}
                </div>
                {donor.latestPosting ? (
                  <p className="text-gray-400 text-xs">
                    {donor.latestPosting.quantityKg}kg •
                    Urgency: {Math.round(donor.latestPosting.urgencyScore)}/100
                  </p>
                ) : (
                  <p className="text-gray-600 text-xs">No active posting</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shelters */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">
            🏠 Shelters ({shelters.length})
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {shelters.map(shelter => {
              const pct = Math.round(
                (shelter.currentCommittedKg / shelter.maxCapacityKg) * 100
              )
              return (
                <div
                  key={shelter.id}
                  className="bg-gray-800 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white text-sm font-medium">
                      {shelter.name}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      shelter.isAccepting
                        ? 'bg-green-500 bg-opacity-20 text-green-400'
                        : 'bg-red-500 bg-opacity-20 text-red-400'
                    }`}>
                      {shelter.isAccepting ? '✅ Open' : '❌ Closed'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        pct > 80 ? 'bg-red-500' :
                        pct > 50 ? 'bg-yellow-500' :
                        'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {shelter.currentCommittedKg}/{shelter.maxCapacityKg}kg
                    ({pct}% full)
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
       {/* Leaderboard */}
<div className="mt-6">
  <Leaderboard />
</div>
      {/* Simulation Control */}
      <div className="mt-6">
        <SimulationControl
          simLogs={simLogs}
          isActive={simActive}
        />
      </div>

      <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-bold text-green-400 mb-4">📦 Recent Pickup Details</h2>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {pickups.slice(0, 20).map(pickup => {
            const routeData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
              ? pickup.routeData
              : {}
            const deliveryPhotoUrl = routeData.deliveryPhotoUrl ? `${api.defaults.baseURL}${routeData.deliveryPhotoUrl}` : null

            return (
              <div key={pickup.id} className="bg-gray-800 rounded-xl p-3 border border-gray-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white font-medium">
                    {pickup.foodPosting?.donor?.name || 'Unknown Donor'} → {pickup.shelter?.name || 'Pending Shelter'}
                  </p>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-200">
                    {pickup.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Driver: {pickup.driver?.name || 'Unassigned'}
                </p>
                {deliveryPhotoUrl && (
                  <a
                    href={deliveryPhotoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-green-400 hover:text-green-300 mt-2 inline-block"
                  >
                    📸 View Delivery Photo Proof
                  </a>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}