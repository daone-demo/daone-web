import { getToken } from '@/utils/request'
import { isAllowedMediaProxyHost } from './mediaProxyAllowlist'

export { isAllowedMediaProxyHost } from './mediaProxyAllowlist'

function parseRemoteMediaUrl(url: string): URL | null {
  if (!url || url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/')) {
    return null
  }
  try {
    const parsed = new URL(
      url,
      typeof window !== 'undefined' ? window.location.href : 'http://localhost',
    )
    if (parsed.protocol !== 'https:') return null
    if (!isAllowedMediaProxyHost(parsed.hostname)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 未签名的 path 风格代理路径（仅作形态参考；实际取流必须走 mintMediaProxyCandidates）。
 * 浏览器不再持有 HMAC 密钥，无法本地签发。
 */
export function buildMediaProxyPathUrl(url: string): string | null {
  const parsed = parseRemoteMediaUrl(url)
  if (!parsed) return null

  const pathname = parsed.pathname.replace(/^\//, '')
  const search = parsed.search || ''
  return `/media-proxy/${parsed.hostname}/${pathname}${search}`
}

/**
 * @deprecated 不会返回可用签名 URL；请使用 mintMediaProxyCandidates
 */
export function buildMediaProxyCandidates(url: string): string[] {
  const pathStyle = buildMediaProxyPathUrl(url)
  return pathStyle ? [pathStyle] : []
}

/** 将跨域对象存储地址转为同源 `/media-proxy/<host>/<path>`（未签名） */
export function toMediaProxyUrl(url: string): string | null {
  return buildMediaProxyPathUrl(url)
}

type MintResponse = {
  urls?: string[]
  message?: string
}

const mintCache = new Map<string, { urls: string[]; expiresAt: number }>()
const mintInflight = new Map<string, Promise<string[]>>()

/**
 * 向同源服务端申请短时已签名代理 URL。
 * 密钥只存在于服务端；未登录或非业务 Bucket 时返回空数组（调用方可回退直连 OSS）。
 */
export async function mintMediaProxyCandidates(sourceUrl: string): Promise<string[]> {
  const parsed = parseRemoteMediaUrl(sourceUrl)
  if (!parsed) return []

  const token = getToken()
  if (!token) return []

  const cacheKey = parsed.toString()
  const cached = mintCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.urls
  }

  const inflight = mintInflight.get(cacheKey)
  if (inflight) return inflight

  const task = (async () => {
    try {
      const response = await fetch('/media-proxy/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: parsed.toString() }),
        credentials: 'same-origin',
      })
      if (!response.ok) return []
      const data = (await response.json()) as MintResponse
      const urls = Array.isArray(data.urls) ? data.urls.filter(Boolean) : []
      if (urls.length) {
        // 签名默认 10 分钟；客户端缓存略短，避免边界过期
        mintCache.set(cacheKey, { urls, expiresAt: Date.now() + 8 * 60 * 1000 })
      }
      return urls
    } catch {
      return []
    } finally {
      mintInflight.delete(cacheKey)
    }
  })()

  mintInflight.set(cacheKey, task)
  return task
}
