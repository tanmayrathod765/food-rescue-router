import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'

export const useGPS = (driverId, isAvailable) => {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const [tracking, setTracking] = useState(false)
  const watchIdRef = useRef(null)
  const intervalRef = useRef(null)

  const updateLocationToServer = async (lat, lng) => {
    if (!driverId) return
    try {
      await api.put(`/api/drivers/${driverId}/location`, { lat, lng })
    } catch (err) {
      console.error('Location update failed:', err)
    }
  }

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported in this browser')
      return
    }

    setTracking(true)

    // Real-time watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setLocation({ lat: latitude, lng: longitude })
        updateLocationToServer(latitude, longitude)
      },
      (err) => {
        setError(err.message)
        // Fallback — Indore location use karo
        setLocation({ lat: 22.7196, lng: 75.8577 })
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    )

    // Har 10 seconds mein bhi update karo
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ lat: latitude, lng: longitude })
          updateLocationToServer(latitude, longitude)
        },
        () => {} // Silent fail
      )
    }, 10000)
  }

  const stopTracking = () => {
    setTracking(false)
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // isAvailable hone pe auto start
  useEffect(() => {
    if (isAvailable && driverId) {
      startTracking()
    } else {
      stopTracking()
    }
    return () => stopTracking()
  }, [isAvailable, driverId])

  return { location, error, tracking, startTracking, stopTracking }
}