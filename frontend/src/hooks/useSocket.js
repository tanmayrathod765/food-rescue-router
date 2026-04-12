import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export const useSocket = () => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState([])

  useEffect(() => {
    socketRef.current = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
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
      'notification:new'
    ]

    algorithmEvents.forEach(event => {
      socketRef.current.on(event, (data) => {
        setEvents(prev => [{
          event,
          data,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 50))
      })
    })

    return () => {
      if (socketRef.current) socketRef.current.disconnect()
    }
  }, [])

  const emit = (event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data)
  }

  return { socketRef, connected, events, emit }
}