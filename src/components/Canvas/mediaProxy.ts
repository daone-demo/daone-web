/** 仅代理受信对象存储域名，避免开放代理被滥用 */
const ALLOWED_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i

/**
 * 将跨域对象存储地址转为同源 `/media-proxy?url=...`，便于 canvas 读取像素。
 * 支持阿里云 OSS、腾讯云 COS；非允许域名返回 null。
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
