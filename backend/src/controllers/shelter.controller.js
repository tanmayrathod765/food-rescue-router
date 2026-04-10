const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// GET /api/shelters
const getAllShelters = async (req, res, next) => {
  try {
    const shelters = await prisma.shelter.findMany()
    res.json({ success: true, data: shelters })
  } catch (error) {
    next(error)
  }
}

// PUT /api/shelters/:id/capacity
const updateCapacity = async (req, res, next) => {
  try {
    const { currentCommittedKg } = req.body
    const shelter = await prisma.shelter.update({
      where: { id: req.params.id },
      data: { currentCommittedKg }
    })
    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

// PUT /api/shelters/:id/accepting
const updateAccepting = async (req, res, next) => {
  try {
    const { isAccepting } = req.body
    const shelter = await prisma.shelter.update({
      where: { id: req.params.id },
      data: { isAccepting }
    })
    res.json({ success: true, data: shelter })
  } catch (error) {
    next(error)
  }
}

module.exports = { getAllShelters, updateCapacity, updateAccepting }