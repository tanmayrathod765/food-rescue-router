const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { getAllPickups, claim, pickedUp, delivered } = require('../controllers/pickup.controller')
const prisma = require('../prisma/client')
const { protect, authorize } = require('../middleware/auth.middleware')
const { emitToAll } = require('../services/socket.service')
const { createOTP, verifyOTP } = require('../services/otp.service')

const uploadsRoot = path.join(process.cwd(), 'uploads', 'delivery-photos')
if (!fs.existsSync(uploadsRoot)) {
	fs.mkdirSync(uploadsRoot, { recursive: true })
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, uploadsRoot)
	},
	filename: (req, file, cb) => {
		cb(null, `delivery-${req.params.id}-${Date.now()}${path.extname(file.originalname)}`)
	}
})

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (file.mimetype && file.mimetype.startsWith('image/')) {
			cb(null, true)
			return
		}
		cb(new Error('Only images allowed'))
	}
})

router.get('/', getAllPickups)
router.post('/claim', protect, authorize('DRIVER'), claim)
router.put('/:id/picked-up', protect, authorize('DRIVER'), pickedUp)
router.put('/:id/delivered', protect, authorize('DRIVER'), delivered)

router.post('/:id/generate-otp', protect, async (req, res) => {
	try {
		const { driverId } = req.body || {}
		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id },
			include: {
				foodPosting: {
					include: { donor: true }
				}
			}
		})

		if (!pickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (!pickup.driverId) {
			return res.status(400).json({ success: false, message: 'Pickup has no assigned driver yet' })
		}

		if (driverId && pickup.driverId !== driverId) {
			return res.status(403).json({ success: false, message: 'Only assigned driver can request OTP' })
		}

		const otp = createOTP(req.params.id, pickup.driverId)

		const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		await prisma.pickup.update({
			where: { id: pickup.id },
			data: {
				routeData: {
					...currentRouteData,
					driverArrivedAt: new Date().toISOString(),
					restaurantOtpCode: otp,
					restaurantOtpGeneratedAt: new Date().toISOString(),
					restaurantOtpVerifiedAt: null
				}
			}
		})

		const restaurantNotified = true
		const smsMode = 'dashboard'

		emitToAll('otp:restaurant_notified', {
			pickupId: req.params.id,
			foodPostingId: pickup.foodPostingId,
			driverId: pickup.driverId,
			restaurantNotified,
			smsMode,
			message: 'OTP available on restaurant dashboard'
		})

		emitToAll('otp:generated', {
			pickupId: req.params.id,
			driverId: pickup.driverId,
			foodPostingId: pickup.foodPostingId,
			message: 'Driver has arrived — OTP verification needed'
		})

		res.json({
			success: true,
			restaurantNotified,
			smsMode,
			message: 'OTP generated and shown on restaurant dashboard',
			expiresIn: '10 minutes'
		})
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.post('/:id/verify-otp', protect, async (req, res) => {
	try {
		const { otp, driverId } = req.body
		if (!driverId) {
			return res.status(400).json({ success: false, message: 'driverId is required' })
		}

		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id }
		})

		if (!pickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (pickup.driverId !== driverId) {
			return res.status(403).json({ success: false, message: 'Only assigned driver can verify OTP' })
		}

		const result = verifyOTP(req.params.id, String(otp || '').trim(), driverId)

		if (!result.valid) {
			return res.status(400).json({ success: false, message: result.reason })
		}

		const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		await prisma.pickup.update({
			where: { id: req.params.id },
			data: {
				status: 'IN_PROGRESS',
				pickedUpAt: new Date(),
				routeData: {
					...currentRouteData,
					restaurantOtpVerifiedAt: new Date().toISOString(),
					restaurantOtpCode: null
				}
			}
		})

		emitToAll('otp:verified', {
			pickupId: req.params.id,
			message: 'OTP verified! Driver authenticated.'
		})

		res.json({ success: true, message: 'Driver verified successfully!' })
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.post('/:id/generate-delivery-otp', protect, authorize('SHELTER'), async (req, res) => {
	try {
		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id },
			include: {
				shelter: true,
				driver: true,
				foodPosting: true
			}
		})

		if (!pickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (pickup.shelterId !== req.user.entityId) {
			return res.status(403).json({ success: false, message: 'Only assigned shelter can generate delivery OTP' })
		}

		if (!['CLAIMED', 'IN_PROGRESS'].includes(pickup.status)) {
			return res.status(400).json({ success: false, message: 'Delivery OTP can be generated only for active assigned pickups' })
		}

		if (!pickup.driverId) {
			return res.status(400).json({ success: false, message: 'Pickup has no assigned driver' })
		}

		const otp = createOTP(req.params.id, pickup.driverId, 'delivery')

		const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		await prisma.pickup.update({
			where: { id: pickup.id },
			data: {
				routeData: {
					...currentRouteData,
					shelterDeliveryOtpCode: otp,
					deliveryOtpGeneratedAt: new Date().toISOString(),
					deliveryOtpGeneratedByShelterId: req.user.entityId,
					deliveryOtpVerifiedAt: null
				}
			}
		})

		const shelterNotified = true
		const smsMode = 'dashboard'

		emitToAll('otp:delivery_generated', {
			pickupId: pickup.id,
			driverId: pickup.driverId,
			shelterId: pickup.shelterId,
			shelterNotified,
			smsMode,
			message: 'Delivery OTP generated on shelter dashboard'
		})

		res.json({
			success: true,
			shelterNotified,
			smsMode,
			dashboardOtp: otp,
			message: 'Delivery OTP generated and shown on shelter dashboard',
			expiresIn: '10 minutes'
		})
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.post('/:id/verify-delivery-otp', protect, authorize('DRIVER'), async (req, res) => {
	try {
		const { otp } = req.body || {}

		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id }
		})

		if (!pickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (pickup.driverId !== req.user.entityId) {
			return res.status(403).json({ success: false, message: 'Only assigned driver can verify delivery OTP' })
		}

		const result = verifyOTP(req.params.id, String(otp || '').trim(), req.user.entityId, 'delivery')

		if (!result.valid) {
			return res.status(400).json({ success: false, message: result.reason })
		}

		const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		await prisma.pickup.update({
			where: { id: pickup.id },
			data: {
				routeData: {
					...currentRouteData,
					deliveryOtpVerifiedAt: new Date().toISOString(),
					shelterDeliveryOtpCode: null
				}
			}
		})

		emitToAll('otp:delivery_verified', {
			pickupId: pickup.id,
			driverId: req.user.entityId,
			shelterId: pickup.shelterId,
			message: 'Delivery OTP verified. Driver can complete handoff.'
		})

		res.json({ success: true, message: 'Delivery OTP verified successfully' })
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.post('/:id/delivery-photo', protect, authorize('DRIVER'), upload.single('photo'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Photo file is required' })
		}

		const existingPickup = await prisma.pickup.findUnique({
			where: { id: req.params.id },
			include: { foodPosting: true }
		})

		if (!existingPickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (existingPickup.driverId !== req.user.entityId) {
			return res.status(403).json({ success: false, message: 'Only assigned driver can upload delivery photo' })
		}

		const photoUrl = `/uploads/delivery-photos/${req.file.filename}`
		const currentRouteData = existingPickup.routeData && typeof existingPickup.routeData === 'object' && !Array.isArray(existingPickup.routeData)
			? existingPickup.routeData
			: {}

		await prisma.pickup.update({
			where: { id: req.params.id },
			data: {
				routeData: {
					...currentRouteData,
					deliveryPhotoUrl: photoUrl,
					deliveryPhotoUploadedAt: new Date().toISOString(),
					deliveryPhotoVerifiedAt: null,
					deliveryPhotoVerifiedByDonorId: null
				}
			}
		})

		emitToAll('delivery:photo_uploaded', {
			pickupId: req.params.id,
			foodPostingId: existingPickup.foodPostingId,
			photoUrl,
			message: 'Driver uploaded delivery proof photo'
		})

		res.json({ success: true, photoUrl })
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.post('/:id/verify-delivery-photo', protect, authorize('RESTAURANT'), async (req, res) => {
	try {
		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id },
			include: { foodPosting: true }
		})

		if (!pickup) {
			return res.status(404).json({ success: false, message: 'Pickup not found' })
		}

		if (pickup.foodPosting?.donorId !== req.user.entityId) {
			return res.status(403).json({ success: false, message: 'Only posting restaurant can verify delivery photo' })
		}

		const currentRouteData = pickup.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		if (!currentRouteData.deliveryPhotoUrl) {
			return res.status(400).json({ success: false, message: 'Driver has not uploaded delivery photo yet' })
		}

		const verifiedAt = new Date().toISOString()

		await prisma.pickup.update({
			where: { id: pickup.id },
			data: {
				routeData: {
					...currentRouteData,
					deliveryPhotoVerifiedAt: verifiedAt,
					deliveryPhotoVerifiedByDonorId: req.user.entityId
				}
			}
		})

		emitToAll('delivery:photo_verified', {
			pickupId: pickup.id,
			foodPostingId: pickup.foodPostingId,
			donorId: req.user.entityId,
			verifiedAt,
			message: 'Restaurant verified delivery proof photo'
		})

		res.json({ success: true, message: 'Delivery photo verified by restaurant', verifiedAt })
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

router.get('/:id/delivery-photo', protect, async (req, res) => {
	try {
		const pickup = await prisma.pickup.findUnique({
			where: { id: req.params.id }
		})

		const routeData = pickup?.routeData && typeof pickup.routeData === 'object' && !Array.isArray(pickup.routeData)
			? pickup.routeData
			: {}

		res.json({
			success: true,
			photoUrl: routeData.deliveryPhotoUrl || null,
			verifiedAt: routeData.deliveryPhotoVerifiedAt || null,
			verifiedByDonorId: routeData.deliveryPhotoVerifiedByDonorId || null
		})
	} catch (error) {
		res.status(500).json({ success: false, message: error.message })
	}
})

module.exports = router