import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from '../utils/api'

// Animated counter hook
function useCounter(target, duration = 2000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [target])

  return count
}

function StatsCounter({ stats }) {
  const kg = useCounter(stats.kgDeliveredToday || 340)
  const meals = useCounter(stats.mealsToday || 850)
  const drivers = useCounter(stats.activeDrivers || 12)
  const deliveries = useCounter(stats.deliveriesToday || 47)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {[
        { value: kg, label: 'Kg Rescued Today', emoji: '⚖️', suffix: 'kg' },
        { value: meals, label: 'Meals Provided', emoji: '🍽️', suffix: '+' },
        { value: drivers, label: 'Active Drivers', emoji: '🚗', suffix: '' },
        { value: deliveries, label: 'Deliveries Done', emoji: '✅', suffix: '' }
      ].map((stat, i) => (
        <div
          key={i}
          className="text-center bg-white bg-opacity-10 backdrop-blur rounded-2xl p-6"
        >
          <div className="text-3xl mb-2">{stat.emoji}</div>
          <div className="text-4xl font-bold text-white">
            {stat.value}{stat.suffix}
          </div>
          <div className="text-green-200 text-sm mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Landing() {
  const [stats, setStats] = useState({})

  useEffect(() => {
    api.get('/api/admin/stats')
      .then(res => setStats(res.data.data))
      .catch(() => {})
  }, [])

  const features = [
    {
      emoji: '🧮',
      title: 'TSP Algorithm',
      desc: 'Custom Travelling Salesman Problem solver with time windows — no Google Maps API',
      color: 'from-green-500 to-emerald-600'
    },
    {
      emoji: '🔀',
      title: 'Smart Matching',
      desc: 'Bipartite matching algorithm pairs drivers to food based on capacity + GPS proximity',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      emoji: '⚡',
      title: 'Concurrency Safe',
      desc: 'PostgreSQL row-level locking prevents double-booking race conditions',
      color: 'from-purple-500 to-violet-600'
    },
    {
      emoji: '🗺️',
      title: 'Real Road Routes',
      desc: 'OSRM-powered routing shows actual road paths, not straight lines',
      color: 'from-orange-500 to-amber-600'
    },
    {
      emoji: '🛂',
      title: 'Food Passport',
      desc: 'Every donation gets a QR-coded digital identity tracking its full journey',
      color: 'from-pink-500 to-rose-600'
    },
    {
      emoji: '📍',
      title: 'Live GPS Tracking',
      desc: 'Real-time driver location updates every 10 seconds on the live map',
      color: 'from-teal-500 to-green-600'
    }
  ]

  const steps = [
    {
      step: '01',
      title: 'Restaurant Posts Food',
      desc: 'Bakery posts 20kg surplus before closing at 9 PM',
      emoji: '🏪',
      color: 'bg-orange-500'
    },
    {
      step: '02',
      title: 'Algorithm Matches Driver',
      desc: 'Bipartite matching finds best driver by capacity + proximity + trust',
      emoji: '🎯',
      color: 'bg-blue-500'
    },
    {
      step: '03',
      title: 'TSP Calculates Route',
      desc: 'Optimal multi-stop route computed with time window constraints',
      emoji: '🗺️',
      color: 'bg-purple-500'
    },
    {
      step: '04',
      title: 'Food Reaches Shelter',
      desc: '50 people get hot meals. Impact report sent to donor.',
      emoji: '🏠',
      color: 'bg-green-500'
    }
  ]

  const roles = [
    {
      emoji: '🏪',
      title: 'Restaurant / Bakery',
      desc: 'Post surplus food in 30 seconds. Get CSR impact reports.',
      color: 'border-orange-500',
      bg: 'from-orange-500',
      role: 'RESTAURANT'
    },
    {
      emoji: '🚗',
      title: 'Volunteer Driver',
      desc: 'Pick up food on your way. Earn badges. Track your impact.',
      color: 'border-blue-500',
      bg: 'from-blue-500',
      role: 'DRIVER'
    },
    {
      emoji: '🏠',
      title: 'Shelter / NGO',
      desc: 'Manage incoming donations. Get weekly reports.',
      color: 'border-purple-500',
      bg: 'from-purple-500',
      role: 'SHELTER'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-gray-950 bg-opacity-90 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍱</span>
            <span className="text-xl font-bold text-green-400">
              Food Rescue Router
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-4 py-2 rounded-xl transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-full px-4 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm">
              Live in Indore — Real-time food rescue
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Rescue Food.
            <br />
            <span className="text-green-400">Feed Lives.</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Real-time logistics platform connecting surplus food from
            restaurants to shelters — powered by custom TSP algorithms,
            bipartite matching, and concurrency-safe backend.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              to="/register"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-2xl text-lg transition-all"
            >
              🚀 Join the Mission
            </Link>
            <Link
              to="/login"
              className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-8 py-4 rounded-2xl text-lg transition-all"
            >
              📊 View Live Dashboard
            </Link>
          </div>

          {/* Stats */}
          <StatsCounter stats={stats} />
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-gray-400 text-lg">
              From surplus food to hot meal — in minutes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 h-full">
                  <div className={`w-12 h-12 ${step.color} rounded-xl flex items-center justify-center text-white font-bold text-lg mb-4`}>
                    {step.step}
                  </div>
                  <div className="text-3xl mb-3">{step.emoji}</div>
                  <h3 className="text-white font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-400 text-sm">{step.desc}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 text-gray-600 text-2xl z-10">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Built with Real Algorithms
            </h2>
            <p className="text-gray-400 text-lg">
              No black-box APIs — every algorithm written from scratch
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-gray-600 transition-all group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {f.emoji}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  {f.title}
                </h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join As */}
      <section className="py-20 px-6 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Join As
            </h2>
            <p className="text-gray-400 text-lg">
              Every role matters in the food rescue chain
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((role, i) => (
              <div
                key={i}
                className={`bg-gray-800 rounded-2xl p-8 border-2 ${role.color} border-opacity-50 hover:border-opacity-100 transition-all`}
              >
                <div className="text-5xl mb-4">{role.emoji}</div>
                <h3 className="text-white font-bold text-xl mb-3">
                  {role.title}
                </h3>
                <p className="text-gray-400 mb-6">{role.desc}</p>
                <Link
                  to={`/register`}
                  className={`block text-center bg-gradient-to-r ${role.bg} to-transparent border border-current text-white font-bold py-3 rounded-xl hover:opacity-80 transition-all`}
                >
                  Join as {role.title.split('/')[0].trim()} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Banner */}
      <section className="py-20 px-6 bg-gradient-to-r from-green-900 to-emerald-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Every kg matters 🙏
          </h2>
          <p className="text-green-200 text-xl mb-8">
            1kg rescued = ~2.5 meals = ₹150 value = 2.5kg CO₂ saved
          </p>
          <Link
            to="/register"
            className="bg-white text-green-900 font-bold px-10 py-4 rounded-2xl text-lg hover:bg-green-50 transition-all"
          >
            Start Rescuing Food Today 🚀
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 border-t border-gray-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <span className="text-2xl">🍱</span>
            <span className="text-green-400 font-bold">
              Food Rescue Router
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Built for KRIYETA 5.0 Hackathon •
            Track 2: AI for Social Good •
            SVVV Indore
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link to="/login" className="text-gray-400 hover:text-white text-sm">
              Login
            </Link>
            <Link to="/register" className="text-gray-400 hover:text-white text-sm">
              Register
            </Link>
            <Link to="/admin" className="text-gray-400 hover:text-white text-sm">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}