const { pool } = require('../config/db')
const { uploadToPublicGallery } = require('../utils/publicImageUploader')
const { getActiveUpstreamConfig } = require('../utils/upstreamConfig')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const buildUpstreamUrl = (apiRoot, path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${apiRoot}${cleanPath}`
}

const requestUpstream = async (config, path, options = {}) => {
  const response = await fetch(buildUpstreamUrl(config.apiRoot, path), {
    ...options,
    headers: {
      Authorization: config.authHeader,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  let data = {}
  try {
    data = await response.json()
  } catch {
    data = {}
  }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || '上游接口请求失败')
    error.statusCode = response.status
    throw error
  }
  return data
}

const listAvatars = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.image_url AS imageUrl, a.prompt, a.created_at AS createdAt,
              u.username AS creatorUsername
       FROM avatar_repository a
       JOIN users u ON u.id = a.creator_user_id
       ORDER BY a.id DESC
       LIMIT 80`,
    )
    res.status(200).json({ items: rows })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取头像仓库失败' })
  }
}

const generateAvatar = async (req, res) => {
  try {
    const upstream = await getActiveUpstreamConfig()
    const prompt = `${req.body?.prompt || ''}`.trim()
    if (!prompt) {
      res.status(400).json({ error: 'prompt 不能为空' })
      return
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM avatar_repository
       WHERE creator_user_id = ?
         AND DATE(created_at) = CURDATE()`,
      [req.auth.id],
    )
    const usedToday = Number(countRows[0]?.total || 0)
    if (usedToday >= 3) {
      res.status(429).json({ error: '今日头像生成次数已达上限（3次）', remaining: 0 })
      return
    }

    const submitResult = await requestUpstream(upstream, '/v1/videos', {
      method: 'POST',
      body: JSON.stringify({
        model: upstream.model || 'gpt-image-2',
        prompt,
        metadata: {
          size: '1024x1024',
          urls: [],
        },
      }),
    })

    const taskId = submitResult.id
    let lastResult = submitResult
    const maxAttempts = 40
    const intervalMs = 2500
    for (let i = 0; i < maxAttempts; i += 1) {
      if (lastResult.status === 'completed' || lastResult.status === 'failed') break
      await sleep(intervalMs)
      lastResult = await requestUpstream(upstream, `/v1/videos/${taskId}`, { method: 'GET' })
    }

    if (lastResult.status !== 'completed' || !lastResult.video_url) {
      res.status(400).json({ error: lastResult?.error?.message || '头像生成失败' })
      return
    }

    const publicImageUrl = await uploadToPublicGallery(lastResult.video_url)

    await pool.query(
      'INSERT INTO avatar_repository (image_url, prompt, creator_user_id) VALUES (?, ?, ?)',
      [publicImageUrl, prompt, req.auth.id],
    )
    res.status(200).json({
      imageUrl: publicImageUrl,
      sourceImageUrl: lastResult.video_url,
      remaining: Math.max(0, 2 - usedToday),
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '头像生成失败' })
  }
}

module.exports = {
  listAvatars,
  generateAvatar,
}
