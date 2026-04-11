import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useSocket } from '../hooks/useSocket'

export default function ShelterDashboard() {
  const [shelters, setShelters] = useState([])
  const [selectedShelter, setSelectedShelter] = useState(null)
  const [incomingPickups, setIncomingPickups] = useState([])
  const [deliveredPickups, setDeliveredPickups] = useState([])
  const [msg, setMsg] = useState('')
  const { connected, events } = useSocket()

  // Shelters fetch karo
  useEffect(() => {
    api.get('/api/shelters')
      .then(res => {
        setShelters(res.data.data)
        if (res.data.data.length > 0) {
          setSelectedShelter(res.data.data[0])
        }
      })
      .catch(console.error)
  }, [])

  // Pickups fetch karo
  useEffect(() => {
    fetchPickups()
  }, [selectedShelter])

  // Socket events pe refresh
  useEffect(() => {
    if (events.length > 0) fetchPickups()
  }, [events])

  const fetchPickups = async () => {
    if (!selectedShelter) return
    try {
      const res = await api.get('/api/pickups')
      const all = res.data.data
      setIncomingPickups(
        all.filter(p =>
          p.shelterId === selectedShelter.id &&
          ['CLAIMED', 'IN_PROGRESS'].includes(p.status)
        )
      )
      setDeliveredPickups(
        all.filter(p =>
          p.shelterId === selectedShelter.id &&
          p.status === 'DELIVERED'
        )
      )
    } catch (err) {
      console.error(err)
    }
  }

  const handleAccepting = async () => {
    if (!selectedShelter) return
    try {
      const res = await api.put(
        `/api/shelters/${selectedShelter.id}/accepting`,
        { isAccepting: !selectedShelter.isAccepting }
      )
      setSelectedShelter(res.data.data)
      setShelters(prev =>
        prev.map(s => s.id === res.data.data.id ? res.data.data : s)
      )
      setMsg(
        res.data.data.isAccepting
          ? '✅ Now accepting donations'
          : '❌ Stopped accepting donations'
      )
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      console.error(err)
    }
  }

  const totalKgIncoming = incomingPickups.reduce(
    (sum, p) => sum + (p.foodPosting?.quantityKg || 0), 0
  )
  const totalKgDelivered = deliveredPickups.reduce(
    (sum, p) => sum + (p.foodPosting?.quantityKg || 0), 0
  )
  const capacityUsed = selectedShelter
    ? Math.round(
        (selectedShelter.currentCommittedKg /
          selectedShelter.maxCapacityKg) * 100
      )
    : 0

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          🏠 Shelter Dashboard
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-gray-400">
            Manage incoming food donations and capacity
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

      {/* Shelter Selector */}
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 mb-6">
        <label className="text-gray-400 text-sm mb-2 block">
          Select Shelter
        </label>
        <div className="flex flex-wrap gap-3">
          {shelters.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedShelter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedShelter?.id === s.id
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              🏠 {s.name}
            </button>
          ))}
        </div>
      </div>

      {selectedShelter && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Shelter Info */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-green-400 mb-4">
              🏠 Shelter Info
            </h2>

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🏠</div>
              <h3 className="text-xl font-bold text-white">
                {selectedShelter.name}
              </h3>
              <p className="text-gray-400 text-sm">
                {selectedShelter.address}
              </p>
            </div>

            {/* Capacity Bar */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Capacity Used</span>
                <span className="text-white font-bold">
                  {selectedShelter.currentCommittedKg}kg /
                  {selectedShelter.maxCapacityKg}kg
                </span>
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
              <p className="text-xs text-gray-500 mt-1">
                {capacityUsed}% full
              </p>
            </div>

            {/* Accepting Window */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-400 mb-2">
                ⏰ Accepting Window
              </h3>
              <p className="text-white font-medium">
                {selectedShelter.acceptingFrom} —{' '}
                {selectedShelter.acceptingTill}
              </p>
            </div>

            {/* Food Preferences */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-400 mb-2">
                🍽️ Accepts
              </h3>
              <div className="flex gap-2">
                {selectedShelter.needsVeg && (
                  <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full">
                    🟢 Vegetarian
                  </span>
                )}
                {selectedShelter.needsNonVeg && (
                  <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full">
                    🔴 Non-Veg
                  </span>
                )}
              </div>
            </div>

            {/* Message */}
            {msg && (
              <div className="mb-4 bg-blue-500 bg-opacity-20 border border-blue-500 rounded-lg px-4 py-3 text-blue-400 text-sm">
                {msg}
              </div>
            )}

            {/* Accepting Toggle */}
            <button
              onClick={handleAccepting}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                selectedShelter.isAccepting
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {selectedShelter.isAccepting
                ? '✅ Accepting — Click to Stop'
                : '❌ Not Accepting — Click to Start'}
            </button>
          </div>

          {/* Incoming Food */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-bold text-green-400 mb-2">
              🚗 Incoming Food
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Total incoming: {totalKgIncoming}kg (~
              {Math.round(totalKgIncoming * 2.5)} meals)
            </p>

            {incomingPickups.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <div className="text-5xl mb-4">🕐</div>
                <p>No incoming deliveries</p>
                <p className="text-sm mt-2">
                  Waiting for drivers to claim pickups
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingPickups.map(pickup => (
                  <div
                    key={pickup.id}
                    className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${
                        pickup.status === 'IN_PROGRESS'
                          ? 'bg-blue-400'
                          : 'bg-yellow-400'
                      }`} />
                      <span className="text-white font-medium text-sm">
                        {pickup.status === 'IN_PROGRESS'
                          ? '🚗 On the way!'
                          : '⏳ Driver assigned'}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">From:</span>
                        <span className="text-white">
                          {pickup.foodPosting?.donor?.name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Driver:</span>
                        <span className="text-blue-400">
                          {pickup.driver?.name || 'TBD'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Quantity:</span>
                        <span className="text-white">
                          {pickup.foodPosting?.quantityKg}kg
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Meals:</span>
                        <span className="text-green-400">
                          ~{Math.round(
                            pickup.foodPosting?.quantityKg * 2.5
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Food type:</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                          pickup.foodPosting?.isVeg
                            ? 'bg-green-600'
                            : 'bg-red-600'
                        }`}>
                          {pickup.foodPosting?.isVeg ? 'VEG' : 'NON-VEG'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats + Delivered */}
          <div className="space-y-6">

            {/* Today Stats */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-green-400 mb-4">
                📊 Today's Stats
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
                  <span className="text-gray-400 text-sm">
                    Food Received
                  </span>
                  <span className="text-white font-bold">
                    {totalKgDelivered}kg
                  </span>
                </div>
                <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
                  <span className="text-gray-400 text-sm">
                    Meals Served
                  </span>
                  <span className="text-green-400 font-bold">
                    ~{Math.round(totalKgDelivered * 2.5)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
                  <span className="text-gray-400 text-sm">
                    Deliveries
                  </span>
                  <span className="text-blue-400 font-bold">
                    {deliveredPickups.length}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-gray-800 rounded-xl p-3">
                  <span className="text-gray-400 text-sm">
                    Incoming
                  </span>
                  <span className="text-yellow-400 font-bold">
                    {incomingPickups.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivered History */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h2 className="text-lg font-bold text-green-400 mb-4">
                ✅ Delivered Today
              </h2>
              {deliveredPickups.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  <p className="text-sm">No deliveries yet today</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {deliveredPickups.map(pickup => (
                    <div
                      key={pickup.id}
                      className="bg-gray-800 rounded-xl p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">
                          {pickup.foodPosting?.donor?.name}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {pickup.foodPosting?.quantityKg}kg •{' '}
                          {new Date(
                            pickup.deliveredAt
                          ).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className="text-green-400 text-sm font-bold">
                        ✅
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Events */}
      {events.length > 0 && (
        <div className="mt-6 bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold text-green-400 mb-4">
            ⚡ Live Events
          </h2>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm bg-gray-800 rounded-lg px-4 py-2"
              >
                <span className="text-gray-500 text-xs font-mono">
                  {e.timestamp}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  e.event.includes('delivered')
                    ? 'bg-green-500 text-black'
                    : e.event.includes('blocked')
                    ? 'bg-red-500 text-white'
                    : 'bg-blue-500 text-white'
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