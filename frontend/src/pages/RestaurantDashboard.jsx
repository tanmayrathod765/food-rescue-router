import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import FoodPassport from '../components/FoodPassport'
import FoodSafetyBadge from '../components/FoodSafetyBadge'

export default function RestaurantDashboard() {
  const [donors, setDonors] = useState([])
  const [postings, setPostings] = useState([])
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedDonor, setSelectedDonor] = useState('')

  const [form, setForm] = useState({
    foodType: 'HOT_MEAL',
    isVeg: true,
    quantityKg: '',
    description: '',
    closingTime: '',
    timeSinceCooked: 0,
    isRefrigerated: false
  })

  const [safetyPreview, setSafetyPreview] = useState(null)

  const fetchSafetyPreview = useCallback(() => {
    if (!form.quantityKg || !form.closingTime) {
      setSafetyPreview(null)
      return
    }

    api.post('/api/donors/safety-score', {
      foodType: form.foodType,
      timeSinceCooked: form.timeSinceCooked,
      isRefrigerated: form.isRefrigerated,
      closingTime: form.closingTime,
      quantityKg: parseFloat(form.quantityKg) || 0
    })
      .then(res => setSafetyPreview(res.data.data))
      .catch(() => {})
  }, [
    form.foodType,
    form.timeSinceCooked,
    form.isRefrigerated,
    form.closingTime,
    form.quantityKg
  ])

  // Safety score preview
  useEffect(() => {
    fetchSafetyPreview()
  }, [fetchSafetyPreview])

  // Donors fetch karo
  useEffect(() => {
    api.get('/api/donors')
      .then(res => {
        setDonors(res.data.data)
        if (res.data.data.length > 0) {
          setSelectedDonor(res.data.data[0].id)
        }
      })
      .catch(console.error)
  }, [])

  // Postings fetch karo jab donor change ho
  useEffect(() => {
    if (!selectedDonor) return
    api.get(`/api/donors/${selectedDonor}/postings`)
      .then(res => setPostings(res.data.data))
      .catch(console.error)
  }, [selectedDonor, successMsg])

  const handleSubmit = async () => {
    if (!form.quantityKg || !form.closingTime) {
      alert('Quantity aur closing time required hai!')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/donors/food-posting', {
        donorId: selectedDonor,
        ...form,
        quantityKg: parseFloat(form.quantityKg)
      })
      setSuccessMsg('Food posted successfully! Matching in progress...')
      setForm({
        foodType: 'HOT_MEAL',
        isVeg: true,
        quantityKg: '',
        description: '',
        closingTime: '',
        timeSinceCooked: 0,
        isRefrigerated: false
      })
      setSafetyPreview(null)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      alert('Error posting food')
    }
    setLoading(false)
  }

  const getStatusColor = (status) => {
    const colors = {
      AVAILABLE: 'bg-yellow-500',
      MATCHED: 'bg-blue-500',
      PICKED_UP: 'bg-purple-500',
      DELIVERED: 'bg-green-500',
      EXPIRED: 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const getStatusEmoji = (status) => {
    const emojis = {
      AVAILABLE: '⏳',
      MATCHED: '🚗',
      PICKED_UP: '📦',
      DELIVERED: '✅',
      EXPIRED: '❌'
    }
    return emojis[status] || '❓'
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          🏪 Restaurant Dashboard
        </h1>
        <p className="text-gray-400">
          Post surplus food for rescue — drivers will be automatically matched
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Post Food Form */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-green-400 mb-6">
            📦 Post Surplus Food
          </h2>

          {/* Donor Select */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Select Restaurant
            </label>
            <select
              value={selectedDonor}
              onChange={e => setSelectedDonor(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            >
              {donors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Food Type */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Food Type
            </label>
            <select
              value={form.foodType}
              onChange={e => setForm({ ...form, foodType: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            >
              <option value="HOT_MEAL">🍛 Hot Meal</option>
              <option value="BAKERY">🥐 Bakery</option>
              <option value="SEALED">📦 Sealed</option>
              <option value="RAW_PRODUCE">🥦 Raw Produce</option>
              <option value="BEVERAGES">🥤 Beverages</option>
            </select>
          </div>

          {/* Veg/Non-veg */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Dietary Type
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, isVeg: true })}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  form.isVeg
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                🟢 Vegetarian
              </button>
              <button
                onClick={() => setForm({ ...form, isVeg: false })}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  !form.isVeg
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                🔴 Non-Veg
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Quantity (kg)
            </label>
            <input
              type="number"
              value={form.quantityKg}
              onChange={e => setForm({ ...form, quantityKg: e.target.value })}
              placeholder="e.g. 20"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {/* Closing Time */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Closing Time (Pickup Deadline)
            </label>
            <input
              type="datetime-local"
              value={form.closingTime}
              onChange={e => setForm({ ...form, closingTime: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {/* Time Since Cooked */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Time Since Cooked (minutes)
            </label>
            <input
              type="number"
              value={form.timeSinceCooked}
              onChange={e => setForm({
                ...form,
                timeSinceCooked: parseInt(e.target.value) || 0
              })}
              placeholder="e.g. 30"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {/* Refrigerated */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm mb-2 block">
              Storage
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, isRefrigerated: false })}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  !form.isRefrigerated
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                🌡️ Room Temp
              </button>
              <button
                onClick={() => setForm({ ...form, isRefrigerated: true })}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  form.isRefrigerated
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                ❄️ Refrigerated
              </button>
            </div>
          </div>

          {/* Safety Preview */}
          {safetyPreview && (
            <div className="mb-4">
              <FoodSafetyBadge
                score={safetyPreview.score}
                label={safetyPreview.label}
                emoji={safetyPreview.emoji}
                recommendation={safetyPreview.recommendation}
              />
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm mb-2 block">
              Notes (optional)
            </label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Contains nuts, handle carefully"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg px-4 py-3 text-green-400">
              ✅ {successMsg}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-black font-bold py-4 rounded-xl transition-all text-lg"
          >
            {loading ? '⏳ Posting...' : '🚀 Post Food for Rescue'}
          </button>
        </div>

        {/* Recent Postings */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-green-400 mb-6">
            📋 Recent Postings
          </h2>

          {postings.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <div className="text-5xl mb-4">🍽️</div>
              <p>No postings yet</p>
              <p className="text-sm mt-2">Post your first food rescue!</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {postings.map(posting => (
                <div
                  key={posting.id}
                  className="bg-gray-800 rounded-xl p-4 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {posting.foodType === 'HOT_MEAL' ? '🍛' :
                         posting.foodType === 'BAKERY' ? '🥐' :
                         posting.foodType === 'SEALED' ? '📦' :
                         posting.foodType === 'RAW_PRODUCE' ? '🥦' : '🥤'}
                      </span>
                      <span className="font-medium text-white">
                        {posting.foodType.replace('_', ' ')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
                        posting.isVeg ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {posting.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full text-white ${getStatusColor(posting.status)}`}>
                      {getStatusEmoji(posting.status)} {posting.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-400">
                      ⚖️ {posting.quantityKg} kg
                    </div>
                    <div className="text-gray-400">
                      ⏰ {new Date(posting.closingTime).toLocaleTimeString()}
                    </div>
                    {posting.pickup?.driver && (
                      <div className="text-blue-400 col-span-2">
                        🚗 Driver: {posting.pickup.driver.name}
                      </div>
                    )}
                    {posting.pickup?.shelter && (
                      <div className="text-purple-400 col-span-2">
                        🏠 Shelter: {posting.pickup.shelter.name}
                      </div>
                    )}
                  </div>

                  {/* Safety Badge */}
                  {posting.safetyScore !== undefined && (
                    <div className="mt-2">
                      <FoodSafetyBadge
                        score={posting.safetyScore}
                        label={
                          posting.safetyScore >= 90 ? 'Safe' :
                          posting.safetyScore >= 70 ? 'Consume Soon' :
                          posting.safetyScore >= 50 ? 'Urgent' : 'Risk'
                        }
                        emoji={
                          posting.safetyScore >= 90 ? '✅' :
                          posting.safetyScore >= 70 ? '⚠️' :
                          posting.safetyScore >= 50 ? '🔶' : '❌'
                        }
                        recommendation={
                          posting.safetyScore >= 90
                            ? 'Food is fresh'
                            : 'Deliver as soon as possible'
                        }
                      />
                    </div>
                  )}

                  {/* Urgency Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Urgency</span>
                      <span>{Math.round(posting.urgencyScore)}/100</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          posting.urgencyScore > 70 ? 'bg-red-500' :
                          posting.urgencyScore > 40 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, posting.urgencyScore)}%` }}
                      />
                    </div>
                  </div>

                  {/* Food Passport */}
                  <div className="mt-2">
                    <FoodPassport
                      foodPostingId={posting.id}
                      donorName={posting.donor?.name}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}