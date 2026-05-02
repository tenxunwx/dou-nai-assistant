const express = require('express')
const { health, info, getSite } = require('../controllers/systemController')

const router = express.Router()

router.get('/health', health)
router.get('/info', info)
router.get('/site', getSite)

module.exports = router
