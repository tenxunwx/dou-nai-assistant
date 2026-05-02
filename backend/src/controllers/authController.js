const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../config/db')
const { jwtSecret } = require('../config/env')
const { sendRegistrationCodeEmail } = require('../utils/sendRegistrationMail')

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

const normalizeEmail = (value) => `${value || ''}`.trim().toLowerCase()

const emailLooksValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const loadRegisterSettings = async () => {
  const [rows] = await pool.query(
    `SELECT allow_user_register AS allowUserRegister,
            register_mode AS registerMode,
            register_gift_cents AS registerGiftCents
     FROM system_settings WHERE id = 1 LIMIT 1`,
  )
  return (
    rows[0] || {
      allowUserRegister: 1,
      registerMode: 'default',
      registerGiftCents: 0,
    }
  )
}

/**
 * 发送注册邮箱验证码（仅 register_mode = email_verification）
 */
const registerSendCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    if (!emailLooksValid(email)) {
      res.status(400).json({ error: '请输入有效邮箱' })
      return
    }

    const settings = await loadRegisterSettings()
    if (!settings.allowUserRegister) {
      res.status(403).json({ error: '当前已关闭用户注册' })
      return
    }
    if (settings.registerMode !== 'email_verification') {
      res.status(400).json({ error: '当前未启用邮箱验证码注册' })
      return
    }

    const [emailTaken] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
    if (emailTaken.length) {
      res.status(409).json({ error: '该邮箱已注册' })
      return
    }

    await pool.query('DELETE FROM register_email_codes WHERE expires_at < NOW()')

    const [recent] = await pool.query(
      `SELECT id FROM register_email_codes
       WHERE email = ? AND created_at > (NOW() - INTERVAL 55 SECOND) LIMIT 1`,
      [email],
    )
    if (recent.length) {
      res.status(429).json({ error: '发送过于频繁，请 55 秒后再试' })
      return
    }

    await pool.query('DELETE FROM register_email_codes WHERE email = ?', [email])

    const code = String(100000 + Math.floor(Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await pool.query(
      'INSERT INTO register_email_codes (email, code, expires_at) VALUES (?, ?, ?)',
      [email, code, expiresAt],
    )

    await sendRegistrationCodeEmail(email, code)
    res.status(200).json({ ok: true })
  } catch (error) {
    const status =
      error && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500
    res.status(status).json({ error: error.message || '发送失败' })
  }
}

const register = async (req, res) => {
  try {
    const username = `${req.body?.username || ''}`.trim()
    const password = `${req.body?.password || ''}`.trim()
    const email = normalizeEmail(req.body?.email)
    const emailCode = `${req.body?.emailCode || req.body?.code || ''}`.trim()

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

    const settings = await loadRegisterSettings()
    if (!settings.allowUserRegister) {
      res.status(403).json({ error: '当前已关闭用户注册' })
      return
    }

    const role = 'user'
    const passwordHash = await bcrypt.hash(password, 10)

    if (settings.registerMode === 'email_verification') {
      if (!emailLooksValid(email)) {
        res.status(400).json({ error: '请输入有效邮箱' })
        return
      }
      if (!emailCode || emailCode.length < 4) {
        res.status(400).json({ error: '请输入邮箱收到的验证码' })
        return
      }

      const [emailTaken] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
      if (emailTaken.length) {
        res.status(409).json({ error: '该邮箱已注册' })
        return
      }

      const [codeRows] = await pool.query(
        `SELECT id FROM register_email_codes
         WHERE email = ? AND code = ? AND expires_at > NOW() LIMIT 1`,
        [email, emailCode],
      )
      if (!codeRows.length) {
        res.status(400).json({ error: '验证码无效或已过期，请重新获取' })
        return
      }

      const [result] = await pool.query(
        'INSERT INTO users (username, password_hash, role, balance_cents, email) VALUES (?, ?, ?, ?, ?)',
        [username, passwordHash, role, Number(settings.registerGiftCents || 0), email],
      )

      await pool.query('DELETE FROM register_email_codes WHERE email = ?', [email])

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
        email,
      }
      const token = signToken(user)
      res.status(201).json({ token, user })
      return
    }

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
      email: null,
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
      `SELECT id, username, password_hash AS passwordHash, role,
              avatar_url AS avatarUrl, balance_cents AS balanceCents, banned,
              email AS email
       FROM users WHERE username = ? LIMIT 1`,
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
      email: userRow.email || null,
    }
    const token = signToken(user)
    res.status(200).json({ token, user })
  } catch (error) {
    res.status(500).json({ error: error.message || '登录失败' })
  }
}

const me = async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, username, role, avatar_url AS avatarUrl, balance_cents AS balanceCents, banned,
            email AS email
     FROM users WHERE id = ? LIMIT 1`,
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
      email: row.email || null,
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
  registerSendCode,
  login,
  me,
  updateAvatar,
}
