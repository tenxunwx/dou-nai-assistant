const { getActiveUpstreamConfig, getUpstreamConfigByModel } = require('../utils/upstreamConfig')
const { pool } = require('../config/db')

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
    const message = data?.error?.message || data?.message || '上游接口请求失败'
    const error = new Error(message)
    error.statusCode = response.status
    throw error
  }

  return data
}

const getTaskResult = async (config, taskId) => {
  const result = await requestUpstream(config, `/v1/videos/${taskId}`, { method: 'GET' })
  return result
}

const parseJsonResponseSafe = async (response) => {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

const extractFirstUrl = (text) => {
  const raw = `${text || ''}`
  const match = raw.match(/https?:\/\/[^\s"'\\<>]+/i)
  return match ? match[0] : ''
}

const parseAlbum = async (req, res) => {
  try {
    const requestURLRaw = `${req.body?.requestURL || ''}`.trim()
    const requestURL = extractFirstUrl(requestURLRaw) || requestURLRaw
    if (!requestURL) {
      res.status(400).json({ error: 'requestURL 不能为空' })
      return
    }

    const upstreamUrl = `https://api.xhus.cn/api/douyin?url=${encodeURIComponent(requestURL)}`
    const upstreamResp = await fetch(upstreamUrl, { method: 'GET' })
    const upstreamData = await parseJsonResponseSafe(upstreamResp)

    if (!upstreamResp.ok) {
      res.status(502).json({ error: '图集解析失败', detail: upstreamData })
      return
    }

    if (Number(upstreamData?.code) !== 200) {
      res.status(400).json({ error: upstreamData?.msg || '图集解析失败', detail: upstreamData })
      return
    }

    const data = upstreamData?.data || {}
    const modeText = `${data?.url || ''}`
    const images = Array.isArray(data?.images) ? data.images : []
    if (modeText.includes('短视频') || images.length === 0) {
      res.status(400).json({
        error: '暂不支持解析短视频链接，请换图文/图集链接',
        mode: modeText || 'video',
        raw: upstreamData,
      })
      return
    }

    res.status(200).json({
      status: 'ok',
      imageUrls: images,
      meta: {
        author: data?.author || '',
        title: data?.title || '',
        cover: data?.cover || '',
        avatar: data?.avatar || '',
      },
      raw: upstreamData,
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '图集解析失败' })
  }
}

const importFromUrls = async (req, res) => {
  try {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : []
    const normalized = Array.from(new Set(urls.map((u) => `${u || ''}`.trim()).filter(Boolean)))
    if (normalized.length === 0) {
      res.status(400).json({ error: 'urls 不能为空' })
      return
    }

    const uploaded = []
    for (const sourceUrl of normalized) {
      const imageUrl = await uploadToPublicGallery(sourceUrl)
      uploaded.push({ sourceUrl, imageUrl })
    }
    res.status(200).json({ items: uploaded })
  } catch (error) {
    res.status(500).json({ error: error.message || '上传公共图库失败' })
  }
}

const uploadReferenceImage = async (req, res) => {
  try {
    const file = req.file
    if (!file || !file.buffer) {
      res.status(400).json({ error: '缺少 image 文件' })
      return
    }
    const mimeType = file.mimetype || 'image/png'
    const fileName = file.originalname || `reference-${Date.now()}`

    const formData = new FormData()
    formData.append('image', new Blob([file.buffer], { type: mimeType }), fileName)

    // 复用公共图库上传：这里直接调用图床 API（避免先落地再转传）
    const { publicUploadApiUrl, publicUploadOutputFormat, publicUploadCdnDomain } = require('../config/env')
    if (publicUploadOutputFormat) formData.append('outputFormat', publicUploadOutputFormat)
    if (publicUploadCdnDomain) formData.append('cdn_domain', publicUploadCdnDomain)

    const uploadResp = await fetch(publicUploadApiUrl, { method: 'POST', body: formData })
    const uploadData = await parseJsonResponseSafe(uploadResp)
    if (!uploadResp.ok || uploadData?.success !== true || !uploadData?.url) {
      res.status(502).json({ error: uploadData?.error || uploadData?.message || '上传公共图库失败', detail: uploadData })
      return
    }

    res.status(200).json({ imageUrl: uploadData.url })
  } catch (error) {
    res.status(500).json({ error: error.message || '上传参考图失败' })
  }
}

const generateImage = async (req, res) => {
  let charged = false
  let recordId = null
  let userId = null
  let chargedCents = 0
  try {
    userId = req.auth.id
    const prompt = `${req.body?.prompt || ''}`.trim()
    const size = `${req.body?.size || '1024x1024'}`.trim()
    const selectedModel = `${req.body?.model || ''}`.trim()
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : []
    const upstream = await getUpstreamConfigByModel(selectedModel)
    chargedCents = Number(upstream.unitCostCents || 0)

    if (!prompt) {
      res.status(400).json({ error: 'prompt 不能为空' })
      return
    }

    // 预扣余额；失败时自动退还
    if (chargedCents > 0) {
      const [deductResult] = await pool.query(
        'UPDATE users SET balance_cents = balance_cents - ? WHERE id = ? AND balance_cents >= ?',
        [chargedCents, userId, chargedCents],
      )
      if (!deductResult.affectedRows) {
        res.status(402).json({ error: '余额不足，请先充值', requiredCents: chargedCents })
        return
      }
      charged = true
    }

    const [recordResult] = await pool.query(
      'INSERT INTO generation_records (user_id, prompt, model, size, status, cost_cents) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, prompt, upstream.model || selectedModel || 'gpt-image-2', size, 'submitting', chargedCents],
    )
    recordId = recordResult.insertId

    const submitResult = await requestUpstream(upstream, '/v1/videos', {
      method: 'POST',
      body: JSON.stringify({
        model: selectedModel || upstream.model || 'gpt-image-2',
        prompt,
        metadata: {
          size,
          urls,
        },
      }),
    })

    const taskId = submitResult.id
    if (!taskId) {
      if (recordId) {
        await pool.query('UPDATE generation_records SET status = ?, error_message = ? WHERE id = ?', [
          'failed',
          '上游返回缺少任务 ID',
          recordId,
        ])
      }
      res.status(502).json({ error: '上游返回缺少任务 ID' })
      return
    }

    let lastResult = submitResult
    const maxAttempts = 40
    const intervalMs = 2500

    for (let i = 0; i < maxAttempts; i += 1) {
      if (lastResult.status === 'completed' || lastResult.status === 'failed') {
        break
      }
      await sleep(intervalMs)
      lastResult = await getTaskResult(upstream, taskId)
    }

    if (lastResult.status === 'completed') {
      if (recordId) {
        await pool.query('UPDATE generation_records SET status = ?, image_url = ?, error_message = NULL WHERE id = ?', [
          'completed',
          lastResult.video_url,
          recordId,
        ])
      }
      const [balanceRows] = await pool.query('SELECT balance_cents AS balanceCents FROM users WHERE id = ? LIMIT 1', [userId])
      res.status(200).json({
        taskId,
        status: 'completed',
        imageUrl: lastResult.video_url,
        sourceImageUrl: lastResult.video_url,
        progress: lastResult.progress ?? 100,
        chargedCents,
        balanceCents: Number(balanceRows[0]?.balanceCents || 0),
      })
      return
    }

    if (lastResult.status === 'failed') {
      if (recordId) {
        await pool.query('UPDATE generation_records SET status = ?, cost_cents = 0, error_message = ? WHERE id = ?', [
          'failed',
          lastResult?.error?.message || '图片生成失败',
          recordId,
        ])
      }
      if (charged && chargedCents > 0) {
        await pool.query('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?', [chargedCents, userId])
      }
      res.status(400).json({
        taskId,
        status: 'failed',
        error: lastResult?.error?.message || '图片生成失败',
      })
      return
    }

    if (recordId) {
      await pool.query('UPDATE generation_records SET status = ? WHERE id = ?', [lastResult.status || 'in_progress', recordId])
    }
    res.status(202).json({
      taskId,
      status: lastResult.status || 'in_progress',
      progress: lastResult.progress ?? 0,
    })
  } catch (error) {
    if (recordId) {
      await pool.query('UPDATE generation_records SET status = ?, cost_cents = 0, error_message = ? WHERE id = ?', [
        'failed',
        error.message || '服务异常',
        recordId,
      ])
    }
    if (charged && chargedCents > 0 && userId) {
      await pool.query('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?', [chargedCents, userId])
    }
    res.status(error.statusCode || 500).json({ error: error.message || '服务异常' })
  }
}

const getImageTask = async (req, res) => {
  try {
    const upstream = await getActiveUpstreamConfig()
    const taskId = req.params.taskId
    if (!taskId) {
      res.status(400).json({ error: 'taskId 不能为空' })
      return
    }
    const result = await getTaskResult(upstream, taskId)
    res.status(200).json({
      taskId,
      status: result.status,
      progress: result.progress ?? 0,
      imageUrl: result.video_url || null,
      error: result?.error?.message || null,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || '服务异常' })
  }
}

const isBlockedDownloadHost = (hostname) => {
  const h = String(hostname || '').toLowerCase()
  if (!h || h === 'localhost') return true
  if (h === '::1' || h.endsWith('.localhost')) return true
  if (/^127\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true
  return false
}

const downloadImageProxy = async (req, res) => {
  const rawUrl = req.query.url
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).json({ error: '缺少 url' })
    return
  }
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    res.status(400).json({ error: '无效 url' })
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: '仅支持 http(s)' })
    return
  }
  if (isBlockedDownloadHost(parsed.hostname)) {
    res.status(403).json({ error: '禁止的地址' })
    return
  }
  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'WanMiHuabuDownload/1.0' },
    })
    if (!upstream.ok) {
      res.status(502).json({ error: '拉取图片失败' })
      return
    }
    const ct = upstream.headers.get('content-type') || 'application/octet-stream'
    if (
      ct &&
      !/^image\//i.test(ct) &&
      !ct.includes('octet-stream') &&
      !ct.includes('binary')
    ) {
      res.status(400).json({ error: '非图片响应' })
      return
    }
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length > 20 * 1024 * 1024) {
      res.status(413).json({ error: '文件过大' })
      return
    }
    res.setHeader('Content-Type', ct)
    res.setHeader('Content-Disposition', `attachment; filename="wanmihuabu-${Date.now()}.png"`)
    res.send(buf)
  } catch (error) {
    res.status(502).json({ error: error.message || '下载失败' })
  }
}

module.exports = {
  generateImage,
  getImageTask,
  parseAlbum,
  importFromUrls,
  uploadReferenceImage,
  downloadImageProxy,
}
