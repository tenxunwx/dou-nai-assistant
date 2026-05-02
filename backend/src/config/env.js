const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'wanmihuabu_jwt_secret',
  dbHost: process.env.DB_HOST || '127.0.0.1',
  dbPort: Number(process.env.DB_PORT || 3306),
  dbUser: process.env.DB_USER || 'wanmihuabu',
  dbPassword: process.env.DB_PASSWORD || 'wanmihuabu',
  dbName: process.env.DB_NAME || 'wanmihuabu',
  publicUploadApiUrl: process.env.PUBLIC_UPLOAD_API_URL || 'https://img.scdn.io/api/v1.php',
  publicUploadOutputFormat: process.env.PUBLIC_UPLOAD_OUTPUT_FORMAT || 'auto',
  publicUploadCdnDomain: process.env.PUBLIC_UPLOAD_CDN_DOMAIN || '',
  /** 对外可访问的后端根 URL（用于易支付 notify/return），如 https://api.example.com */
  publicAppUrl: (process.env.PUBLIC_APP_URL || '').replace(/\/$/, ''),
  /** 支付完成后浏览器跳转的前端 SPA 根地址；未配置时开发环境见 publicUrls.js 对 localhost:API 端口的默认 */
  frontendUrl: (process.env.FRONTEND_URL || '').replace(/\/$/, ''),
}
