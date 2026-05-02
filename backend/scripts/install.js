#!/usr/bin/env node
/**
 * 后端一键安装向导（数据库连通性、建表、首个管理员）。
 * 由 scripts/install.sh 调用；也可在 backend 目录执行：node scripts/install.js
 */
const fs = require('fs')
const path = require('path')
const net = require('net')
const crypto = require('crypto')
const readline = require('readline')

/** 安装向导扫描的 5 个候选 HTTP 端口（本机试绑，避免与常见占用冲突） */
const HTTP_PORT_CANDIDATES = [3001, 3002, 3003, 3004, 3005]

const ROOT = path.join(__dirname, '..')
const ENV_PATH = path.join(ROOT, '.env')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (q) => new Promise((resolve) => rl.question(q, resolve))

function formatEnvLine(key, value) {
  const s = value == null ? '' : String(value)
  if (s === '') return `${key}=`
  if (/[\s#"']/.test(s)) {
    return `${key}="${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`
  }
  return `${key}=${s}`
}

function randomSecret() {
  return crypto.randomBytes(32).toString('hex')
}

async function testMysql({ host, port, user, password, database }) {
  const mysql = require('mysql2/promise')
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    connectTimeout: 10000,
  })
  try {
    await conn.query('SELECT 1 AS ok')
  } finally {
    await conn.end()
  }
}

/** 本机是否可监听该端口（不可监听则视为已被占用或不可用） */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    const finish = (ok) => {
      server.removeAllListeners()
      try {
        server.close()
      } catch (_) {
        /* ignore */
      }
      resolve(ok)
    }
    server.once('error', () => finish(false))
    server.listen({ port, host: '0.0.0.0' }, () => {
      server.close(() => finish(true))
    })
  })
}

async function chooseHttpPort() {
  console.log('\n正在扫描本机后端 HTTP 端口（共 5 个候选）…\n')
  const rows = []
  for (const p of HTTP_PORT_CANDIDATES) {
    const free = await isPortFree(p)
    rows.push({ port: p, free })
    console.log(`  ${p}  —— ${free ? '空闲' : '占用'}`)
  }
  const recommended = rows.find((r) => r.free)

  if (recommended) {
    console.log(`\n推荐使用: ${recommended.port}（首个检测为空闲的端口）`)
    const raw = ((await question('回车直接采用推荐端口，或输入候选列表中的某一「空闲」端口号: ')) || '').trim()
    if (!raw) {
      return String(recommended.port)
    }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      console.error('端口号无效，须为 1–65535 的整数')
      process.exit(1)
    }
    const picked = rows.find((r) => r.port === n)
    if (picked) {
      if (!picked.free) {
        console.error(`端口 ${n} 当前为占用状态，请选空闲端口或回车使用推荐 ${recommended.port}`)
        process.exit(1)
      }
      return String(n)
    }
    const ok = await isPortFree(n)
    if (!ok) {
      console.error(`端口 ${n} 不可用或已被占用，请更换`)
      process.exit(1)
    }
    return String(n)
  }

  console.log('\n上述 5 个候选端口均被占用（或不可绑定）。')
  const raw = ((await question('请手动输入要使用的 HTTP 端口（1–65535）: ')) || '').trim()
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error('端口号无效')
    process.exit(1)
  }
  const ok = await isPortFree(n)
  if (!ok) {
    console.error(`端口 ${n} 仍不可用或已被占用，请关闭占用进程后重试安装`)
    process.exit(1)
  }
  return String(n)
}

async function main() {
  console.log('\n======== 万米画布 / 豆奶助手 — 后端安装向导 ========\n')
  console.log('请提前在 MySQL 中创建好「数据库」及拥有该库权限的「用户」。\n')

  const dbHost = ((await question(`MySQL 主机 [127.0.0.1]: `)) || '').trim() || '127.0.0.1'
  const dbPortRaw = ((await question(`MySQL 端口 [3306]: `)) || '').trim() || '3306'
  const dbPort = Number(dbPortRaw)
  if (!Number.isFinite(dbPort) || dbPort <= 0) {
    console.error('端口无效')
    process.exit(1)
  }
  const dbName = ((await question('数据库名（必填）: ')) || '').trim()
  const dbUser = ((await question('数据库用户名（必填）: ')) || '').trim()
  const dbPassword = ((await question('数据库密码（必填，输入可见）: ')) || '').trim()
  if (!dbName || !dbUser) {
    console.error('数据库名与用户名不能为空')
    process.exit(1)
  }

  console.log('\n正在测试数据库连接…')
  try {
    await testMysql({ host: dbHost, port: dbPort, user: dbUser, password: dbPassword, database: dbName })
  } catch (e) {
    console.error('连接失败:', e.message || e)
    process.exit(1)
  }

  const port = await chooseHttpPort()
  console.log(`\n已选择后端 HTTP 端口: ${port}\n`)

  const nodeEnv = ((await question(`NODE_ENV [production]: `)) || '').trim() || 'production'
  const jwtSecret = ((await question(`JWT_SECRET（回车随机生成）: `)) || '').trim() || randomSecret()
  const publicAppUrl = ((await question('PUBLIC_APP_URL 对外 API 根（易支付 notify，可回车跳过）: ')) || '').trim()
  const frontendUrl = ((await question('FRONTEND_URL 前端 SPA 根（可回车跳过）: ')) || '').trim()

  const envLines = [
    formatEnvLine('PORT', port),
    formatEnvLine('NODE_ENV', nodeEnv),
    formatEnvLine('JWT_SECRET', jwtSecret),
    formatEnvLine('DB_HOST', dbHost),
    formatEnvLine('DB_PORT', String(dbPort)),
    formatEnvLine('DB_USER', dbUser),
    formatEnvLine('DB_PASSWORD', dbPassword),
    formatEnvLine('DB_NAME', dbName),
    formatEnvLine('PUBLIC_UPLOAD_API_URL', process.env.PUBLIC_UPLOAD_API_URL || 'https://img.scdn.io/api/v1.php'),
    formatEnvLine('PUBLIC_UPLOAD_OUTPUT_FORMAT', process.env.PUBLIC_UPLOAD_OUTPUT_FORMAT || 'auto'),
    formatEnvLine('PUBLIC_UPLOAD_CDN_DOMAIN', process.env.PUBLIC_UPLOAD_CDN_DOMAIN || ''),
    formatEnvLine('PUBLIC_APP_URL', publicAppUrl),
    formatEnvLine('FRONTEND_URL', frontendUrl),
    '',
  ]

  fs.writeFileSync(ENV_PATH, envLines.join('\n'), { encoding: 'utf8' })
  console.log(`\n已写入 ${path.relative(process.cwd(), ENV_PATH) || '.env'}\n`)

  // 清掉可能已缓存的旧配置，重新加载 .env 再建表
  delete require.cache[require.resolve('../src/config/env.js')]
  delete require.cache[require.resolve('../src/config/db.js')]
  require('dotenv').config({ path: ENV_PATH })

  console.log('正在初始化数据表…')
  const { initDatabase, pool } = require('../src/config/db')
  await initDatabase()
  console.log('数据表就绪。\n')

  const adminUser = ((await question('管理员登录用户名（必填）: ')) || '').trim()
  const adminPass = ((await question('管理员登录密码（至少 6 位，输入可见）: ')) || '').trim()
  const adminPass2 = ((await question('请再次输入管理员密码: ')) || '').trim()
  if (!adminUser || adminPass.length < 6) {
    console.error('用户名不能为空，密码至少 6 位')
    process.exit(1)
  }
  if (adminPass !== adminPass2) {
    console.error('两次密码不一致')
    process.exit(1)
  }

  const bcrypt = require('bcryptjs')
  const passwordHash = await bcrypt.hash(adminPass, 10)

  const [exist] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [adminUser])
  let adminId
  if (exist.length) {
    adminId = exist[0].id
    await pool.query('UPDATE users SET password_hash = ?, role = ?, banned = 0 WHERE id = ?', [
      passwordHash,
      'admin',
      adminId,
    ])
    console.log(`已更新用户「${adminUser}」为管理员并重置密码。`)
  } else {
    const [ins] = await pool.query(
      'INSERT INTO users (username, password_hash, role, balance_cents) VALUES (?, ?, ?, 0)',
      [adminUser, passwordHash, 'admin'],
    )
    adminId = ins.insertId
    console.log(`已创建管理员「${adminUser}」。`)
  }

  const [hasCanvas] = await pool.query('SELECT id FROM canvases WHERE user_id = ? LIMIT 1', [adminId])
  if (!hasCanvas.length) {
    const defaultCanvasId = `canvas_${adminId}_${Date.now()}`
    await pool.query('INSERT INTO canvases (id, user_id, created_at) VALUES (?, ?, ?)', [
      defaultCanvasId,
      adminId,
      new Date(),
    ])
  }

  await pool.end().catch(() => {})

  console.log('\n======== 安装完成 ========')
  console.log(`启动服务: cd "${ROOT}" && npm start`)
  console.log(`或生产环境建议使用 PM2/systemd 守护进程。\n`)
}

main()
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
  .finally(() => rl.close())
