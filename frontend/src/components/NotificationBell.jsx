import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function NotificationBell({ events }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [showPanel, setShowPanel] = useState(false)
  const [unread, setUnread] = useState(0)
  const lastHandledEventIdRef = useRef(0)

  useEffect(() => {
    if (!events || events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent || latestEvent.id === lastHandledEventIdRef.current) return
    lastHandledEventIdRef.current = latestEvent.id

    if (latestEvent.event !== 'notification:new') return
    if (latestEvent.data?.userId !== user?.entityId) return

    const newNotif = {
      id: latestEvent.id,
      type: latestEvent.data.type,
      message: latestEvent.data.message,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    }
    setNotifications(prev => [newNotif, ...prev].slice(0, 20))
    setUnread(prev => prev + 1)

    // Browser push notification
    if (
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('🍱 Food Rescue Router', {
        body: latestEvent.data.message,
        icon: '/icon-192.png'
      })
    }
  }, [events, user])

  const requestPermission = async () => {
    if ('Notification' in window) {
      await Notification.requestPermission()
    }
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  const getTypeEmoji = (type) => {
    const emojis = {
      NEW_PICKUP: '🍱',
      PICKUP_CONFIRMED: '✅',
      FOOD_INCOMING: '🚗',
      DELIVERY_COMPLETE: '🎉'
    }
    return emojis[type] || '🔔'
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowPanel(!showPanel)
          requestPermission()
        }}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="absolute right-0 top-10 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h3 className="text-white font-bold">Notifications</h3>
            <div className="flex gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-green-400 text-xs hover:text-green-300"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowPanel(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-800 ${
                    !notif.read ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-xl">
                      {getTypeEmoji(notif.type)}
                    </span>
                    <div className="flex-1">
                      <p className="text-white text-sm">
                        {notif.message}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {notif.timestamp}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-green-400 mt-1 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}