const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')
const { jwtSecret } = require('../config/env')

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '7d' },
  )

const register = async (req, res) => {
  try {
    const username = `${req.body?.username || ''}`.trim()
    const password = `${req.body?.password || ''}`.trim()

    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: '密码至少 6 位' })
      return
    }

    const [existsRows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username])
    if (existsRows.length > 0) {
      res.status(409).json({ error: '用户名已存在' })
      return
    }

    const [settingsRows] = await pool.query(
      `SELECT allow_user_register AS allowUserRegister,
              register_mode AS registerMode,
              email_verification_enabled AS emailVerificationEnabled,
              register_gift_cents AS registerGiftCents
       FROM system_settings WHERE id = 1 LIMIT 1`,
    )
    const settings = settingsRows[0] || {
      allowUserRegister: 1,
      registerMode: 'default',
      emailVerificationEnabled: 0,
      registerGiftCents: 0,
    }
    if (!settings.allowUserRegister) {
      res.status(403).json({ error: '当前已关闭用户注册' })
      return
    }
    if (settings.registerMode === 'email_verification' || settings.emailVerificationEnabled) {
      res.status(400).json({ error: '当前已启用邮箱验证注册，请使用邮箱验证流程' })
      return
    }

    const role = 'user'

    const passwordHash = await bcrypt.hash(password, 10)
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, role, balance_cents) VALUES (?, ?, ?, ?)',
      [username, passwordHash, role, Number(settings.registerGiftCents || 0)],
    )

    const defaultCanvasId = `canvas_${result.insertId}_${Date.now()}`
    await pool.query(
      'INSERT INTO canvases (id, user_id, created_at) VALUES (?, ?, ?)',
      [defaultCanvasId, result.insertId, new Date()],
    )

    const user = {
      id: result.insertId,
      username,
      role,
      avatarUrl: null,
      balanceCents: Number(settings.registerGiftCents || 0),
    }
    const token = signToken(user)
    res.status(201).json({ token, user })
  } catch (error) {
    res.status(500).json({ error: error.message || '注册失败' })
  }
}

const login = async (req, res) => {
  try {
    const username = `${req.body?.username || ''}`.trim()
    const password = `${req.body?.password || ''}`.trim()
    if (!username || !password) {
      res.status(400).json({ error: '用户名和密码不能为空' })
      return
    }

    const [rows] = await pool.query(
      'SELECT id, username, password_hash AS passwordHash, role, avatar_url AS avatarUrl, balance_cents AS balanceCents, banned FROM users WHERE username = ? LIMIT 1',
      [username],
    )
    if (rows.length === 0) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }

    const userRow = rows[0]
    const ok = await bcrypt.compare(password, userRow.passwordHash)
    if (!ok) {
      res.status(401).json({ error: '用户名或密码错误' })
      return
    }
    if (Number(userRow.banned) === 1 && userRow.role !== 'admin') {
      res.status(403).json({ error: '账号已被封禁，如有疑问请联系管理员', code: 'BANNED' })
      return
    }

    const user = {
      id: userRow.id,
      username: userRow.username,
      role: userRow.role,
      avatarUrl: userRow.avatarUrl || null,
      balanceCents: Number(userRow.balanceCents || 0),
      banned: Boolean(Number(userRow.banned)),
    }
    const token = signToken(user)
    res.status(200).json({ token, user })
  } catch (error) {
    res.status(500).json({ error: error.message || '登录失败' })
  }
}

const me = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, role, avatar_url AS avatarUrl, balance_cents AS balanceCents, banned FROM users WHERE id = ? LIMIT 1',
    [req.auth.id],
  )
  const row = rows[0]
  if (!row) {
    res.status(404).json({ error: '用户不存在' })
    return
  }
  if (Number(row.banned) === 1 && row.role !== 'admin') {
    res.status(403).json({ error: '账号已被封禁', code: 'BANNED' })
    return
  }
  res.status(200).json({
    user: {
      id: row.id,
      username: row.username,
      role: row.role,
      avatarUrl: row.avatarUrl || null,
      balanceCents: Number(row.balanceCents || 0),
      banned: Boolean(Number(row.banned)),
    },
  })
}

const updateAvatar = async (req, res) => {
  try {
    const avatarUrl = `${req.body?.avatarUrl || ''}`.trim()
    if (!avatarUrl) {
      res.status(400).json({ error: 'avatarUrl 不能为空' })
      return
    }
    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.auth.id])
    res.status(200).json({ ok: true, avatarUrl })
  } catch (error) {
    res.status(500).json({ error: error.message || '更新头像失败' })
  }
}

module.exports = {
  register,
  login,
  me,
  updateAvatar,
}
