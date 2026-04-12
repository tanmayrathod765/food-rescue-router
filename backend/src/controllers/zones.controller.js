const analyzeZones = async (req, res) => {
  // Static baseline zones for dashboard analytics and QA checks.
  const zones = [
    {
      id: 'zone-1',
      name: 'North Zone',
      gapType: 'DRIVER_SHORTAGE',
      demandScore: 86,
      supplyScore: 62,
      pendingPickups: 12,
      activeDrivers: 5
    },
    {
      id: 'zone-2',
      name: 'South Zone',
      gapType: 'SHELTER_CAPACITY',
      demandScore: 74,
      supplyScore: 58,
      pendingPickups: 9,
      activeDrivers: 6
    },
    {
      id: 'zone-3',
      name: 'East Zone',
      gapType: 'BALANCED',
      demandScore: 63,
      supplyScore: 66,
      pendingPickups: 6,
      activeDrivers: 7
    },
    {
      id: 'zone-4',
      name: 'West Zone',
      gapType: 'HIGH_URGENCY_FOOD',
      demandScore: 91,
      supplyScore: 69,
      pendingPickups: 14,
      activeDrivers: 8
    },
    {
      id: 'zone-5',
      name: 'Central Zone',
      gapType: 'TRAFFIC_DELAY',
      demandScore: 79,
      supplyScore: 64,
      pendingPickups: 8,
      activeDrivers: 6
    }
  ]

  res.json({
    success: true,
    data: zones,
    generatedAt: new Date().toISOString()
  })
}

module.exports = { analyzeZones }
