const { pool } = require('../config/db')

const health = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dou-nai-backend',
    timestamp: new Date().toISOString(),
  })
}

const info = (_req, res) => {
  res.status(200).json({
    message: '豆奶助手后端已就绪',
    version: 'v1',
  })
}

const getSite = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT site_title AS siteTitle FROM system_settings WHERE id = 1 LIMIT 1',
    )
    res.status(200).json({ siteTitle: rows[0]?.siteTitle || '万米画布' })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取站点信息失败' })
  }
}

module.exports = {
  health,
  info,
  getSite,
}
