import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function LiveLocationMap({ location }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!location || !mapRef.current) return undefined

    const { lat, lng, accuracy } = location
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapInstanceRef.current)

    L.marker([lat, lng])
      .addTo(mapInstanceRef.current)
      .bindPopup('Your live location')
      .openPopup()

    if (Number.isFinite(accuracy) && accuracy > 0) {
      L.circle([lat, lng], {
        radius: accuracy,
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(mapInstanceRef.current)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [location])

  if (!location) return null

  return (
    <div className="mt-3">
      <div
        ref={mapRef}
        style={{ height: '220px', borderRadius: '16px' }}
        className="border border-gray-700 overflow-hidden"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>
          📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </span>
        {Number.isFinite(location.accuracy) && location.accuracy > 0 && (
          <span>
            Accuracy: ±{Math.round(location.accuracy)}m
          </span>
        )}
      </div>
    </div>
  )
}
