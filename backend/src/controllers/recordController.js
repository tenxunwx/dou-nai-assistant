const { pool } = require('../config/db')

const listGenerationRecords = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, prompt, model, size, status, cost_cents AS costCents, error_message AS errorMessage,
              image_url AS imageUrl, created_at AS createdAt
       FROM generation_records
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.auth.id],
    )
    res.status(200).json({ items: rows })
  } catch (error) {
    res.status(500).json({ error: error.message || '读取生成记录失败' })
  }
}

module.exports = {
  listGenerationRecords,
}

