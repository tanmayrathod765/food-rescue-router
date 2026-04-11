import { useEffect, useRef } from 'react'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
})

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

/**
 * OSRM se real road route fetch karta hai
 * Free — no API key needed
 */
async function fetchRoadRoute(points) {
  try {
    if (points.length < 2) return null

    // OSRM format: lng,lat;lng,lat
    const coords = points
      .map(p => `${p[1]},${p[0]}`)
      .join(';')

    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url)
    const data = await res.json()

    if (data.code !== 'Ok' || !data.routes?.[0]) return null

    // GeoJSON coordinates [lng, lat] → Leaflet [lat, lng]
    const routeCoords = data.routes[0].geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    )

    return {
      coords: routeCoords,
      distance: Math.round(data.routes[0].distance / 1000 * 10) / 10,
      duration: Math.round(data.routes[0].duration / 60)
    }

  } catch (err) {
    console.warn('OSRM route fetch failed:', err)
    return null
  }
}

export default function LiveMap({ drivers, donors, shelters, routes }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const routeLinesRef = useRef([])

  // Map initialize
  useEffect(() => {
    if (mapInstanceRef.current) return

    mapInstanceRef.current = L.map(mapRef.current, {
      center: [22.7196, 75.8577],
      zoom: 13,
      zoomControl: true
    })

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

  // Markers update
  useEffect(() => {
    if (!mapInstanceRef.current) return

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

  // Road routes draw karo — OSRM se
  useEffect(() => {
    if (!mapInstanceRef.current) return

    // Purani lines hatao
    routeLinesRef.current.forEach(l => l.remove())
    routeLinesRef.current = []

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

    routes.forEach(async (route, i) => {
      if (!route.points || route.points.length < 2) return

      const color = route.color || colors[i % colors.length]

      // OSRM se real road route fetch karo
      const roadRoute = await fetchRoadRoute(route.points)

      if (roadRoute && roadRoute.coords.length > 0) {
        // Real road route — OSRM
        const line = L.polyline(roadRoute.coords, {
          color,
          weight: 4,
          opacity: 0.85
        }).addTo(mapInstanceRef.current)

        // Route info popup
        line.bindPopup(`
          <div style="font-family:sans-serif">
            <b>Route Info</b><br/>
            Distance: ${roadRoute.distance} km<br/>
            Est. Time: ${roadRoute.duration} min
          </div>
        `)

        routeLinesRef.current.push(line)
      } else {
        // Fallback — straight line agar OSRM fail ho
        const line = L.polyline(route.points, {
          color,
          weight: 3,
          opacity: 0.6,
          dashArray: '8, 4'
        }).addTo(mapInstanceRef.current)
        routeLinesRef.current.push(line)
      }
    })

  }, [routes])

  return (
    <div
      ref={mapRef}
      style={{ height: '500px', width: '100%', borderRadius: '12px' }}
    />
  )
}