const { publicAppUrl, frontendUrl, port } = require('../config/env')

const resolvePublicBaseFromReq = (req) => {
  if (publicAppUrl) return publicAppUrl.replace(/\/$/, '')
  const host = req.get('x-forwarded-host') || req.get('host')
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
  return `${proto}://${host}`.replace(/\/$/, '')
}

/**
 * 支付完成后的浏览器跳转目标（前端 SPA）。
 * 未配置 FRONTEND_URL 时，开发环境若 API 在 localhost:PORT，则默认指向 Vite :5173，避免与 API 同端口打开 JSON。
 */
const resolveFrontendBaseFromReq = (req) => {
  if (frontendUrl) return frontendUrl.replace(/\/$/, '')
  const publicBase = resolvePublicBaseFromReq(req)
  try {
    const u = new URL(publicBase)
    const apiPort = String(port)
    if (
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1', '::1'].includes(u.hostname) &&
      u.port === apiPort
    ) {
      const h = u.hostname === '::1' ? '127.0.0.1' : u.hostname
      return `http://${h}:5173`
    }
  } catch (_) {
    /* ignore */
  }
  return publicBase
}

module.exports = { resolvePublicBaseFromReq, resolveFrontendBaseFromReq }
