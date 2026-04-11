export default function AlgorithmPanel({ events, raceConditionsBlocked }) {
  const getEventStyle = (eventName) => {
    if (eventName.includes('blocked'))
      return 'bg-red-500 text-white'
    if (eventName.includes('delivered'))
      return 'bg-green-500 text-black'
    if (eventName.includes('claimed'))
      return 'bg-blue-500 text-white'
    if (eventName.includes('found'))
      return 'bg-purple-500 text-white'
    if (eventName.includes('picked'))
      return 'bg-yellow-500 text-black'
    return 'bg-gray-600 text-white'
  }

  const getEventEmoji = (eventName) => {
    if (eventName.includes('blocked')) return '⚡'
    if (eventName.includes('delivered')) return '✅'
    if (eventName.includes('claimed')) return '🔒'
    if (eventName.includes('found')) return '🎯'
    if (eventName.includes('picked')) return '📦'
    if (eventName.includes('location')) return '📍'
    return '●'
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-green-400">
          🧠 Algorithm Live Log
        </h2>
        {raceConditionsBlocked > 0 && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 rounded-lg px-3 py-1">
            <span className="text-red-400 text-sm font-bold">
              ⚡ {raceConditionsBlocked} Race Conditions Blocked
            </span>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm">Waiting for system events...</p>
          <p className="text-xs mt-1">
            Post food or claim a pickup to see algorithm decisions
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.map((e, i) => (
            <div
              key={i}
              className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-500 text-xs font-mono">
                  {e.timestamp}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${getEventStyle(e.event)}`}>
                  {getEventEmoji(e.event)} {e.event}
                </span>
              </div>

              {/* Event specific details */}
              {e.event === 'matching:driver_found' && e.data && (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p>🎯 Driver matched with score: {e.data.matchScore}</p>
                  {e.data.scoreBreakdown && (
                    <p>
                      📊 Proximity: {e.data.scoreBreakdown.proximity} |
                      Capacity: {e.data.scoreBreakdown.capacity} |
                      Time: {e.data.scoreBreakdown.time} |
                      Trust: {e.data.scoreBreakdown.trust}
                    </p>
                  )}
                </div>
              )}

              {e.event === 'pickup:race_condition_blocked' && (
                <div className="text-xs text-red-400 mt-1">
                  ⚡ Concurrent claim blocked — DB lock prevented double booking
                </div>
              )}

              {e.event === 'pickup:delivered' && e.data && (
                <div className="text-xs text-green-400 mt-1">
                  🍽️ {e.data.kgRescued}kg rescued →
                  ~{Math.round(e.data.kgRescued * 2.5)} meals provided
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}