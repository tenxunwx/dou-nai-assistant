const express = require('express')
const { register, registerSendCode, login, me, updateAvatar } = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/register/send-code', registerSendCode)
router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, me)
router.patch('/avatar', requireAuth, updateAvatar)

module.exports = router
