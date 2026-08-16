import {
  appendMediaProxySignature,
  isAllowedMediaProxyHostname,
} from '../../../scripts/media-proxy-policy.mjs'

function parseRemoteMediaUrl(url: string): URL | null {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) {
    return null
  }
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    // 与服务端一致：仅 HTTPS，避免客户端构造已被拒绝的 HTTP 代理请求
    if (parsed.protocol !== 'https:') return null
    if (!isAllowedMediaProxyHostname(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Path 风格同源代理：`/media-proxy/<host>/<path>`（nginx / Vercel path rewrite）
 * 自动附加短时 HMAC（mp_exp / mp_sig），与 Node 校验对齐。
 */
export function buildMediaProxyPathUrl(url: string): string | null {
  const parsed = parseRemoteMediaUrl(url)
  if (!parsed) return null

  const pathname = parsed.pathname.replace(/^\//, '')
  const search = parsed.search || ''
  return appendMediaProxySignature(`/media-proxy/${parsed.hostname}/${pathname}${search}`)
}

/**
 * 将跨域对象存储地址转为同源代理地址，便于 canvas 读取像素。
 * - path 风格 `/media-proxy/<host>/<path>`：生产 nginx 与 Vercel path rewrite
 * - query 风格 `/media-proxy?url=...`：仅作兜底（部分环境 query location 未生效）
 */
export function buildMediaProxyCandidates(url: string): string[] {
  const pathStyle = buildMediaProxyPathUrl(url)
  if (!pathStyle) return []

  const parsed = parseRemoteMediaUrl(url)
  if (!parsed) return [pathStyle]

  const encoded = encodeURIComponent(parsed.toString())
  return [...new Set([pathStyle, appendMediaProxySignature(`/media-proxy?url=${encoded}`)])]
}

/** 将跨域对象存储地址转为同源 `/media-proxy/<host>/<path>` */
export function toMediaProxyUrl(url: string): string | null {
  return buildMediaProxyPathUrl(url)
}

export function isAllowedMediaProxyHost(hostname: string) {
  return isAllowedMediaProxyHostname(hostname)
}
