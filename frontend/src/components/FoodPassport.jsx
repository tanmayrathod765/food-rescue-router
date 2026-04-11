import { useState } from 'react'
import api from '../utils/api'

export default function FoodPassport({ foodPostingId, donorName }) {
  const [passport, setPassport] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)

  const fetchPassport = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/donors/passport/${foodPostingId}`)
      setPassport(res.data.passport)
      setQrCode(res.data.qrCode)
      setShow(true)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const getStageEmoji = (stage) => {
    const emojis = {
      POSTED: '📝',
      MATCHED: '🎯',
      PICKED_UP: '📦',
      DELIVERED: '✅'
    }
    return emojis[stage] || '●'
  }

  const getStageColor = (stage) => {
    const colors = {
      POSTED: 'bg-yellow-500',
      MATCHED: 'bg-blue-500',
      PICKED_UP: 'bg-purple-500',
      DELIVERED: 'bg-green-500'
    }
    return colors[stage] || 'bg-gray-500'
  }

  if (!show) {
    return (
      <button
        onClick={fetchPassport}
        disabled={loading}
        className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
      >
        {loading ? '⏳ Loading...' : '🛂 View Food Passport'}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 max-w-lg w-full max-h-screen overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              🛂 Food Passport
            </h2>
            <p className="text-green-400 text-sm font-mono">
              {passport?.passportId}
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {passport && (
          <>
            {/* Food Details */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-400 mb-3">
                🍱 Food Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="text-white ml-2">
                    {passport.food.type.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Quantity:</span>
                  <span className="text-white ml-2">
                    {passport.food.quantityKg}kg
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Dietary:</span>
                  <span className={`ml-2 ${
                    passport.food.isVeg
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {passport.food.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <span className="text-blue-400 ml-2">
                    {passport.status}
                  </span>
                </div>
                {donorName && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Donor:</span>
                    <span className="text-white ml-2">{donorName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Journey Timeline */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-400 mb-3">
                📍 Journey
              </h3>
              <div className="space-y-3">
                {passport.journey.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${getStageColor(step.stage)} flex items-center justify-center text-sm flex-shrink-0`}>
                      {getStageEmoji(step.stage)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="text-white text-sm font-medium">
                          {step.label}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs">
                        {step.location}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {step.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact */}
            <div className="bg-green-500 bg-opacity-10 border border-green-500 border-opacity-30 rounded-xl p-4 mb-4">
              <h3 className="text-sm font-bold text-green-400 mb-3">
                💚 Impact
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-white">
                    ~{passport.impact.mealsProvided}
                  </div>
                  <div className="text-xs text-gray-400">Meals</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {passport.impact.co2Saved}kg
                  </div>
                  <div className="text-xs text-gray-400">CO₂ Saved</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    ₹{passport.impact.moneyValue}
                  </div>
                  <div className="text-xs text-gray-400">Value</div>
                </div>
              </div>
            </div>

            {/* QR Code */}
            {qrCode && (
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <h3 className="text-sm font-bold text-gray-400 mb-3">
                  📱 Scan to Verify
                </h3>
                <img
                  src={qrCode}
                  alt="Food Passport QR"
                  className="mx-auto rounded-lg"
                  style={{ width: 150, height: 150 }}
                />
                <p className="text-gray-500 text-xs mt-2">
                  QR contains food journey data
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}