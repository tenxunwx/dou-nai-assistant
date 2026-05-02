const express = require('express')
const { register, login, me, updateAvatar } = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, me)
router.patch('/avatar', requireAuth, updateAvatar)

module.exports = router
