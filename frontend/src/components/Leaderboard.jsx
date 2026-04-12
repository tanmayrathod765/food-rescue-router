import { useState, useEffect } from 'react'
import api from '../utils/api'

const LEVEL_EMOJI = {
  ROOKIE: '🌱',
  RISING: '⭐',
  HERO: '🦸',
  LEGEND: '👑'
}

const DONOR_BADGE_EMOJI = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  DIAMOND: '💎'
}

export default function Leaderboard() {
  const [tab, setTab] = useState('drivers')
  const [drivers, setDrivers] = useState([])
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/gamification/leaderboard/drivers'),
      api.get('/api/gamification/leaderboard/donors')
    ])
      .then(([dRes, donorRes]) => {
        setDrivers(dRes.data.data)
        setDonors(donorRes.data.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const rankEmoji = (rank) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-bold text-green-400 mb-4">
        🏆 Leaderboard
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('drivers')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === 'drivers'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          🚗 Drivers
        </button>
        <button
          onClick={() => setTab('donors')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            tab === 'donors'
              ? 'bg-green-500 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          🏪 Donors
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading...</div>
      ) : tab === 'drivers' ? (
        <div className="space-y-3">
          {drivers.map(driver => (
            <div
              key={driver.id}
              className="bg-gray-800 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="text-xl w-8 text-center">
                {rankEmoji(driver.rank)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">
                    {driver.name}
                  </span>
                  <span className="text-xs">
                    {LEVEL_EMOJI[driver.level]}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  {driver.totalDeliveries} deliveries •
                  Trust: {driver.trustScore}
                </p>
              </div>
              <div className="text-right">
                <div className="text-green-400 font-bold text-sm">
                  {driver.totalKgRescued}kg
                </div>
                <div className="text-gray-500 text-xs">rescued</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {donors.map(donor => (
            <div
              key={donor.id}
              className="bg-gray-800 rounded-xl p-3 flex items-center gap-3"
            >
              <div className="text-xl w-8 text-center">
                {rankEmoji(donor.rank)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">
                    {donor.name}
                  </span>
                  <span className="text-xs">
                    {DONOR_BADGE_EMOJI[donor.badgeLevel]}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">
                  {donor.totalDonations} donations
                </p>
              </div>
              <div className="text-right">
                <div className="text-orange-400 font-bold text-sm">
                  {donor.totalKgDonated}kg
                </div>
                <div className="text-gray-500 text-xs">donated</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}