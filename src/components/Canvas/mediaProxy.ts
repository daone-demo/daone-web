/** 仅代理受信对象存储域名，避免开放代理被滥用 */
const ALLOWED_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i

function parseRemoteMediaUrl(url: string): URL | null {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) {
    return null
  }
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!ALLOWED_PROXY_HOST_RE.test(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 将跨域对象存储地址转为同源代理地址，便于 canvas 读取像素。
 * - path 风格 `/media-proxy/<host>/<path>`：适配 nginx 反代（dev 静态部署）
 * - query 风格 `/media-proxy?url=...`：适配 Vercel Serverless
 */
export function buildMediaProxyCandidates(url: string): string[] {
  const parsed = parseRemoteMediaUrl(url)
  if (!parsed) return []

  const pathname = parsed.pathname.replace(/^\//, '')
  const search = parsed.search || ''
  const encoded = encodeURIComponent(parsed.toString())
  const candidates = [
    `/media-proxy?url=${encoded}`,
    `/media-proxy/${parsed.hostname}/${pathname}${search}`,
  ]
  return [...new Set(candidates)]
}

/**
 * 将跨域对象存储地址转为同源 `/media-proxy?url=...`（兼容旧调用）。
 */
export function toMediaProxyUrl(url: string): string | null {
  return buildMediaProxyCandidates(url)[0] ?? null
}

export function isAllowedMediaProxyHost(hostname: string) {
  return ALLOWED_PROXY_HOST_RE.test(hostname)
}
