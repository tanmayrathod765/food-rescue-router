import { useState, useEffect } from 'react'
import api from '../utils/api'

const SCENARIOS = [
  {
    id: 'A',
    name: 'Normal Flow',
    emoji: '🎬',
    description: 'Full food rescue flow — post → match → route → deliver',
    color: 'border-green-500 bg-green-500'
  },
  {
    id: 'B',
    name: 'Race Condition',
    emoji: '⚡',
    description: '2 drivers claim same pickup — DB lock prevents double booking',
    color: 'border-red-500 bg-red-500'
  },
  {
    id: 'C',
    name: 'Dynamic Re-routing',
    emoji: '🔄',
    description: 'New food appears mid-route — TSP recalculates instantly',
    color: 'border-blue-500 bg-blue-500'
  },
  {
    id: 'D',
    name: 'Shelter Full',
    emoji: '🚫',
    description: 'Primary shelter full — system redirects to next shelter',
    color: 'border-yellow-500 bg-yellow-500'
  }
]

export default function SimulationControl({ simLogs, isActive }) {
  const [speed, setSpeed] = useState(1)
  const [running, setRunning] = useState(false)
  const [currentScenario, setCurrentScenario] = useState(null)

  useEffect(() => {
    setRunning(isActive)
  }, [isActive])

  const runScenario = async (scenarioId) => {
    if (running) return
    setRunning(true)
    setCurrentScenario(scenarioId)
    try {
      await api.post('/api/simulation/run', {
        scenario: scenarioId,
        speed
      })
    } catch (err) {
      console.error(err)
      setRunning(false)
    }
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">
            🎮 Simulation Mode
          </h2>
          <p className="text-gray-400 text-sm">
            Live algorithm demonstrations for judges
          </p>
        </div>
        {running && (
          <div className="flex items-center gap-2 bg-green-500 bg-opacity-20 border border-green-500 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-sm font-bold">
              Scenario {currentScenario} Running...
            </span>
          </div>
        )}
      </div>

      {/* Speed Control */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Simulation Speed</span>
          <span className="text-white font-bold">{speed}x</span>
        </div>
        <div className="flex gap-3">
          {[1, 2, 5].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                speed === s
                  ? 'bg-green-500 text-black'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scenario Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => runScenario(scenario.id)}
            disabled={running}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              running
                ? 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                : currentScenario === scenario.id
                ? `${scenario.color} bg-opacity-20 border-opacity-100`
                : 'border-gray-700 bg-gray-800 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{scenario.emoji}</span>
              <div>
                <span className="text-white font-bold text-sm">
                  Scenario {scenario.id}
                </span>
                <span className="text-gray-400 text-xs ml-2">
                  {scenario.name}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-xs">
              {scenario.description}
            </p>
          </button>
        ))}
      </div>

      {/* Simulation Logs */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400 mb-3">
          📋 Simulation Log
        </h3>
        {simLogs.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-4">
            Run a scenario to see live logs
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {simLogs.map((log, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-sm"
              >
                <span className="text-gray-500 text-xs font-mono flex-shrink-0 mt-0.5">
                  {log.timestamp}
                </span>
                <span className="text-gray-300 text-xs">
                  {log.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}