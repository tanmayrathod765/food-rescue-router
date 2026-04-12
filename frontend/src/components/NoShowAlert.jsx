import { useState, useEffect } from 'react'

export default function NoShowAlert({ events }) {
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    const noshow = events.find(e => e.event === 'noshow:detected')
    const backup = events.find(e => e.event === 'noshow:backup_driver')

    if (noshow) {
      setAlert({
        type: 'noshow',
        message: `⚠️ No-show: ${noshow.data.driverName} did not pick up`,
        sub: 'Trust score penalized. Finding backup driver...',
        color: 'border-red-500 bg-red-900'
      })
      setTimeout(() => setAlert(null), 6000)
    } else if (backup) {
      setAlert({
        type: 'backup',
        message: `✅ Backup: ${backup.data.backupDriver.name} alerted`,
        sub: backup.data.message,
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