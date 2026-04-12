export default function FoodSafetyBadge({ score, label, emoji, recommendation }) {
  const getColors = () => {
    if (score >= 90) return {
      bg: 'bg-green-500 bg-opacity-10',
      border: 'border-green-500',
      text: 'text-green-400',
      bar: 'bg-green-500'
    }
    if (score >= 70) return {
      bg: 'bg-yellow-500 bg-opacity-10',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      bar: 'bg-yellow-500'
    }
    if (score >= 50) return {
      bg: 'bg-orange-500 bg-opacity-10',
      border: 'border-orange-500',
      text: 'text-orange-400',
      bar: 'bg-orange-500'
    }
    return {
      bg: 'bg-red-500 bg-opacity-10',
      border: 'border-red-500',
      text: 'text-red-400',
      bar: 'bg-red-500'
    }
  }

  const colors = getColors()

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className={`text-sm font-bold ${colors.text}`}>
            Safety: {label}
          </span>
        </div>
        <span className={`text-lg font-bold ${colors.text}`}>
          {score}/100
        </span>
      </div>

      {/* Score Bar */}
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full ${colors.bar} transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-gray-400 text-xs">{recommendation}</p>
    </div>
  )
}