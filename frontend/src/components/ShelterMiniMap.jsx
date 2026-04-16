import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function ShelterMiniMap({ shelter, donor }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!shelter || !mapRef.current) return undefined

    const hasShelterCoords = Number.isFinite(shelter.lat) && Number.isFinite(shelter.lng)
    if (!hasShelterCoords) return undefined

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [shelter.lat, shelter.lng],
      zoom: 13,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current)

    L.marker([shelter.lat, shelter.lng])
      .addTo(mapInstanceRef.current)
      .bindPopup(`<b>${shelter.name}</b>`)

    const hasDonorCoords = donor && Number.isFinite(donor.lat) && Number.isFinite(donor.lng)
    if (hasDonorCoords) {
      L.marker([donor.lat, donor.lng])
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>${donor.name}</b>`)

      L.polyline(
        [[donor.lat, donor.lng], [shelter.lat, shelter.lng]],
        { color: '#22c55e', dashArray: '5,5', weight: 2 }
      ).addTo(mapInstanceRef.current)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [shelter, donor])

  if (!shelter) return null

  return (
    <div className="mt-3">
      <p className="text-gray-400 text-xs mb-2">📍 Delivery Route</p>
      <div
        ref={mapRef}
        style={{ height: '150px', borderRadius: '12px' }}
        className="border border-gray-700"
      />
    </div>
  )
}
