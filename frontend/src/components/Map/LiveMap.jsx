import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Default marker icon fix
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

// Custom colored marker
function createColoredMarker(color, emoji) {
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      ">${emoji}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: ''
  })
}

export default function LiveMap({ drivers, donors, shelters, routes }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const routeLinesRef = useRef([])

  // Map initialize karo
  useEffect(() => {
    if (mapInstanceRef.current) return

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [22.7196, 75.8577], // Indore center
      zoom: 13,
      zoomControl: true
    })

    // OpenStreetMap tiles (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current)

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Markers update karo
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Purane markers hatao
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Driver markers
    drivers.forEach(driver => {
      if (!driver.currentLat || !driver.currentLng) return
      const marker = L.marker(
        [driver.currentLat, driver.currentLng],
        {
          icon: createColoredMarker(
            driver.isAvailable ? '#22c55e' : '#6b7280',
            driver.vehicleType === 'BIKE' ? '🚲' :
            driver.vehicleType === 'CAR' ? '🚗' :
            driver.vehicleType === 'VAN' ? '🚐' : '🚛'
          )
        }
      )
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <b>${driver.name}</b><br/>
            ${driver.vehicleType} • ${driver.capacityKg}kg<br/>
            Trust: ${driver.trustScore}/100<br/>
            Status: ${driver.isAvailable ? '✅ Available' : '❌ Offline'}<br/>
            Rescued: ${driver.totalKgRescued}kg
          </div>
        `)
      markersRef.current.push(marker)
    })

    // Donor markers
    donors.forEach(donor => {
      const urgency = donor.latestPosting?.urgencyScore || 0
      const color =
        urgency > 70 ? '#ef4444' :
        urgency > 40 ? '#f59e0b' :
        '#22c55e'

      const marker = L.marker(
        [donor.lat, donor.lng],
        { icon: createColoredMarker(color, '🏪') }
      )
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <b>${donor.name}</b><br/>
            ${donor.address}<br/>
            ${donor.latestPosting
              ? `Food: ${donor.latestPosting.quantityKg}kg<br/>
                 Urgency: ${Math.round(urgency)}/100<br/>
                 Status: ${donor.latestPosting.status}`
              : 'No active posting'
            }
          </div>
        `)
      markersRef.current.push(marker)
    })

    // Shelter markers
    shelters.forEach(shelter => {
      const capacityPct = Math.round(
        (shelter.currentCommittedKg / shelter.maxCapacityKg) * 100
      )
      const color =
        capacityPct > 80 ? '#ef4444' :
        capacityPct > 50 ? '#f59e0b' :
        '#8b5cf6'

      const marker = L.marker(
        [shelter.lat, shelter.lng],
        { icon: createColoredMarker(color, '🏠') }
      )
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:160px">
            <b>${shelter.name}</b><br/>
            ${shelter.address}<br/>
            Capacity: ${shelter.currentCommittedKg}/${shelter.maxCapacityKg}kg
            (${capacityPct}%)<br/>
            Accepting: ${shelter.isAccepting ? '✅ Yes' : '❌ No'}<br/>
            Hours: ${shelter.acceptingFrom} - ${shelter.acceptingTill}
          </div>
        `)
      markersRef.current.push(marker)
    })

  }, [drivers, donors, shelters])

  // Route lines draw karo
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Purani lines hatao
    routeLinesRef.current.forEach(l => l.remove())
    routeLinesRef.current = []

    routes.forEach(route => {
      if (!route.points || route.points.length < 2) return
      const line = L.polyline(route.points, {
        color: route.color || '#22c55e',
        weight: 3,
        opacity: 0.8,
        dashArray: '8, 4'
      }).addTo(mapInstanceRef.current)
      routeLinesRef.current.push(line)
    })
  }, [routes])

  return (
    <div
      ref={mapRef}
      style={{ height: '500px', width: '100%', borderRadius: '12px' }}
    />
  )
}