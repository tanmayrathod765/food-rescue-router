import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      setError('Email aur password required hai')
      return
    }
    setLoading(true)
    setError('')
    try {
      const user = await login(form.email, form.password)
      // Role ke hisaab se redirect
      if (user.role === 'RESTAURANT') navigate('/restaurant')
      else if (user.role === 'DRIVER') navigate('/driver')
      else if (user.role === 'SHELTER') navigate('/shelter')
      else if (user.role === 'ADMIN') navigate('/admin')
    } catch (err) {
      setError(
        err.response?.data?.message || 'Login failed — check credentials'
      )
    }
    setLoading(false)
  }

  // Demo credentials
  const demoLogins = [
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
            {demoLogins.map(demo => (
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
    </div>
  )
}