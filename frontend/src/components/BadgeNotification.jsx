import { useState, useEffect, useRef } from 'react'

export default function BadgeNotification({ events }) {
  const [notification, setNotification] = useState(null)
  const lastHandledEventIdRef = useRef(0)

  useEffect(() => {
    if (!events || events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent || latestEvent.id === lastHandledEventIdRef.current) return
    lastHandledEventIdRef.current = latestEvent.id

    if (latestEvent.event === 'gamification:badge_earned') {
      setNotification({
        type: 'badge',
        title: '🏅 Badge Earned!',
        message: latestEvent.data.badge.name,
        desc: latestEvent.data.badge.description,
        color: 'border-yellow-500 bg-yellow-900'
      })
      setTimeout(() => setNotification(null), 6000)
    } else if (latestEvent.event === 'gamification:level_up') {
      setNotification({
        type: 'level',
        title: '🎉 Level Up!',
        message: `${latestEvent.data.levelInfo.emoji} ${latestEvent.data.levelInfo.label}`,
        desc: `${latestEvent.data.driverName} reached ${latestEvent.data.levelInfo.label} level!`,
        color: 'border-purple-500 bg-purple-900'
      })
      setTimeout(() => setNotification(null), 6000)
    } else if (latestEvent.event === 'gamification:streak_milestone') {
      setNotification({
        type: 'streak',
        title: '🔥 Streak Milestone!',
        message: `${latestEvent.data.streak} Day Streak!`,
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