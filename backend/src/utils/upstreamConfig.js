const { pool } = require('../config/db')

const normalizeApiRoot = (baseUrl) => {
  const base = `${baseUrl || ''}`.trim().replace(/\/+$/, '')
  if (!base) return ''
  if (base.endsWith('/v1/videos')) return base.slice(0, -'/v1/videos'.length)
  return base
}

const buildConfig = (row) => {
  const rawKey = `${row.apiKey || ''}`.trim()
  const authHeader = /^bearer\s+/i.test(rawKey) ? rawKey : `Bearer ${rawKey}`
  return {
    id: row.id,
    baseUrl: row.baseUrl,
    apiRoot: normalizeApiRoot(row.baseUrl),
    apiKey: rawKey,
    authHeader,
    model: row.model || 'gpt-image-2',
    unitCostCents: Number(row.unitCostCents || 0),
  }
}

const getActiveUpstreamConfig = async () => {
  const [rows] = await pool.query(
    'SELECT id, base_url AS baseUrl, api_key AS apiKey, model, unit_cost_cents AS unitCostCents FROM api_configs ORDER BY id DESC LIMIT 1',
  )
  const row = rows?.[0]
  if (!row?.baseUrl || !row?.apiKey) {
    const error = new Error('未配置上游接口，请在“系统配置-接口配置”中添加')
    error.statusCode = 500
    throw error
  }
  return buildConfig(row)
}

const getUpstreamConfigByModel = async (model) => {
  const targetModel = `${model || ''}`.trim()
  if (targetModel) {
    const [rows] = await pool.query(
      'SELECT id, base_url AS baseUrl, api_key AS apiKey, model, unit_cost_cents AS unitCostCents FROM api_configs WHERE model = ? ORDER BY id DESC LIMIT 1',
      [targetModel],
    )
    if (rows[0]?.baseUrl && rows[0]?.apiKey) {
      return buildConfig(rows[0])
    }
  }
  return getActiveUpstreamConfig()
}

module.exports = {
  getActiveUpstreamConfig,
  getUpstreamConfigByModel,
}

