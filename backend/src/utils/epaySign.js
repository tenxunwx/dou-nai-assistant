const crypto = require('crypto')

/**
 * 易支付 MD5 签名：参数名 ASCII 升序，排除 sign、sign_type 与空值，拼接 key=value&... 后追加商户 KEY 再 MD5（小写）
 */
const buildSignSource = (params) => {
  const entries = Object.entries(params).filter(
    ([k, v]) =>
      k !== 'sign' &&
      k !== 'sign_type' &&
      v !== '' &&
      v !== null &&
      v !== undefined,
  )
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return entries.map(([k, v]) => `${k}=${v}`).join('&')
}

const signParams = (params, merchantKey) => {
  const src = buildSignSource(params) + merchantKey
  return crypto.createHash('md5').update(src, 'utf8').digest('hex')
}

const verifyNotify = (params, merchantKey) => {
  const sign = params.sign
  if (!sign) return false
  const computed = signParams(params, merchantKey)
  return String(computed).toLowerCase() === String(sign).toLowerCase()
}

module.exports = {
  buildSignSource,
  signParams,
  verifyNotify,
}
