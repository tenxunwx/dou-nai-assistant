const jwt = require('jsonwebtoken')
const { jwtSecret } = require('../config/env')
const { pool } = require('../config/db')

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: '未登录或 token 缺失' })
    return
  }

  try {
    const payload = jwt.verify(token, jwtSecret)
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'token 无效或已过期' })
  }
}

const requireAdmin = (req, res, next) => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: '仅管理员可访问' })
    return
  }
  next()
}

/** 封禁用户不可调用需登录的业务接口（管理员除外） */
const requireNotBanned = async (req, res, next) => {
  try {
    if (!req.auth?.id) {
      next()
      return
    }
    if (req.auth.role === 'admin') {
      next()
      return
    }
    const [rows] = await pool.query('SELECT banned FROM users WHERE id = ? LIMIT 1', [req.auth.id])
    if (!rows.length || Number(rows[0].banned) === 1) {
      res.status(403).json({ error: '账号已被封禁，如有疑问请联系管理员', code: 'BANNED' })
      return
    }
    next()
  } catch (error) {
    res.status(500).json({ error: error.message || '校验账号状态失败' })
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireNotBanned,
}
