import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import ImpactNotification from './components/ImpactNotification'
import { useSocket } from './hooks/useSocket'

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import Unauthorized from './pages/Unauthorized'
import RestaurantDashboard from './pages/RestaurantDashboard'
import DriverDashboard from './pages/DriverDashboard'
import ShelterDashboard from './pages/ShelterDashboard'
import AdminDashboard from './pages/AdminDashboard'
import Landing from './pages/Landing'
import BadgeNotification from './components/BadgeNotification'
import NoShowAlert from './components/NoShowAlert'
import NotificationBell from './components/NotificationBell'
function NavBar({ events }) {
  const { user, logout } = useAuth()

  if (!user) return null

  const navLinks = {
    RESTAURANT: [{ to: '/restaurant', label: '🏪 Dashboard' }],
    DRIVER: [{ to: '/driver', label: '🚗 Dashboard' }],
    SHELTER: [{ to: '/shelter', label: '🏠 Dashboard' }],
    ADMIN: [
      { to: '/admin', label: '📊 Admin' },
      { to: '/restaurant', label: '🏪 Restaurant' },
      { to: '/driver', label: '🚗 Driver' },
      { to: '/shelter', label: '🏠 Shelter' }
    ]
  }

  return (
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

        <div className="flex items-center gap-6">
          {navLinks[user.role]?.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="text-gray-400 hover:text-green-400 transition-colors text-sm"
            >
              {link.label}
            </Link>
          ))}

          <NotificationBell events={events} />

          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-700">
            <div className="text-right">
              <p className="text-white text-sm font-medium">
                {user.entityData?.name || user.email}
              </p>
              <p className="text-gray-500 text-xs">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

function AppContent() {
  const { user } = useAuth()
  const { events } = useSocket()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <NavBar events={events} />
      <ImpactNotification events={events} />
<BadgeNotification events={events} />
<NoShowAlert events={events} />
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={user ? <Navigate to={
            user.role === 'RESTAURANT' ? '/restaurant' :
            user.role === 'DRIVER' ? '/driver' :
            user.role === 'SHELTER' ? '/shelter' : '/admin'
          } /> : <Login />}
        />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected */}
        <Route path="/restaurant" element={
          <ProtectedRoute role="RESTAURANT">
            <RestaurantDashboard />
          </ProtectedRoute>
        } />
        <Route path="/driver" element={
          <ProtectedRoute role="DRIVER">
            <DriverDashboard />
          </ProtectedRoute>
        } />
        <Route path="/shelter" element={
          <ProtectedRoute role="SHELTER">
            <ShelterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute role="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Default */}
        <Route path="/" element={
  user ? <Navigate to={
    user.role === 'RESTAURANT' ? '/restaurant' :
    user.role === 'DRIVER' ? '/driver' :
    user.role === 'SHELTER' ? '/shelter' : '/admin'
  } /> : <Landing />
} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}