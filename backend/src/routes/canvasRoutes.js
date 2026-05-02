const express = require('express')
const { listCanvases, upsertCanvas } = require('../controllers/canvasController')

const router = express.Router()

router.get('/', listCanvases)
router.put('/:canvasId', upsertCanvas)

module.exports = router
