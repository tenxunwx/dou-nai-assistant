const express = require('express')
const {
  listUsers,
  patchUserBanned,
  postUserBalance,
  getUserBalanceHistory,
  listUserGenerationRecords,
  resetUserPassword,
} = require('../controllers/adminUserController')

const router = express.Router()

router.get('/users', listUsers)
router.patch('/users/:id/banned', patchUserBanned)
router.post('/users/:id/balance', postUserBalance)
router.get('/users/:id/balance-history', getUserBalanceHistory)
router.get('/users/:id/generation-records', listUserGenerationRecords)
router.post('/users/:id/reset-password', resetUserPassword)

module.exports = router
