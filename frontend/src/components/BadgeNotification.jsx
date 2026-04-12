import { useState, useEffect } from 'react'

export default function BadgeNotification({ events }) {
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    const badgeEvent = events.find(
      e => e.event === 'gamification:badge_earned'
    )
    const levelEvent = events.find(
      e => e.event === 'gamification:level_up'
    )
    const streakEvent = events.find(
      e => e.event === 'gamification:streak_milestone'
    )

    if (badgeEvent) {
      setNotification({
        type: 'badge',
        title: '🏅 Badge Earned!',
        message: badgeEvent.data.badge.name,
        desc: badgeEvent.data.badge.description,
        color: 'border-yellow-500 bg-yellow-900'
      })
      setTimeout(() => setNotification(null), 6000)
    } else if (levelEvent) {
      setNotification({
        type: 'level',
        title: '🎉 Level Up!',
        message: `${levelEvent.data.levelInfo.emoji} ${levelEvent.data.levelInfo.label}`,
        desc: `${levelEvent.data.driverName} reached ${levelEvent.data.levelInfo.label} level!`,
        color: 'border-purple-500 bg-purple-900'
      })
      setTimeout(() => setNotification(null), 6000)
    } else if (streakEvent) {
      setNotification({
        type: 'streak',
        title: '🔥 Streak Milestone!',
        message: `${streakEvent.data.streak} Day Streak!`,
        desc: 'Keep it up — you\'re on fire!',
        color: 'border-orange-500 bg-orange-900'
      })
      setTimeout(() => setNotification(null), 6000)
    }
  }, [events])

  if (!notification) return null

  return (
    <div className="fixed top-20 right-6 z-50 max-w-sm">
      <div className={`${notification.color} border-2 rounded-2xl p-5 shadow-2xl animate-bounce`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">
            {notification.type === 'badge' ? '🏅' :
             notification.type === 'level' ? '⬆️' : '🔥'}
          </span>
          <span className="text-white font-bold">
            {notification.title}
          </span>
        </div>
        <p className="text-white text-lg font-bold mb-1">
          {notification.message}
        </p>
        <p className="text-gray-300 text-sm">
          {notification.desc}
        </p>
        <button
          onClick={() => setNotification(null)}
          className="mt-3 text-gray-400 text-xs hover:text-white"
        >
          Dismiss ×
        </button>
      </div>
    </div>
  )
}