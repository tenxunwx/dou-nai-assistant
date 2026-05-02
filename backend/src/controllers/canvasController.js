const { pool } = require('../config/db')

const toMysqlDatetime = (value) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const listCanvases = async (req, res) => {
  try {
    const [canvasRows] = await pool.query(
      'SELECT id, created_at AS createdAt FROM canvases WHERE user_id = ? ORDER BY created_at DESC',
      [req.auth.id],
    )
    const [imageRows] = await pool.query(
      `SELECT id, canvas_id AS canvasId, prompt, size, x, y,
              source_image_id AS sourceImageId, status, image_url AS imageUrl,
              error
       FROM canvas_images
       WHERE canvas_id IN (
         SELECT id FROM canvases WHERE user_id = ?
       )
       ORDER BY created_at ASC`,
      [req.auth.id],
    )

    const imagesByCanvas = imageRows.reduce((acc, item) => {
      if (!acc[item.canvasId]) acc[item.canvasId] = []
      acc[item.canvasId].push(item)
      return acc
    }, {})

    const items = canvasRows.map((canvas) => ({
      id: canvas.id,
      createdAt: canvas.createdAt,
      images: imagesByCanvas[canvas.id] || [],
    }))

    res.status(200).json({ items })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取画布失败' })
  }
}

const upsertCanvas = async (req, res) => {
  const connection = await pool.getConnection()
  try {
    const canvasId = `${req.params.canvasId || ''}`.trim()
    const createdAt = toMysqlDatetime(req.body?.createdAt)
    const images = Array.isArray(req.body?.images) ? req.body.images : []
    if (!canvasId) {
      res.status(400).json({ error: 'canvasId 不能为空' })
      return
    }

    await connection.beginTransaction()
    await connection.query(
      `INSERT INTO canvases (id, user_id, created_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), created_at = VALUES(created_at)`,
      [canvasId, req.auth.id, createdAt],
    )

    await connection.query('DELETE FROM canvas_images WHERE canvas_id = ?', [canvasId])
    for (const image of images) {
      await connection.query(
        `INSERT INTO canvas_images
         (id, canvas_id, prompt, size, x, y, source_image_id, status, image_url, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          image.id,
          canvasId,
          image.prompt || '',
          image.size || '1024x1024',
          Number(image.x || 0),
          Number(image.y || 0),
          image.sourceImageId || null,
          image.status || 'completed',
          image.imageUrl || null,
          image.error || null,
        ],
      )
    }
    await connection.commit()
    res.status(200).json({ ok: true })
  } catch (error) {
    await connection.rollback()
    res.status(500).json({ error: error.message || '保存画布失败' })
  } finally {
    connection.release()
  }
}

module.exports = {
  listCanvases,
  upsertCanvas,
}
