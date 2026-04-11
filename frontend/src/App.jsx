import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DriverDashboard from './pages/DriverDashboard'
import ShelterDashboard from './pages/ShelterDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ImpactNotification from './components/ImpactNotification'
import { useSocket } from './hooks/useSocket'

function App() {
  const { events } = useSocket()

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Navbar */}
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🍱</span>
              <span className="text-xl font-bold text-green-400">
                Food Rescue Router
              </span>
              <span className="text-xs bg-green-400 text-black px-2 py-0.5 rounded-full font-bold">
                LIVE
              </span>
            </div>
            <div className="flex gap-6">
              <Link
                to="/"
                className="text-gray-400 hover:text-green-400 transition-colors text-sm"
              >
                🏪 Restaurant
              </Link>
              <Link
                to="/driver"
                className="text-gray-400 hover:text-green-400 transition-colors text-sm"
              >
                🚗 Driver
              </Link>
              <Link
                to="/shelter"
                className="text-gray-400 hover:text-green-400 transition-colors text-sm"
              >
                🏠 Shelter
              </Link>
              <Link
                to="/admin"
                className="text-gray-400 hover:text-green-400 transition-colors text-sm"
              >
                📊 Admin
              </Link>
            </div>
          </div>
        </nav>

        <ImpactNotification events={events} />

        {/* Routes */}
        <Routes>
          <Route path="/" element={<RestaurantDashboard />} />
          <Route path="/driver" element={<DriverDashboard />} />
          <Route path="/shelter" element={<ShelterDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App