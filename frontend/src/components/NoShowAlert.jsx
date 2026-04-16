import { useState, useEffect, useRef } from 'react'

export default function NoShowAlert({ events }) {
  const [alert, setAlert] = useState(null)
  const lastHandledEventIdRef = useRef(0)

  useEffect(() => {
    if (!events || events.length === 0) return

    const latestEvent = events[0]
    if (!latestEvent || latestEvent.id === lastHandledEventIdRef.current) return
    lastHandledEventIdRef.current = latestEvent.id

    if (latestEvent.event === 'noshow:detected') {
      setAlert({
        type: 'noshow',
        message: `⚠️ No-show: ${latestEvent.data.driverName} did not pick up`,
        sub: 'Trust score penalized. Finding backup driver...',
        color: 'border-red-500 bg-red-900'
      })
      setTimeout(() => setAlert(null), 6000)
    } else if (latestEvent.event === 'noshow:backup_driver') {
      setAlert({
        type: 'backup',
        message: `✅ Backup: ${latestEvent.data.backupDriver.name} alerted`,
        sub: latestEvent.data.message,
        color: 'border-blue-500 bg-blue-900'
      })
      setTimeout(() => setAlert(null), 5000)
    }
  }, [events])

  if (!alert) return null

  return (
    <div className="fixed bottom-24 right-6 z-50 max-w-sm">
      <div className={`${alert.color} border-2 rounded-2xl p-4 shadow-2xl`}>
        <p className="text-white font-bold text-sm">{alert.message}</p>
        <p className="text-gray-300 text-xs mt-1">{alert.sub}</p>
        <button
          onClick={() => setAlert(null)}
          className="text-gray-400 text-xs mt-2 hover:text-white"
        >
          Dismiss ×
        </button>
      </div>
    </div>
  )
}