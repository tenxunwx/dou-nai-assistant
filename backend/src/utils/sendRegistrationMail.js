const nodemailer = require('nodemailer')
const { pool } = require('../config/db')

/**
 * 使用 system_settings 中的 SMTP 发送注册验证码邮件。
 * @param {string} toAddress
 * @param {string} code
 */
async function sendRegistrationCodeEmail(toAddress, code) {
  const [rows] = await pool.query(
    `SELECT smtp_host AS smtpHost,
            smtp_port AS smtpPort,
            smtp_secure AS smtpSecure,
            smtp_user AS smtpUser,
            smtp_pass AS smtpPass,
            verify_from_email AS verifyFromEmail,
            email_subject_template AS emailSubjectTemplate,
            email_html_template AS emailHtmlTemplate
     FROM system_settings WHERE id = 1 LIMIT 1`,
  )
  const s = rows[0]
  if (!s?.smtpHost || !s.smtpPort || !s.smtpUser || !s.smtpPass) {
    const err = new Error('请先在系统设置中配置 SMTP（发件服务器、账号、密码）')
    err.statusCode = 503
    throw err
  }
  const fromAddr = `${s.verifyFromEmail || s.smtpUser || ''}`.trim() || s.smtpUser
  const subjectTpl = `${s.emailSubjectTemplate || '【万米画布】邮箱验证码'}`.trim()
  const htmlTpl =
    `${s.emailHtmlTemplate || '<p>验证码：<b>{{code}}</b></p>'}`.trim()
  const subject = subjectTpl.replace(/\{\{code\}\}/g, code)
  const html = htmlTpl.replace(/\{\{code\}\}/g, code)

  const transporter = nodemailer.createTransport({
    host: s.smtpHost,
    port: Number(s.smtpPort),
    secure: Boolean(Number(s.smtpSecure)),
    auth: {
      user: s.smtpUser,
      pass: s.smtpPass,
    },
  })

  await transporter.sendMail({
    from: fromAddr,
    to: toAddress,
    subject,
    html,
  })
}

module.exports = {
  sendRegistrationCodeEmail,
}
