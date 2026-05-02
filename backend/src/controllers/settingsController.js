const { pool } = require('../config/db')

const listApiConfigs = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, base_url AS baseUrl, model, unit_cost_cents AS unitCostCents, created_at AS createdAt FROM api_configs ORDER BY id DESC',
    )
    res.status(200).json({ items: rows })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取接口配置失败' })
  }
}

const createApiConfig = async (req, res) => {
  try {
    const baseUrl = `${req.body?.baseUrl || ''}`.trim()
    const apiKey = `${req.body?.apiKey || ''}`.trim()
    const model = `${req.body?.model || ''}`.trim()
    const unitCostYuan = Number(req.body?.unitCostYuan)
    const unitCostCents = Number.isFinite(unitCostYuan) ? Math.max(0, Math.round(unitCostYuan * 100)) : NaN
    if (!baseUrl || !apiKey || !model) {
      res.status(400).json({ error: 'baseUrl、apiKey、model 均不能为空' })
      return
    }
    if (!Number.isFinite(unitCostCents)) {
      res.status(400).json({ error: 'unitCostYuan 无效' })
      return
    }

    const [result] = await pool.query(
      'INSERT INTO api_configs (base_url, api_key, model, unit_cost_cents, created_by) VALUES (?, ?, ?, ?, ?)',
      [baseUrl, apiKey, model, unitCostCents, req.auth.id],
    )
    res.status(201).json({
      id: result.insertId,
      baseUrl,
      model,
      unitCostCents,
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '创建接口配置失败' })
  }
}

const deleteApiConfig = async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) {
      res.status(400).json({ error: '无效配置 ID' })
      return
    }
    await pool.query('DELETE FROM api_configs WHERE id = ?', [id])
    res.status(200).json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error.message || '删除接口配置失败' })
  }
}

const getSystemSettings = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT allow_user_register AS allowUserRegister,
              register_mode AS registerMode,
              email_provider AS emailProvider,
              email_verification_enabled AS emailVerificationEnabled,
              smtp_host AS smtpHost,
              smtp_port AS smtpPort,
              smtp_secure AS smtpSecure,
              smtp_user AS smtpUser,
              smtp_pass AS smtpPass,
              verify_from_email AS verifyFromEmail,
              email_subject_template AS emailSubjectTemplate,
              email_html_template AS emailHtmlTemplate,
              register_gift_cents AS registerGiftCents,
              site_title AS siteTitle,
              pay_provider AS payProvider,
              epay_submit_url AS epaySubmitUrl,
              epay_pid AS epayPid,
              epay_key AS epayKeyRaw
       FROM system_settings
       WHERE id = 1
       LIMIT 1`,
    )
    const row = rows[0] || null
    if (!row) {
      res.status(200).json({ settings: null })
      return
    }
    const { epayKeyRaw, ...rest } = row
    res.status(200).json({
      settings: {
        ...rest,
        epayKeySet: Boolean(epayKeyRaw),
        epayKey: '',
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取系统设置失败' })
  }
}

const updateSystemSettings = async (req, res) => {
  try {
    const allowUserRegister = req.body?.allowUserRegister ? 1 : 0
    const registerMode = `${req.body?.registerMode || 'default'}`.trim()
    const emailProvider = `${req.body?.emailProvider || 'custom'}`.trim()
    const emailVerificationEnabled = req.body?.emailVerificationEnabled ? 1 : 0
    const smtpHost = `${req.body?.smtpHost || ''}`.trim() || null
    const smtpPortRaw = Number(req.body?.smtpPort)
    const smtpPort = Number.isFinite(smtpPortRaw) && smtpPortRaw > 0 ? Math.floor(smtpPortRaw) : null
    const smtpSecure = req.body?.smtpSecure ? 1 : 0
    const smtpUser = `${req.body?.smtpUser || ''}`.trim() || null
    const smtpPass = `${req.body?.smtpPass || ''}`.trim() || null
    const verifyFromEmail = `${req.body?.verifyFromEmail || ''}`.trim() || null
    const emailSubjectTemplate = `${req.body?.emailSubjectTemplate || ''}`.trim() || null
    const emailHtmlTemplate = `${req.body?.emailHtmlTemplate || ''}`.trim() || null
    const registerGiftYuan = Number(req.body?.registerGiftYuan)
    const registerGiftCents = Number.isFinite(registerGiftYuan)
      ? Math.max(0, Math.round(registerGiftYuan * 100))
      : 0

    const siteTitle = `${req.body?.siteTitle ?? ''}`.trim() || '万米画布'
    const payProvider = `${req.body?.payProvider || 'none'}`.trim()
    const epaySubmitUrl = `${req.body?.epaySubmitUrl || ''}`.trim() || null
    const epayPid = `${req.body?.epayPid || ''}`.trim() || null
    const rawEpayKey = req.body?.epayKey
    const epayKeyInput =
      rawEpayKey !== undefined && rawEpayKey !== null && String(rawEpayKey).trim().length > 0
        ? String(rawEpayKey).trim()
        : undefined

    if (!['default', 'email_verification'].includes(registerMode)) {
      res.status(400).json({ error: 'registerMode 无效' })
      return
    }
    if (!['none', 'epay'].includes(payProvider)) {
      res.status(400).json({ error: 'payProvider 无效' })
      return
    }

    if (epayKeyInput) {
      await pool.query(
        `UPDATE system_settings
         SET allow_user_register = ?,
             register_mode = ?,
             email_provider = ?,
             email_verification_enabled = ?,
             smtp_host = ?,
             smtp_port = ?,
             smtp_secure = ?,
             smtp_user = ?,
             smtp_pass = ?,
             verify_from_email = ?,
             email_subject_template = ?,
             email_html_template = ?,
             register_gift_cents = ?,
             site_title = ?,
             pay_provider = ?,
             epay_submit_url = ?,
             epay_pid = ?,
             epay_key = ?
         WHERE id = 1`,
        [
          allowUserRegister,
          registerMode,
          emailProvider,
          emailVerificationEnabled,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPass,
          verifyFromEmail,
          emailSubjectTemplate,
          emailHtmlTemplate,
          registerGiftCents,
          siteTitle,
          payProvider,
          epaySubmitUrl,
          epayPid,
          epayKeyInput,
        ],
      )
    } else {
      await pool.query(
        `UPDATE system_settings
         SET allow_user_register = ?,
             register_mode = ?,
             email_provider = ?,
             email_verification_enabled = ?,
             smtp_host = ?,
             smtp_port = ?,
             smtp_secure = ?,
             smtp_user = ?,
             smtp_pass = ?,
             verify_from_email = ?,
             email_subject_template = ?,
             email_html_template = ?,
             register_gift_cents = ?,
             site_title = ?,
             pay_provider = ?,
             epay_submit_url = ?,
             epay_pid = ?
         WHERE id = 1`,
        [
          allowUserRegister,
          registerMode,
          emailProvider,
          emailVerificationEnabled,
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPass,
          verifyFromEmail,
          emailSubjectTemplate,
          emailHtmlTemplate,
          registerGiftCents,
          siteTitle,
          payProvider,
          epaySubmitUrl,
          epayPid,
        ],
      )
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: error.message || '更新系统设置失败' })
  }
}

module.exports = {
  listApiConfigs,
  createApiConfig,
  deleteApiConfig,
  getSystemSettings,
  updateSystemSettings,
}
