const express = require('express')
const {
  listApiConfigs,
  createApiConfig,
  deleteApiConfig,
  getSystemSettings,
  updateSystemSettings,
} = require('../controllers/settingsController')
const { requireAdmin } = require('../middleware/authMiddleware')

const router = express.Router()

router.use(requireAdmin)
router.get('/interfaces', listApiConfigs)
router.post('/interfaces', createApiConfig)
router.delete('/interfaces/:id', deleteApiConfig)
router.get('/system', getSystemSettings)
router.put('/system', updateSystemSettings)

module.exports = router
