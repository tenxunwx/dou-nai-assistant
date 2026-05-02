const express = require('express')
const { listGenerationRecords } = require('../controllers/recordController')

const router = express.Router()

router.get('/', listGenerationRecords)

module.exports = router

