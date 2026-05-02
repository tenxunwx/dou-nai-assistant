/**
 * Node 16 无全局 fetch / FormData / Blob，由 undici 补齐。
 * Node 18+ 虽有原生 fetch，但部分运行环境仍缺 Blob 或与 multipart 不兼容，
 * 故对 Blob / FormData / File 做「缺则补、坏则覆盖」检测。
 */
const undici = require('undici')

function blobWorks() {
  try {
    const B = globalThis.Blob
    if (typeof B !== 'function') return false
    new B([new Uint8Array([1])])
    return true
  } catch {
    return false
  }
}

function formDataWorks() {
  try {
    const FD = globalThis.FormData
    if (typeof FD !== 'function') return false
    const fd = new FD()
    fd.append('a', 'b')
    return true
  } catch {
    return false
  }
}

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = undici.fetch
  globalThis.Headers = undici.Headers
  globalThis.Request = undici.Request
  globalThis.Response = undici.Response
}

if (!blobWorks()) {
  globalThis.Blob = undici.Blob
}
if (!formDataWorks()) {
  globalThis.FormData = undici.FormData
}
if (typeof globalThis.File !== 'function') {
  globalThis.File = undici.File
}
