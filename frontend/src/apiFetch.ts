/**
 * 生产环境：页面与 API 同域时，用 Nginx 把 /api 反代到 Node 即可，无需配置。
 * 若 API 在另一子域，构建前设置 VITE_API_BASE_URL=https://api.example.com（无尾斜杠）。
 */
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export function apiUrl(path: string): string {
  if (!path.startsWith('/api')) return path
  if (!apiBase) return path
  return `${apiBase}${path}`
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === 'string' && input.startsWith('/api')) {
    return fetch(apiUrl(input), init)
  }
  return fetch(input, init)
}
