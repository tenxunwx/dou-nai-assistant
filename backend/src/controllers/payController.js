const { pool } = require('../config/db')
const { resolvePublicBaseFromReq, resolveFrontendBaseFromReq } = require('../utils/publicUrls')
const { signParams, verifyNotify } = require('../utils/epaySign')

const mergeRequestParams = (req) => {
  const out = { ...req.query }
  if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body)) {
      if (out[k] === undefined) out[k] = v
    }
  }
  return out
}

/**
 * 网关异步/同步回调里 money 常为 "0.5"，与订单侧 "0.50" 字符串不一致会导致验签通过后仍无法入账。
 * 按「分」比较金额；幂等：已 paid 不重复加余额。
 */
const trySettleRechargeOrder = async (outTradeNo, tradeNo, moneyStr) => {
  const paidCents = Math.round(Number.parseFloat(String(moneyStr || '').trim()) * 100)
  if (!outTradeNo || !Number.isFinite(paidCents)) {
    return { ok: false, reason: 'bad_input' }
  }

  const [orders] = await pool.query(
    'SELECT id, user_id AS userId, money_cents AS moneyCents, status FROM pay_recharge_orders WHERE out_trade_no = ? LIMIT 1',
    [outTradeNo],
  )
  if (orders.length === 0) {
    return { ok: false, reason: 'no_order' }
  }
  const order = orders[0]
  if (paidCents !== Number(order.moneyCents)) {
    return { ok: false, reason: 'amount_mismatch' }
  }

  if (order.status === 'paid') {
    return { ok: true, already: true }
  }

  const [upd] = await pool.query(
    `UPDATE pay_recharge_orders SET status = 'paid', trade_no = ?, paid_at = NOW()
     WHERE out_trade_no = ? AND status = 'pending'`,
    [tradeNo || null, outTradeNo],
  )
  if (upd.affectedRows === 1) {
    await pool.query('UPDATE users SET balance_cents = balance_cents + ? WHERE id = ?', [order.moneyCents, order.userId])
  }
  return { ok: true }
}

const loadPaySettings = async () => {
  const [rows] = await pool.query(
    `SELECT pay_provider AS payProvider,
            epay_submit_url AS epaySubmitUrl,
            epay_pid AS epayPid,
            epay_key AS epayKey,
            site_title AS siteTitle
     FROM system_settings WHERE id = 1 LIMIT 1`,
  )
  return rows[0] || {}
}

const getPayConfig = async (req, res) => {
  try {
    const s = await loadPaySettings()
    const enabled = s.payProvider === 'epay' && s.epaySubmitUrl && s.epayPid && s.epayKey
    res.status(200).json({
      enabled: Boolean(enabled),
      provider: s.payProvider || 'none',
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取支付配置失败' })
  }
}

const createRecharge = async (req, res) => {
  try {
    const userId = req.auth.id
    const amountYuan = Number(req.body?.amountYuan)
    const payType = 'alipay'
    if (!Number.isFinite(amountYuan) || amountYuan < 0.01 || amountYuan > 50000) {
      res.status(400).json({ error: '充值金额需在 0.01～50000 元之间' })
      return
    }

    const s = await loadPaySettings()
    if (s.payProvider !== 'epay' || !s.epaySubmitUrl || !s.epayPid || !s.epayKey) {
      res.status(400).json({ error: '未配置易支付，请联系管理员' })
      return
    }

    const moneyCents = Math.round(amountYuan * 100)
    const moneyStr = (moneyCents / 100).toFixed(2)
    const outTradeNo = `R${Date.now()}${Math.random().toString(36).slice(2, 10)}`.slice(0, 64)

    await pool.query(
      `INSERT INTO pay_recharge_orders (user_id, out_trade_no, money_cents, pay_type, status) VALUES (?, ?, ?, ?, 'pending')`,
      [userId, outTradeNo, moneyCents, payType],
    )

    const publicBase = resolvePublicBaseFromReq(req)
    const notifyUrl = `${publicBase}/api/pay/epay/notify`
    // 必须指向后端 return 路由；易支付会在 URL 上追加参数，若指向前端根路径易被误配成 API 端口而命中 GET / 返回 JSON
    const returnUrl = `${publicBase}/api/pay/epay/return`

    const clientip =
      (req.headers['x-forwarded-for'] && String(req.headers['x-forwarded-for']).split(',')[0].trim()) ||
      req.socket.remoteAddress ||
      '127.0.0.1'
    const ua = req.get('user-agent') || ''
    const device = /Mobile|Android|iPhone|iPad|MicroMessenger/i.test(ua) ? 'jump' : 'pc'

    const sitename = (s.siteTitle || '万米画布').slice(0, 64)
    const params = {
      pid: String(s.epayPid),
      type: payType,
      out_trade_no: outTradeNo,
      notify_url: notifyUrl,
      return_url: returnUrl,
      name: '账户余额充值',
      money: moneyStr,
      sitename,
      sign_type: 'MD5',
      clientip: String(clientip).slice(0, 64),
      device,
    }
    const sign = signParams(params, s.epayKey)
    res.status(200).json({
      method: 'POST',
      action: s.epaySubmitUrl.trim(),
      fields: { ...params, sign },
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '创建充值订单失败' })
  }
}

const epayNotify = async (req, res) => {
  try {
    const params = mergeRequestParams(req)
    const s = await loadPaySettings()
    if (!s.epayKey) {
      res.type('text/plain').send('fail')
      return
    }
    if (!verifyNotify(params, s.epayKey)) {
      res.type('text/plain').send('fail')
      return
    }
    if (String(params.trade_status || '') !== 'TRADE_SUCCESS') {
      res.type('text/plain').send('success')
      return
    }

    const outTradeNo = String(params.out_trade_no || '')
    const tradeNo = String(params.trade_no || '')
    const moneyStr = String(params.money ?? '')
    if (!outTradeNo || moneyStr === '') {
      res.type('text/plain').send('fail')
      return
    }

    const settled = await trySettleRechargeOrder(outTradeNo, tradeNo, moneyStr)
    if (!settled.ok) {
      res.type('text/plain').send('fail')
      return
    }

    res.type('text/plain').send('success')
  } catch (error) {
    res.type('text/plain').send('fail')
  }
}

const epayReturn = async (req, res) => {
  try {
    const params = mergeRequestParams(req)
    const s = await loadPaySettings()
    const frontBase = resolveFrontendBaseFromReq(req)
    if (!s.epayKey || !verifyNotify(params, s.epayKey)) {
      res.redirect(`${frontBase}/?recharge=0`)
      return
    }
    if (String(params.trade_status || '') !== 'TRADE_SUCCESS') {
      res.redirect(`${frontBase}/?recharge=0`)
      return
    }
    const outTradeNo = String(params.out_trade_no || '')
    const tradeNo = String(params.trade_no || '')
    const moneyStr = String(params.money ?? '')
    if (outTradeNo && moneyStr !== '') {
      await trySettleRechargeOrder(outTradeNo, tradeNo, moneyStr)
    }
    res.redirect(`${frontBase}/?recharge=1`)
  } catch (error) {
    const frontBase = resolveFrontendBaseFromReq(req)
    res.redirect(`${frontBase}/?recharge=0`)
  }
}

const listMyRecharges = async (req, res) => {
  try {
    const userId = req.auth.id
    const [rows] = await pool.query(
      `SELECT id, out_trade_no AS outTradeNo, money_cents AS moneyCents, pay_type AS payType,
              status, trade_no AS tradeNo, created_at AS createdAt, paid_at AS paidAt
       FROM pay_recharge_orders
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 80`,
      [userId],
    )
    res.status(200).json({ items: rows })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取充值记录失败' })
  }
}

module.exports = {
  getPayConfig,
  createRecharge,
  epayNotify,
  epayReturn,
  listMyRecharges,
}
