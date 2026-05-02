/**
 * Node 16 无全局 fetch / FormData / Blob，在加载业务代码前由 undici 补齐。
 * Node 18+ 自带 Web API，此处跳过。
 */
if (typeof globalThis.fetch !== 'function') {
  const undici = require('undici')
  globalThis.fetch = undici.fetch
  globalThis.Headers = undici.Headers
  globalThis.Request = undici.Request
  globalThis.Response = undici.Response
  globalThis.FormData = undici.FormData
  globalThis.File = undici.File
  globalThis.Blob = undici.Blob
}
