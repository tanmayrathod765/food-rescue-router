import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LiveLocationMap from '../components/LiveLocationMap'

const ROLES = [
  { value: 'RESTAURANT', label: 'Restaurant / Bakery', emoji: '🏪' },
  { value: 'DRIVER', label: 'Volunteer Driver', emoji: '🚗' },
  { value: 'SHELTER', label: 'Shelter / NGO', emoji: '🏠' }
]

const VEHICLE_TYPES = [
  { value: 'BIKE', label: 'Bike', emoji: '🚲', capacity: 10 },
  { value: 'CAR', label: 'Car', emoji: '🚗', capacity: 50 },
  { value: 'VAN', label: 'Van', emoji: '🚐', capacity: 100 },
  { value: 'TRUCK', label: 'Truck', emoji: '🚛', capacity: 500 }
]

export default function Register() {
  const [step, setStep] = useState(1) // 1: role, 2: details
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [liveLocation, setLiveLocation] = useState(null)
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    vehicleType: 'CAR',
    capacityKg: 50,
    maxCapacityKg: 100,
    acceptingFrom: '18:00',
    acceptingTill: '22:00',
    contactName: '',
    contactPhone: ''
  })

  const handleRegister = async () => {
    if (form.password !== form.confirmPassword) {
      setError('Passwords match nahi kar rahe')
      return
    }
    if (!form.name || !form.email || !form.password) {
      setError('Sab required fields bharo')
      return
    }

    setLoading(true)
    setError('')
    try {
      if (selectedRole === 'RESTAURANT' && !liveLocation) {
        setError('Restaurant signup requires live GPS location. Please allow location access.')
        setLoading(false)
        return
      }

      const payload = {
        ...form,
        role: selectedRole
      }

      if (selectedRole === 'RESTAURANT' && liveLocation) {
        payload.lat = liveLocation.lat
        payload.lng = liveLocation.lng
        payload.address = form.address || 'Live location captured'
      }

      const user = await register(payload)
      if (user.role === 'RESTAURANT') navigate('/restaurant')
      else if (user.role === 'DRIVER') navigate('/driver')
      else if (user.role === 'SHELTER') navigate('/shelter')
    } catch (err) {
      if (!err.response) {
        setError('Backend unreachable/CORS blocked. Deployment URL and env check karo')
        return
      }
      setError(
        err.response?.data?.message || 'Registration failed'
      )
    }
    setLoading(false)
  }

  const captureRestaurantLocation = () => {
    if (selectedRole !== 'RESTAURANT' || !navigator.geolocation) {
      setLocationError('Browser geolocation is not available in this device/browser.')
      return
    }

    setLocationLoading(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setLiveLocation({ lat: latitude, lng: longitude, accuracy })
        setLocationLoading(false)
      },
      () => {
        setLocationError('Location access is required. Please allow GPS and retry.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  useEffect(() => {
    if (step === 2 && selectedRole === 'RESTAURANT' && !liveLocation && !locationLoading) {
      captureRestaurantLocation()
    }
  }, [step, selectedRole, liveLocation, locationLoading])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍱</div>
          <h1 className="text-2xl font-bold text-white">
            Join Food Rescue Router
          </h1>
        </div>

        {/* Step 1 — Role Select */}
        {step === 1 && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-2">
              I am a...
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Select your role to get started
            </p>

            <div className="space-y-3 mb-6">
              {ROLES.map(role => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    selectedRole === role.value
                      ? 'border-green-500 bg-green-500 bg-opacity-10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{role.emoji}</span>
                    <span className="text-white font-medium">
                      {role.label}
                    </span>
                    {selectedRole === role.value && (
                      <span className="ml-auto text-green-400">✅</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => selectedRole && setStep(2)}
              disabled={!selectedRole}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-4 rounded-xl transition-all"
            >
              Continue →
            </button>

            <p className="text-center text-gray-400 text-sm mt-4">
              Already registered?{' '}
              <Link to="/login" className="text-green-400">
                Login
              </Link>
            </p>
          </div>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white"
              >
                ←
              </button>
              <h2 className="text-xl font-bold text-white">
                {ROLES.find(r => r.value === selectedRole)?.emoji}{' '}
                {ROLES.find(r => r.value === selectedRole)?.label}
              </h2>
            </div>

            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
                ❌ {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Common Fields */}
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={
                  selectedRole === 'RESTAURANT'
                    ? 'Restaurant Name'
                    : selectedRole === 'DRIVER'
                    ? 'Your Full Name'
                    : 'Shelter Name'
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
              />

              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Email address"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
              />

              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone number"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
              />

              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Password"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
              />

              <input
                type="password"
                value={form.confirmPassword}
                onChange={e =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder="Confirm Password"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
              />

              {/* Driver specific */}
              {selectedRole === 'DRIVER' && (
                <>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">
                      Vehicle Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {VEHICLE_TYPES.map(v => (
                        <button
                          key={v.value}
                          onClick={() => setForm({
                            ...form,
                            vehicleType: v.value,
                            capacityKg: v.capacity
                          })}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            form.vehicleType === v.value
                              ? 'border-green-500 bg-green-500 bg-opacity-10'
                              : 'border-gray-700 bg-gray-800'
                          }`}
                        >
                          <div className="text-xl">{v.emoji}</div>
                          <div className="text-white text-xs">
                            {v.label}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {v.capacity}kg
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Restaurant live location */}
              {selectedRole === 'RESTAURANT' && (
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-white font-medium">Live Location</p>
                      <p className="text-gray-400 text-xs">
                        We will capture your exact browser GPS location automatically.
                      </p>
                    </div>
                  </div>

                  {locationError && (
                    <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm">
                      {locationError}
                    </div>
                  )}

                  {locationLoading && !liveLocation && (
                    <div className="bg-gray-900 rounded-xl px-4 py-3 text-gray-300 text-sm border border-gray-700">
                      Fetching live location...
                    </div>
                  )}

                  {locationError && (
                    <button
                      type="button"
                      onClick={captureRestaurantLocation}
                      disabled={locationLoading}
                      className="w-full bg-green-500 text-black font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-60"
                    >
                      {locationLoading ? 'Retrying GPS...' : 'Retry GPS'}
                    </button>
                  )}

                  {liveLocation && (
                    <LiveLocationMap location={liveLocation} />
                  )}

                  {!liveLocation && !locationLoading && !locationError && (
                    <p className="text-gray-500 text-xs">
                      Click Capture GPS to place your restaurant on the map automatically.
                    </p>
                  )}
                </div>
              )}

              {/* Shelter address */}
              {selectedRole === 'SHELTER' && (
                <input
                  type="text"
                  value={form.address}
                  onChange={e =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Full Address"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
                />
              )}

              {/* Shelter specific */}
              {selectedRole === 'SHELTER' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">
                        Accepting From
                      </label>
                      <input
                        type="time"
                        value={form.acceptingFrom}
                        onChange={e =>
                          setForm({ ...form, acceptingFrom: e.target.value })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-green-400"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">
                        Accepting Till
                      </label>
                      <input
                        type="time"
                        value={form.acceptingTill}
                        onChange={e =>
                          setForm({ ...form, acceptingTill: e.target.value })
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-green-400"
                      />
                    </div>
                  </div>
                  <input
                    type="number"
                    value={form.maxCapacityKg}
                    onChange={e =>
                      setForm({
                        ...form,
                        maxCapacityKg: parseFloat(e.target.value)
                      })
                    }
                    placeholder="Max capacity (kg)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
                  />
                </>
              )}
            </div>

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black font-bold py-4 rounded-xl transition-all mt-6"
            >
              {loading ? '⏳ Registering...' : '✅ Create Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}