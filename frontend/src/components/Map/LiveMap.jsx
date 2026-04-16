import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'

const ROUTE_FETCH_TIMEOUT_MS = 5000
const ROUTE_FAILURE_COOLDOWN_MS = 30000
const ROUTE_CACHE_MAX_ENTRIES = 200

const routeCache = new Map()
const inFlightRouteRequests = new Map()
const routeFailureCooldownUntil = new Map()
const warnedRouteFailures = new Set()

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
  if (points.length < 2) return null

  const routeKey = buildRouteKey(points)
  const now = Date.now()

  if (routeCache.has(routeKey)) {
    return routeCache.get(routeKey)
  }

  const cooldownUntil = routeFailureCooldownUntil.get(routeKey) || 0
  if (cooldownUntil > now) {
    return null
  }

  if (inFlightRouteRequests.has(routeKey)) {
    return inFlightRouteRequests.get(routeKey)
  }

  const requestPromise = (async () => {
    let timeoutId = null
    try {
      // OSRM format: lng,lat;lng,lat
      const coords = points
        .map(p => `${p[1]},${p[0]}`)
        .join(';')

      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

      const controller = new AbortController()
      timeoutId = setTimeout(() => {
        controller.abort()
      }, ROUTE_FETCH_TIMEOUT_MS)

      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      })

      if (!res.ok) {
        throw new Error(`OSRM responded with ${res.status}`)
      }

      const data = await res.json()

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error(`OSRM response code: ${data.code || 'Unknown'}`)
      }

      // GeoJSON coordinates [lng, lat] → Leaflet [lat, lng]
      const routeCoords = data.routes[0].geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      )

      const routeResult = {
        coords: routeCoords,
        distance: Math.round(data.routes[0].distance / 1000 * 10) / 10,
        duration: Math.round(data.routes[0].duration / 60)
      }

      storeRouteInCache(routeKey, routeResult)
      routeFailureCooldownUntil.delete(routeKey)
      return routeResult
    } catch (err) {
      routeFailureCooldownUntil.set(routeKey, Date.now() + ROUTE_FAILURE_COOLDOWN_MS)

      if (!warnedRouteFailures.has(routeKey)) {
        warnedRouteFailures.add(routeKey)
        console.warn('OSRM route fetch failed; using straight-line fallback for this path.')
      }

      return null
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      inFlightRouteRequests.delete(routeKey)
    }
  })()

  inFlightRouteRequests.set(routeKey, requestPromise)
  return requestPromise
}

export default function LiveMap({ drivers, donors, shelters, routes }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const routeLinesRef = useRef([])
  const routeLegend = useMemo(() => {
    if (!routes || routes.length === 0) return []
    return routes
      .filter(route => route?.label)
      .map((route, index) => ({
        id: `${route.label}-${index}`,
        label: route.label,
        color: route.color || '#22c55e'
      }))
  }, [routes])

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

      // Driver marker pulse animation (available drivers)
      if (driver.isAvailable) {
        const pulseIcon = L.divIcon({
          html: `
            <div style="position:relative">
              <style>
                @keyframes pulse {
                  0% { transform: scale(0.95); opacity: 0.9; }
                  70% { transform: scale(1.2); opacity: 0; }
                  100% { transform: scale(0.95); opacity: 0; }
                }
              </style>
              <div style="
                position:absolute;
                width:50px;height:50px;
                border-radius:50%;
                background:rgba(34,197,94,0.3);
                top:-7px;left:-7px;
                animation:pulse 2s infinite;
              "></div>
              <div style="
                background:#22c55e;
                width:36px;height:36px;
                border-radius:50%;
                border:3px solid white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:16px;
                box-shadow:0 2px 8px rgba(0,0,0,0.4);
                position:relative;z-index:1;
              ">${
                driver.vehicleType === 'BIKE' ? '🚲' :
                driver.vehicleType === 'CAR' ? '🚗' :
                driver.vehicleType === 'VAN' ? '🚐' : '🚛'
              }</div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          className: ''
        })
        marker.setIcon(pulseIcon)
      }

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
    const map = mapInstanceRef.current
    if (!map) return
    let cancelled = false

    // Purani lines hatao
    routeLinesRef.current.forEach(l => l.remove())
    routeLinesRef.current = []

    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

    routes.forEach(async (route, i) => {
      if (!route.points || route.points.length < 2) return

      const color = route.color || colors[i % colors.length]
      const routeLabel = route.label || `Route ${i + 1}`

      // OSRM se real road route fetch karo
      const roadRoute = await fetchRoadRoute(route.points)
      if (cancelled || !mapInstanceRef.current) return

      if (roadRoute && roadRoute.coords.length > 0) {
        // Real road route — OSRM
        const line = L.polyline(roadRoute.coords, {
          color,
          weight: 4,
          opacity: 0.85
        }).addTo(map)

        // Route info popup
        line.bindPopup(`
          <div style="font-family:sans-serif">
            <b>${routeLabel}</b><br/>
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
        }).addTo(map)
        routeLinesRef.current.push(line)
      }
    })

    return () => {
      cancelled = true
    }

  }, [routes])

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ height: '500px', width: '100%', borderRadius: '12px' }}
      />

      {routeLegend.length > 0 && (
        <div className="absolute top-3 right-3 bg-gray-900 bg-opacity-90 border border-gray-700 rounded-lg px-3 py-2 z-[500] shadow-lg">
          <p className="text-[11px] text-gray-300 font-semibold mb-2">Route Legend</p>
          <div className="space-y-1.5">
            {routeLegend.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-0.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-gray-200">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function roundCoord(value, precision = 4) {
  const factor = 10 ** precision
  return Math.round(Number(value) * factor) / factor
}

function buildRouteKey(points) {
  return points
    .map(point => `${roundCoord(point[0])},${roundCoord(point[1])}`)
    .join('|')
}

function storeRouteInCache(routeKey, routeValue) {
  routeCache.set(routeKey, routeValue)
  if (routeCache.size <= ROUTE_CACHE_MAX_ENTRIES) return

  const oldestKey = routeCache.keys().next().value
  if (oldestKey) routeCache.delete(oldestKey)
}