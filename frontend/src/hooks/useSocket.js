import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

function resolveSocketUrl() {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    return isLocal ? 'http://localhost:5000' : origin
  }

  return 'http://localhost:5000'
}

function shouldCaptureEvent(user, event, data) {
  if (!user) return false
  if (user.role === 'ADMIN') return true

  const entityId = user.entityId
  const scopedEntityId = data?.userId || data?.entityId || null

  if (scopedEntityId && scopedEntityId !== entityId && scopedEntityId !== user.id) {
    return false
  }

  if (user.role === 'DRIVER' && data?.driverId && data.driverId !== entityId) {
    return false
  }

  if (user.role === 'SHELTER' && data?.shelterId && data.shelterId !== entityId) {
    return false
  }

  if (user.role === 'RESTAURANT') {
    const donorScopedId = data?.donorId || data?.restaurantId || null
    if (donorScopedId && donorScopedId !== entityId) {
      return false
    }
  }

  if (event.startsWith('notification:') && !scopedEntityId && user.role !== 'ADMIN') {
    return false
  }

  return true
}

export const useSocket = (user = null) => {
  const socketRef = useRef(null)
  const eventCounterRef = useRef(0)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])

  useEffect(() => {
    const socketUrl = resolveSocketUrl()

    socketRef.current = io(
      socketUrl,
      {
        transports: ['polling'],
        upgrade: false,
        withCredentials: true,
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      }
    )

    socketRef.current.on('connect', () => {
      setConnected(true)
    })

    socketRef.current.on('disconnect', () => {
      setConnected(false)
    })

    // Algorithm events capture karo
    const algorithmEvents = [
      'matching:driver_found',
      'matching:no_drivers',
      'matching:no_match',
      'pickup:claimed',
      'pickup:race_condition_blocked',
      'pickup:picked_up',
      'pickup:delivered',
      'impact:report',
      'driver:location:update',
      'simulation:log',
      'simulation:active',
      'simulation:started',
      'simulation:completed',
      'noshow:detected',
      'noshow:backup_driver',
      'gamification:badge_earned',
      'gamification:streak_milestone',
      'gamification:level_up',
      'notification:new',
      'otp:generated',
      'otp:restaurant_notified',
      'otp:verified',
      'otp:delivery_generated',
      'otp:delivery_verified',
      'delivery:photo_uploaded',
      'sms:log',
      'shelter:assigned',
      'shelter:driver_reported'
    ]

    algorithmEvents.forEach(event => {
      socketRef.current.on(event, (data) => {
        if (!shouldCaptureEvent(user, event, data)) {
          return
        }
        const eventId = eventCounterRef.current + 1
        eventCounterRef.current = eventId
        setEvents(prev => [{
          id: eventId,
          event,
          data,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50))
      })
    })

    return () => {
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [user])

  const emit = (event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data)
  }

  return { socketRef, connected, events, emit }
}