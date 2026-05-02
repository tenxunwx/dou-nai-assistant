const express = require('express')
const { requireAuth, requireNotBanned } = require('../middleware/authMiddleware')
const { getPayConfig, createRecharge, epayNotify, epayReturn, listMyRecharges } = require('../controllers/payController')

const router = express.Router()

router.get('/config', requireAuth, requireNotBanned, getPayConfig)
router.post('/create-recharge', requireAuth, requireNotBanned, createRecharge)
router.get('/my-recharges', requireAuth, requireNotBanned, listMyRecharges)
router.all('/epay/notify', epayNotify)
router.all('/epay/return', epayReturn)

module.exports = router
