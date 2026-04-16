function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function ETADisplay({ driverLat, driverLng, donorLat, donorLng }) {
  const hasCoords = [driverLat, driverLng, donorLat, donorLng].every(v => Number.isFinite(v))
  if (!hasCoords) return null

  const distance = haversineDistance(driverLat, driverLng, donorLat, donorLng)
  const etaMinutes = Math.round((distance / 30) * 60)

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className="text-gray-400 text-xs">ETA:</span>
      <span className="text-yellow-400 font-bold text-sm">
        ~{etaMinutes} min ({Math.round(distance * 10) / 10} km away)
      </span>
      {etaMinutes < 10 && (
        <span className="text-xs bg-green-500 bg-opacity-20 text-green-400 px-2 py-0.5 rounded-full">
          Almost here!
        </span>
      )}
    </div>
  )
}
