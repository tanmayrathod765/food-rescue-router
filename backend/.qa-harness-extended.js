const { PrismaClient } = require('@prisma/client')
const { calculateNoShowRisk } = require('./src/services/noshow.service')

const prisma = new PrismaClient()
const base = 'http://localhost:5000'
const out = []

async function j(url, opts = {}) {
  const r = await fetch(base + url, opts)
  const t = await r.text()
  let b
  try {
    b = JSON.parse(t)
  } catch {
    b = t
  }
  return { status: r.status, body: b }
}

function pass(name, ok, detail) {
  out.push({ name, ok, detail })
}

async function login(email, password) {
  return j('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
}

;(async () => {
  let originalShelter = null
  let originalDriver = null
  try {
    const driverLogin = await login('amit@demo.com', 'demo123')
    const driverToken = driverLogin.body?.token
    const driverId = driverLogin.body?.user?.entityData?.id

    const adminLogin = await login('admin@foodrescue.com', 'admin123')
    const adminToken = adminLogin.body?.token

    pass('T23 Driver login token ready', driverLogin.status === 200 && !!driverToken, driverLogin.status)
    pass('T24 Admin login token ready', adminLogin.status === 200 && !!adminToken, adminLogin.status)

    let r = await j('/api/drivers/available')
    pass('T25 Available drivers endpoint', r.status === 200 && Array.isArray(r.body?.data), (r.body?.data || []).length)

    const myDriver = await prisma.driver.findUnique({ where: { id: driverId } })
    originalDriver = myDriver

    r = await j(`/api/drivers/${driverId}/availability`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({ isAvailable: !(myDriver?.isAvailable ?? false) })
    })
    pass('T26 Driver availability update', r.status === 200 && r.body?.success === true, r.status)

    r = await j(`/api/drivers/${driverId}/location`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({ lat: '', lng: 75.88 })
    })
    pass('T27 Driver location validation', r.status === 400, r.status)

    r = await j(`/api/drivers/${driverId}/location`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({ lat: 22.7422, lng: 75.8891 })
    })
    pass('T28 Driver location update', r.status === 200 && r.body?.success === true, r.status)

    const shelter = await prisma.shelter.findFirst()
    originalShelter = shelter

    r = await j(`/api/shelters/${shelter.id}/capacity`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentCommittedKg: (shelter.currentCommittedKg || 0) + 3 })
    })
    pass('T29 Shelter capacity update', r.status === 200 && r.body?.success === true, r.status)

    r = await j(`/api/shelters/${shelter.id}/accepting`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isAccepting: !shelter.isAccepting })
    })
    pass('T30 Shelter accepting toggle', r.status === 200 && r.body?.success === true, r.status)

    r = await j('/api/admin/expire-old-postings', { method: 'POST' })
    pass('T31 Expire old postings', r.status === 200 && r.body?.success === true, r.status)

    r = await j('/api/simulation/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ speed: 10 })
    })
    pass('T32 Simulation validation', r.status === 400, r.status)

    r = await j('/api/simulation/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario: 'B', speed: 20 })
    })
    pass('T33 Simulation scenario B start', r.status === 200 && r.body?.success === true, r.status)

    const risk = calculateNoShowRisk({ trustScore: 70, noShowCount: 2 })
    pass('T34 No-show risk scoring', Number.isFinite(risk) && risk > 0 && risk <= 100, risk)

    const donors = await j('/api/donors')
    const donorId = donors.body?.data?.[0]?.id
    const driver = await prisma.driver.findUnique({ where: { id: driverId } })

    const post = await j('/api/donors/food-posting', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        donorId,
        foodType: 'BAKERY',
        isVeg: true,
        quantityKg: 6,
        closingTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        timeSinceCooked: 20,
        isRefrigerated: true
      })
    })

    let t35ok = false
    if (post.status === 201) {
      const foodPostingId = post.body?.data?.id
      const claim = await j('/api/pickups/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foodPostingId, driverId: driver.id, shelterId: shelter.id })
      })

      const pickupId = claim.body?.pickup?.id
      if (claim.status === 200 && pickupId) {
        const picked = await j(`/api/pickups/${pickupId}/picked-up`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ driverId: driver.id })
        })

        const delivered = await j(`/api/pickups/${pickupId}/delivered`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ driverId: driver.id })
        })

        t35ok = picked.status === 200 && delivered.status === 200 && delivered.body?.success === true
      }
    }

    pass('T35 Pickup lifecycle API flow', t35ok, t35ok ? 'ok' : 'failed')

    if (originalShelter) {
      await prisma.shelter.update({
        where: { id: originalShelter.id },
        data: {
          currentCommittedKg: originalShelter.currentCommittedKg,
          isAccepting: originalShelter.isAccepting
        }
      })
    }

    if (originalDriver) {
      await prisma.driver.update({
        where: { id: originalDriver.id },
        data: {
          isAvailable: originalDriver.isAvailable,
          currentLat: originalDriver.currentLat,
          currentLng: originalDriver.currentLng
        }
      })
    }

    console.log(JSON.stringify(out, null, 2))
    await prisma.$disconnect()
  } catch (err) {
    console.error('EXT_HARNESS_ERR', err)
    try {
      if (originalShelter) {
        await prisma.shelter.update({
          where: { id: originalShelter.id },
          data: {
            currentCommittedKg: originalShelter.currentCommittedKg,
            isAccepting: originalShelter.isAccepting
          }
        })
      }
      if (originalDriver) {
        await prisma.driver.update({
          where: { id: originalDriver.id },
          data: {
            isAvailable: originalDriver.isAvailable,
            currentLat: originalDriver.currentLat,
            currentLng: originalDriver.currentLng
          }
        })
      }
    } catch (restoreErr) {
      console.error('RESTORE_ERR', restoreErr)
    }
    await prisma.$disconnect()
    process.exit(1)
  }
})()
