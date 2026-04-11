export default function StatsBar({ stats }) {
  const items = [
    {
      label: 'Active Drivers',
      value: stats.activeDrivers || 0,
      emoji: '🚗',
      color: 'text-green-400'
    },
    {
      label: 'Pending Pickups',
      value: stats.pendingPickups || 0,
      emoji: '⏳',
      color: 'text-yellow-400'
    },
    {
      label: 'Deliveries Today',
      value: stats.deliveriesToday || 0,
      emoji: '✅',
      color: 'text-blue-400'
    },
    {
      label: 'Kg Rescued Today',
      value: `${stats.kgDeliveredToday || 0}kg`,
      emoji: '⚖️',
      color: 'text-purple-400'
    },
    {
      label: 'Meals Today',
      value: `~${stats.mealsToday || 0}`,
      emoji: '🍽️',
      color: 'text-orange-400'
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center"
        >
          <div className="text-2xl mb-1">{item.emoji}</div>
          <div className={`text-2xl font-bold ${item.color}`}>
            {item.value}
          </div>
          <div className="text-gray-500 text-xs mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  )
}