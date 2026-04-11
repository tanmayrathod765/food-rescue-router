import { useState, useEffect, useRef } from 'react'

export default function ImpactNotification({ events }) {
  const [notification, setNotification] = useState(null)
  const simulationActiveRef = useRef(false)
  const simulationNotificationShownRef = useRef(false)
  const pendingImpactRef = useRef(null)
  const pendingSimulationImpactRef = useRef(null)

  useEffect(() => {
    if (!events || events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent) return

    if (latestEvent.event === 'simulation:active') {
      const active = !!latestEvent.data?.active
      simulationActiveRef.current = active

      if (active) {
        // New simulation run start.
        simulationNotificationShownRef.current = false
        pendingImpactRef.current = null
        pendingSimulationImpactRef.current = null
      }

      // Simulation complete hone par ek hi final impact popup dikhao.
      if (!active) {
        const queuedImpact = pendingImpactRef.current || pendingSimulationImpactRef.current || {
          donor: {
            message: '🎬 Simulation completed successfully',
            stats: {
              meals: 0,
              co2Saved: 0,
              moneyValue: 0
            }
          },
          driver: { milestone: null }
        }
        pendingImpactRef.current = null
        pendingSimulationImpactRef.current = null

        if (queuedImpact && !simulationNotificationShownRef.current) {
          simulationNotificationShownRef.current = true
          void Promise.resolve().then(() => {
            setNotification(queuedImpact)
          })
        }
      }
      return
    }

    if (latestEvent.event === 'simulation:log' && simulationActiveRef.current) {
      const label = latestEvent.data?.label || ''

      // Agar impact:report event na aaye to simulation delivery log se fallback popup banao.
      if (/delivered|meals provided/i.test(label)) {
        const kgMatch = label.match(/(\d+(?:\.\d+)?)kg/i)
        const mealsMatch = label.match(/~(\d+)\s*meals/i)

        const kg = kgMatch ? Number(kgMatch[1]) : 0
        const meals = mealsMatch ? Number(mealsMatch[1]) : Math.round(kg * 2.5)

        pendingSimulationImpactRef.current = {
          donor: {
            message: `🎬 Simulation complete: ~${meals} meals impact demonstrated`,
            stats: {
              meals,
              co2Saved: Math.round(kg * 2.5 * 10) / 10,
              moneyValue: Math.round(kg * 150)
            }
          },
          driver: { milestone: null }
        }
      }
    }

    if (latestEvent.event === 'simulation:log' && !simulationActiveRef.current) {
      const label = latestEvent.data?.label || ''

      // Kuch flows mein completion ke baad delivery log aata hai; tab bhi ek popup dikhao.
      if (/delivered|meals provided/i.test(label) && !simulationNotificationShownRef.current) {
        const kgMatch = label.match(/(\d+(?:\.\d+)?)kg/i)
        const mealsMatch = label.match(/~(\d+)\s*meals/i)

        const kg = kgMatch ? Number(kgMatch[1]) : 0
        const meals = mealsMatch ? Number(mealsMatch[1]) : Math.round(kg * 2.5)

        simulationNotificationShownRef.current = true
        void Promise.resolve().then(() => {
          setNotification({
            donor: {
              message: `🎬 Simulation complete: ~${meals} meals impact demonstrated`,
              stats: {
                meals,
                co2Saved: Math.round(kg * 2.5 * 10) / 10,
                moneyValue: Math.round(kg * 150)
              }
            },
            driver: { milestone: null }
          })
        })
      }
    }

    if (latestEvent.event === 'impact:report') {
      if (simulationActiveRef.current) {
        pendingImpactRef.current = latestEvent.data
      } else {
        const latestImpact = latestEvent.data
        void Promise.resolve().then(() => {
          setNotification(latestImpact)
        })
      }
    }
  }, [events])

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 8000)
    return () => clearTimeout(timer)
  }, [notification])

  if (!notification) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div className="bg-green-900 border border-green-500 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎉</span>
          <span className="text-green-400 font-bold">Impact Report</span>
        </div>

        <p className="text-white text-sm mb-3">
          {notification.donor?.message}
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-800 rounded-lg p-2 text-center">
            <div className="text-white font-bold">
              ~{notification.donor?.stats?.meals}
            </div>
            <div className="text-green-400 text-xs">Meals</div>
          </div>
          <div className="bg-green-800 rounded-lg p-2 text-center">
            <div className="text-white font-bold">
              {notification.donor?.stats?.co2Saved}kg
            </div>
            <div className="text-green-400 text-xs">CO₂ Saved</div>
          </div>
          <div className="bg-green-800 rounded-lg p-2 text-center">
            <div className="text-white font-bold">
              ₹{notification.donor?.stats?.moneyValue}
            </div>
            <div className="text-green-400 text-xs">Value</div>
          </div>
        </div>

        {notification.driver?.milestone && (
          <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg px-3 py-2 text-yellow-400 text-sm">
            {notification.driver.milestone}
          </div>
        )}

        <button
          onClick={() => setNotification(null)}
          className="mt-3 text-gray-400 text-xs hover:text-white"
        >
          Dismiss ×
        </button>
      </div>
    </div>
  )
}