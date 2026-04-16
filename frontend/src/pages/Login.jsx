import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import LiveLocationMap from '../components/LiveLocationMap'

const DEMO_LOGINS = [
  {
    role: 'RESTAURANT',
    email: 'pizzahut@demo.com',
    password: 'demo123',
    emoji: '🏪',
    color: 'bg-orange-500'
  },
  {
    role: 'DRIVER',
    email: 'amit@demo.com',
    password: 'demo123',
    emoji: '🚗',
    color: 'bg-blue-500'
  },
  {
    role: 'SHELTER',
    email: 'shelter1@demo.com',
    password: 'demo123',
    emoji: '🏠',
    color: 'bg-purple-500'
  },
  {
    role: 'ADMIN',
    email: 'admin@foodrescue.com',
    password: 'admin123',
    emoji: '📊',
    color: 'bg-green-500'
  }
]

function isDemoAccountEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return DEMO_LOGINS.some(demo => demo.email.toLowerCase() === normalizedEmail)
}

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [liveLocation, setLiveLocation] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const redirectUser = (role) => {
    if (role === 'RESTAURANT') navigate('/restaurant')
    else if (role === 'DRIVER') navigate('/driver')
    else if (role === 'SHELTER') navigate('/shelter')
    else navigate('/admin')
  }

  const saveRoleLocation = async (user, lat, lng) => {
    if (!user?.entityId) return

    if (user.role === 'DRIVER') {
      await api.put(`/api/drivers/${user.entityId}/location`, { lat, lng })
      return
    }
    if (user.role === 'RESTAURANT') {
      await api.put(`/api/donors/${user.entityId}/location`, { lat, lng })
      return
    }
    if (user.role === 'SHELTER') {
      await api.put(`/api/shelters/${user.entityId}/location`, { lat, lng })
    }
  }

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      setError('Email aur password required hai')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(form.email, form.password)
      const skipLiveLocationForDemo = isDemoAccountEmail(form.email)

      if (skipLiveLocationForDemo) {
        setLoading(false)
        redirectUser(user.role)
        return
      }

      if (navigator.geolocation) {
        setShowLocationModal(true)
        setLoggedInUser(user)
        setLocationLoading(true)
        setLocationError('')
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords
              setLiveLocation({
                lat: latitude,
                lng: longitude,
                accuracy: position.coords.accuracy
              })
              await saveRoleLocation(user, latitude, longitude)
            } catch (locationError) {
              console.error(locationError)
            }
            setLocationLoading(false)
            setLoading(false)
          },
          () => {
            setLocationError('Location access is required. Please allow browser location access and tap Retry.')
            setLocationLoading(false)
            setLoading(false)
          },
          { enableHighAccuracy: true, timeout: 10000 }
        )
        return
      }

      setLoading(false)
      redirectUser(user.role)
    } catch (err) {
      if (!err.response) {
        setError('Backend unreachable/CORS blocked. Deployment URL and env check karo.')
        setLoading(false)
        return
      }
      setError(
        err.response?.data?.message || 'Login failed — check credentials'
      )
      setLoading(false)
    }
  }

  const handleConfirmLocation = async () => {
    if (!loggedInUser || !liveLocation) return

    setLocationLoading(true)
    try {
      await saveRoleLocation(loggedInUser, liveLocation.lat, liveLocation.lng)
      setShowLocationModal(false)
      redirectUser(loggedInUser.role)
    } catch (error) {
      console.error(error)
      setLocationError('Could not save live location. Please retry.')
    } finally {
      setLocationLoading(false)
    }
  }

  const handleRetryLocation = () => {
    if (!loggedInUser || !navigator.geolocation) return

    setLocationLoading(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude, accuracy } = position.coords
          setLiveLocation({ lat: latitude, lng: longitude, accuracy })
          await saveRoleLocation(loggedInUser, latitude, longitude)
        } catch (error) {
          console.error(error)
        }
        setLocationLoading(false)
      },
      () => {
        setLocationError('Browser location permission is still blocked. Enable it in site settings and retry.')
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Demo credentials
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍱</div>
          <h1 className="text-3xl font-bold text-white">
            Food Rescue Router
          </h1>
          <p className="text-gray-400 mt-2">
            Rescue Food. Feed Lives.
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-white mb-6">
            Welcome Back 👋
          </h2>

          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg px-4 py-3 text-red-400 text-sm mb-4">
              ❌ {error}
            </div>
          )}

          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="mb-6">
            <label className="text-gray-400 text-sm mb-2 block">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black font-bold py-4 rounded-xl transition-all text-lg"
          >
            {loading ? '⏳ Logging in...' : '🚀 Login'}
          </button>

          <p className="text-center text-gray-400 text-sm mt-4">
            New user?{' '}
            <Link
              to="/register"
              className="text-green-400 hover:text-green-300"
            >
              Register here
            </Link>
          </p>
        </div>

        {/* Demo Quick Login */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 mb-4">
            🎮 Demo Quick Login
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_LOGINS.map(demo => (
              <button
                key={demo.role}
                onClick={() => {
                  setForm({
                    email: demo.email,
                    password: demo.password
                  })
                }}
                className={`${demo.color} bg-opacity-20 border border-opacity-30 rounded-xl p-3 text-left hover:bg-opacity-30 transition-all`}
                style={{ borderColor: 'currentColor' }}
              >
                <div className="text-xl mb-1">{demo.emoji}</div>
                <div className="text-white text-xs font-bold">
                  {demo.role}
                </div>
                <div className="text-gray-400 text-xs">
                  {demo.email}
                </div>
              </button>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-3 text-center">
            Click to fill credentials, then Login
          </p>
        </div>
      </div>

      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 max-w-md w-full">
            <h3 className="text-white font-bold text-lg mb-2">📍 Use Your Live Location</h3>
            <p className="text-gray-400 text-sm mb-4">
              We will use your browser GPS and show it on the map. No manual entry.
            </p>

            {locationLoading && !liveLocation && (
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-gray-300 text-sm mb-4">
                Detecting your live location...
              </div>
            )}

            {locationError && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-xl px-4 py-3 text-red-300 text-sm mb-4">
                {locationError}
              </div>
            )}

            {liveLocation && (
              <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 mb-4">
                <LiveLocationMap location={liveLocation} />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleRetryLocation}
                disabled={locationLoading}
                className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl border border-gray-700 disabled:opacity-60"
              >
                {locationLoading ? 'Retrying...' : 'Retry GPS'}
              </button>
              <button
                onClick={handleConfirmLocation}
                disabled={!liveLocation || locationLoading}
                className="flex-1 bg-green-500 text-black font-bold py-3 rounded-xl disabled:bg-gray-700 disabled:text-gray-400"
              >
                Use Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}