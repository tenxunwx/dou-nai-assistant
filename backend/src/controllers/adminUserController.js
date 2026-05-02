const bcrypt = require('bcryptjs')
const { pool } = require('../config/db')

const parseId = (req) => {
  const id = Number(req.params.id)
  return Number.isFinite(id) && id > 0 ? id : 0
}

const listUsers = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, role,
              balance_cents AS balanceCents,
              banned,
              avatar_url AS avatarUrl,
              created_at AS createdAt
       FROM users
       ORDER BY id DESC
       LIMIT 500`,
    )
    res.status(200).json({
      items: rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        balanceCents: Number(r.balanceCents || 0),
        banned: Boolean(Number(r.banned)),
        avatarUrl: r.avatarUrl || null,
        createdAt: r.createdAt,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取用户列表失败' })
  }
}

const patchUserBanned = async (req, res) => {
  try {
    const id = parseId(req)
    if (!id) {
      res.status(400).json({ error: '无效用户 ID' })
      return
    }
    if (id === req.auth.id) {
      res.status(400).json({ error: '不能封禁自己的账号' })
      return
    }
    const wantBanned = Boolean(req.body?.banned)
    const [[target]] = await pool.query('SELECT role FROM users WHERE id = ? LIMIT 1', [id])
    if (!target) {
      res.status(404).json({ error: '用户不存在' })
      return
    }
    if (target.role === 'admin' && wantBanned) {
      res.status(400).json({ error: '不能封禁管理员账号' })
      return
    }
    await pool.query('UPDATE users SET banned = ? WHERE id = ?', [wantBanned ? 1 : 0, id])
    res.status(200).json({ ok: true, banned: wantBanned })
  } catch (error) {
    res.status(500).json({ error: error.message || '更新封禁状态失败' })
  }
}

const postUserBalance = async (req, res) => {
  try {
    const id = parseId(req)
    if (!id) {
      res.status(400).json({ error: '无效用户 ID' })
      return
    }
    const addCents = Math.round(Number(req.body?.addCents))
    if (!Number.isFinite(addCents) || addCents === 0) {
      res.status(400).json({ error: 'addCents 必须为有效非零整数（分）' })
      return
    }
    if (Math.abs(addCents) > 50_000_000) {
      res.status(400).json({ error: '单次调整金额过大' })
      return
    }
    const note = `${req.body?.note || ''}`.trim().slice(0, 255) || null

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const [[u]] = await conn.query('SELECT balance_cents AS b FROM users WHERE id = ? FOR UPDATE', [id])
      if (!u) {
        await conn.rollback()
        res.status(404).json({ error: '用户不存在' })
        return
      }
      const cur = Number(u.b || 0)
      const next = cur + addCents
      if (next < 0) {
        await conn.rollback()
        res.status(400).json({ error: '扣减后余额不能为负' })
        return
      }
      await conn.query('UPDATE users SET balance_cents = ? WHERE id = ?', [next, id])
      await conn.query(
        'INSERT INTO admin_balance_adjustments (user_id, delta_cents, admin_user_id, note) VALUES (?, ?, ?, ?)',
        [id, addCents, req.auth.id, note],
      )
      await conn.commit()
      res.status(200).json({ ok: true, balanceCents: next })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (error) {
    res.status(500).json({ error: error.message || '调整余额失败' })
  }
}

const getUserBalanceHistory = async (req, res) => {
  try {
    const id = parseId(req)
    if (!id) {
      res.status(400).json({ error: '无效用户 ID' })
      return
    }
    const [exists] = await pool.query('SELECT id FROM users WHERE id = ? LIMIT 1', [id])
    if (!exists.length) {
      res.status(404).json({ error: '用户不存在' })
      return
    }
    const [rows] = await pool.query(
      `SELECT kind, ts, deltaCents, label, ref FROM (
         SELECT 'recharge' AS kind, paid_at AS ts, money_cents AS deltaCents,
                CONCAT('在线充值 ', out_trade_no) AS label, out_trade_no AS ref
         FROM pay_recharge_orders
         WHERE user_id = ? AND status = 'paid' AND paid_at IS NOT NULL
         UNION ALL
         SELECT 'generation' AS kind, created_at AS ts, -cost_cents AS deltaCents,
                CONCAT('生成消费 #', id) AS label, CAST(id AS CHAR) AS ref
         FROM generation_records
         WHERE user_id = ? AND cost_cents > 0
         UNION ALL
         SELECT 'admin' AS kind, created_at AS ts, delta_cents AS deltaCents,
                COALESCE(note, '管理员调整') AS label, CAST(id AS CHAR) AS ref
         FROM admin_balance_adjustments
         WHERE user_id = ?
       ) t
       ORDER BY ts DESC
       LIMIT 200`,
      [id, id, id],
    )
    res.status(200).json({
      items: rows.map((r) => ({
        kind: r.kind,
        at: r.ts,
        deltaCents: Number(r.deltaCents),
        label: r.label,
        ref: r.ref,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取余额流水失败' })
  }
}

const listUserGenerationRecords = async (req, res) => {
  try {
    const id = parseId(req)
    if (!id) {
      res.status(400).json({ error: '无效用户 ID' })
      return
    }
    const [rows] = await pool.query(
      `SELECT id, prompt, model, size, status, cost_cents AS costCents, error_message AS errorMessage,
              image_url AS imageUrl, created_at AS createdAt
       FROM generation_records
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [id],
    )
    res.status(200).json({ items: rows })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取生成记录失败' })
  }
}

const resetUserPassword = async (req, res) => {
  try {
    const id = parseId(req)
    if (!id) {
      res.status(400).json({ error: '无效用户 ID' })
      return
    }
    const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ? LIMIT 1', [id])
    if (!target) {
      res.status(404).json({ error: '用户不存在' })
      return
    }
    const passwordHash = await bcrypt.hash('123456', 10)
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])
    res.status(200).json({ ok: true, message: '密码已重置为 123456' })
  } catch (error) {
    res.status(500).json({ error: error.message || '重置密码失败' })
  }
}

module.exports = {
  listUsers,
  patchUserBanned,
  postUserBalance,
  getUserBalanceHistory,
  listUserGenerationRecords,
  resetUserPassword,
}
