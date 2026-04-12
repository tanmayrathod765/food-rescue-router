import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center p-8">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Access Denied
        </h2>
        <p className="text-gray-400 mb-6">
          You don't have permission to view this page
        </p>
        <button
          onClick={() => {
            if (user?.role === 'RESTAURANT') navigate('/restaurant')
            else if (user?.role === 'DRIVER') navigate('/driver')
            else if (user?.role === 'SHELTER') navigate('/shelter')
            else if (user?.role === 'ADMIN') navigate('/admin')
            else navigate('/login')
          }}
          className="bg-green-500 text-black font-bold px-6 py-3 rounded-xl"
        >
          Go to My Dashboard
        </button>
      </div>
    </div>
  )
}