/** 仅代理阿里云 OSS，避免开放代理被滥用 */
const ALLOWED_PROXY_HOST_RE = /(^|\.)aliyuncs\.com$/i

/**
 * 将跨域 OSS 地址转为同源 `/media-proxy?url=...`，便于 canvas 导出像素。
 * 非允许域名返回 null。
 */
export function toMediaProxyUrl(url: string): string | null {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) {
    return null
  }
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!ALLOWED_PROXY_HOST_RE.test(parsed.hostname)) return null
    return `/media-proxy?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return null
  }
}

export function isAllowedMediaProxyHost(hostname: string) {
  return ALLOWED_PROXY_HOST_RE.test(hostname)
}
