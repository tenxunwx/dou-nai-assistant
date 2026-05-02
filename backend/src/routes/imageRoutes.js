const express = require('express')
const multer = require('multer')
const {
  generateImage,
  getImageTask,
  parseAlbum,
  importFromUrls,
  uploadReferenceImage,
  downloadImageProxy,
} = require('../controllers/imageController')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

router.get('/download-proxy', downloadImageProxy)
router.post('/generate', generateImage)
router.get('/task/:taskId', getImageTask)
router.post('/parse-album', parseAlbum)
router.post('/import-from-urls', importFromUrls)
router.post('/upload', upload.single('image'), uploadReferenceImage)

module.exports = router
