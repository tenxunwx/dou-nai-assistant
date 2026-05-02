#!/usr/bin/env node
/**
 * 仅执行数据库结构检查/增量迁移（与启动时 initDatabase 相同逻辑）。
 * 不删表、不清数据；CREATE IF NOT EXISTS / ALTER 补列。
 * 在 backend 目录执行: node scripts/apply-db.js
 */
const path = require('path')

const ROOT = path.join(__dirname, '..')
process.chdir(ROOT)
require('dotenv').config({ path: path.join(ROOT, '.env') })

async function main() {
  const { initDatabase, pool } = require('../src/config/db')
  await initDatabase()
  console.log('[apply-db] 数据库结构检查/增量迁移已完成。')
  await pool.end().catch(() => {})
}

main().catch((err) => {
  console.error('[apply-db]', err.message || err)
  process.exit(1)
})
