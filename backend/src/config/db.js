const mysql = require('mysql2/promise')
const { dbHost, dbPort, dbUser, dbPassword, dbName } = require('./env')

const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

const initDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','user') NOT NULL DEFAULT 'user',
      balance_cents INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  try {
    await pool.query('ALTER TABLE users ADD COLUMN avatar_url TEXT NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE users ADD COLUMN balance_cents INT NOT NULL DEFAULT 0')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE users MODIFY COLUMN balance_cents INT NOT NULL DEFAULT 0')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('CREATE UNIQUE INDEX uk_users_email ON users (email)')
  } catch (error) {
    if (!['ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS register_email_codes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(12) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_email_created (email, created_at),
      KEY idx_expires (expires_at)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_configs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      base_url VARCHAR(255) NOT NULL,
      api_key VARCHAR(255) NOT NULL,
      model VARCHAR(128) NOT NULL,
      unit_cost_cents INT NOT NULL DEFAULT 7,
      created_by BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
  try {
    await pool.query('ALTER TABLE api_configs ADD COLUMN unit_cost_cents INT NOT NULL DEFAULT 7')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS canvases (
      id VARCHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS canvas_images (
      id VARCHAR(64) PRIMARY KEY,
      canvas_id VARCHAR(64) NOT NULL,
      prompt TEXT NOT NULL,
      size VARCHAR(32) NOT NULL,
      x DOUBLE NOT NULL,
      y DOUBLE NOT NULL,
      source_image_id VARCHAR(64) NULL,
      status VARCHAR(32) NOT NULL,
      image_url TEXT NULL,
      error TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS avatar_repository (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      image_url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      creator_user_id BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_records (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      prompt TEXT NOT NULL,
      model VARCHAR(128) NOT NULL,
      size VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL,
      cost_cents INT NOT NULL DEFAULT 0,
      error_message TEXT NULL,
      image_url TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id TINYINT PRIMARY KEY,
      allow_user_register TINYINT(1) NOT NULL DEFAULT 1,
      register_mode ENUM('default','email_verification') NOT NULL DEFAULT 'default',
      email_provider VARCHAR(32) NOT NULL DEFAULT 'custom',
      email_verification_enabled TINYINT(1) NOT NULL DEFAULT 0,
      smtp_host VARCHAR(255) NULL,
      smtp_port INT NULL,
      smtp_secure TINYINT(1) NOT NULL DEFAULT 0,
      smtp_user VARCHAR(255) NULL,
      smtp_pass VARCHAR(255) NULL,
      verify_from_email VARCHAR(255) NULL,
      email_subject_template VARCHAR(255) NULL,
      email_html_template TEXT NULL,
      register_gift_cents INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)
  try {
    await pool.query("ALTER TABLE system_settings ADD COLUMN email_provider VARCHAR(32) NOT NULL DEFAULT 'custom'")
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE system_settings ADD COLUMN email_subject_template VARCHAR(255) NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE system_settings ADD COLUMN email_html_template TEXT NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query(
      "ALTER TABLE system_settings ADD COLUMN site_title VARCHAR(128) NOT NULL DEFAULT '万米画布'",
    )
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query(
      "ALTER TABLE system_settings ADD COLUMN pay_provider VARCHAR(32) NOT NULL DEFAULT 'none'",
    )
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE system_settings ADD COLUMN epay_submit_url VARCHAR(512) NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE system_settings ADD COLUMN epay_pid VARCHAR(64) NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }
  try {
    await pool.query('ALTER TABLE system_settings ADD COLUMN epay_key VARCHAR(255) NULL')
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pay_recharge_orders (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      out_trade_no VARCHAR(64) NOT NULL,
      money_cents INT NOT NULL,
      pay_type VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      trade_no VARCHAR(128) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP NULL,
      UNIQUE KEY uk_out_trade_no (out_trade_no),
      KEY idx_user_status (user_id, status),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_balance_adjustments (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      delta_cents INT NOT NULL,
      admin_user_id BIGINT NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_user_created (user_id, created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await pool.query(
    `INSERT INTO system_settings (
       id, allow_user_register, register_mode, email_provider, email_verification_enabled, register_gift_cents,
       email_subject_template, email_html_template
     )
     VALUES (
       1, 1, 'email_verification', 'custom', 1, 0,
       '【万米画布】邮箱验证码',
       '<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>欢迎使用万米画布</h2><p>你的验证码是：<b>{{code}}</b></p><p>5分钟内有效，请勿泄露给他人。</p></div>'
     )
     ON DUPLICATE KEY UPDATE id = id`,
  )
}

module.exports = {
  pool,
  initDatabase,
}
