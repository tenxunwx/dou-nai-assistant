const express = require('express')
const { listAvatars, generateAvatar } = require('../controllers/avatarController')

const router = express.Router()

router.get('/', listAvatars)
router.post('/generate', generateAvatar)

module.exports = router
