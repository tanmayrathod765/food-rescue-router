import { useState, useEffect } from 'react'
import api from '../utils/api'

const LEVEL_STYLES = {
  ROOKIE:  { emoji: '🌱', label: 'Rookie',  bg: 'bg-gray-600' },
  RISING:  { emoji: '⭐', label: 'Rising',  bg: 'bg-blue-600' },
  HERO:    { emoji: '🦸', label: 'Hero',    bg: 'bg-purple-600' },
  LEGEND:  { emoji: '👑', label: 'Legend',  bg: 'bg-yellow-600' }
}

export default function Achievements({ entityId, entityType }) {
  const [badges, setBadges] = useState([])
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityId) return
    Promise.all([
      api.get(`/api/gamification/badges/${entityId}`),
      api.get(`/api/gamification/streak/${entityId}`)
    ])
      .then(([badgesRes, streakRes]) => {
        setBadges(badgesRes.data.data || [])
        setStreak(streakRes.data.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [entityId])

  if (loading) return null

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <h2 className="text-lg font-bold text-green-400 mb-4">
        🏆 Achievements
      </h2>

      {/* Streak */}
      {streak && (
        <div className="bg-orange-500 bg-opacity-10 border border-orange-500 border-opacity-30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-white font-bold">
                  {streak.currentStreak} Day Streak
                </p>
                <p className="text-gray-400 text-xs">
                  Best: {streak.longestStreak} days
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-orange-400 text-2xl font-bold">
                {streak.currentStreak}
              </div>
              <div className="text-gray-500 text-xs">days</div>
            </div>
          </div>

          {/* Streak progress to 7 days */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progress to 7-day badge</span>
              <span>{Math.min(7, streak.currentStreak)}/7</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-orange-500 transition-all"
                style={{
                  width: `${Math.min(100, (streak.currentStreak / 7) * 100)}%`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      {badges.length === 0 ? (
        <div className="text-center text-gray-500 py-6">
          <div className="text-4xl mb-2">🎯</div>
          <p className="text-sm">No badges yet</p>
          <p className="text-xs mt-1">
            Complete deliveries to earn badges!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {badges.map(badge => (
            <div
              key={badge.id}
              className="bg-gray-800 rounded-xl p-3 border border-gray-700"
            >
              <div className="text-2xl mb-1">
                {badge.badgeName.split(' ')[0]}
              </div>
              <p className="text-white text-xs font-bold">
                {badge.badgeName.split(' ').slice(1).join(' ')}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {badge.description}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {new Date(badge.earnedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}