const express = require('express')
const cors = require('cors')
const systemRoutes = require('./routes/systemRoutes')
const imageRoutes = require('./routes/imageRoutes')
const authRoutes = require('./routes/authRoutes')
const { requireAuth, requireNotBanned, requireAdmin } = require('./middleware/authMiddleware')
const adminRoutes = require('./routes/adminRoutes')
const settingsRoutes = require('./routes/settingsRoutes')
const canvasRoutes = require('./routes/canvasRoutes')
const avatarRoutes = require('./routes/avatarRoutes')
const recordRoutes = require('./routes/recordRoutes')
const payRoutes = require('./routes/payRoutes')
const { resolveFrontendBaseFromReq } = require('./utils/publicUrls')

const app = express()

app.use(cors())
// 系统设置含邮件 HTML 等，默认 100kb 易被拒导致前端解析失败
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: false, limit: '5mb' }))

app.get('/', (req, res) => {
  const q = req.query || {}
  const looksLikePayReturn =
    q.trade_status != null ||
    q.out_trade_no != null ||
    (String(q.recharge || '') === '1' && (q.sign != null || q.trade_no != null))
  if (looksLikePayReturn) {
    const front = resolveFrontendBaseFromReq(req)
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) {
      if (v !== undefined && v !== null && String(v) !== '') qs.append(k, String(v))
    }
    const tail = qs.toString()
    return res.redirect(302, tail ? `${front}/?${tail}` : `${front}/`)
  }
  res.status(200).json({ message: '欢迎使用万米画布后端 API' })
})

app.use('/api', systemRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/images', requireAuth, requireNotBanned, imageRoutes)
app.use('/api/settings', requireAuth, requireNotBanned, settingsRoutes)
app.use('/api/canvases', requireAuth, requireNotBanned, canvasRoutes)
app.use('/api/avatars', requireAuth, requireNotBanned, avatarRoutes)
app.use('/api/records', requireAuth, requireNotBanned, recordRoutes)
app.use('/api/pay', payRoutes)
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' })
})

app.use((err, _req, res, _next) => {
  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ error: '请求体过大，请缩短邮件模板等内容后重试' })
    return
  }
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    res.status(400).json({ error: '请求 JSON 无效' })
    return
  }
  res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500).json({
    error: err.message || '服务器错误',
  })
})

module.exports = app
