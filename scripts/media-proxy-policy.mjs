/**
 * media-proxy 统一安全策略（Node / Vite / 测试共用）。
 * - 仅允许对象存储桶域名（非整个 aliyuncs/myqcloud）
 * - 短时 HMAC 签名（query: mp_exp / mp_sig）
 * - 进程内限频与限并发
 */

import { hmacSha256Hex, safeEqualString } from './media-proxy-hmac.mjs'

/** 与前端 VITE_MEDIA_PROXY_HMAC_SECRET / 服务端 MEDIA_PROXY_HMAC_SECRET 对齐；可用环境变量覆盖 */
export const MEDIA_PROXY_DEFAULT_HMAC_SECRET = 'daone-media-proxy-hmac-v1'

export const MEDIA_PROXY_SIG_TTL_SEC = 10 * 60
export const MEDIA_PROXY_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_PROXY_TIMEOUT_MS = 15_000
export const MEDIA_PROXY_MAX_REDIRECTS = 3
export const MEDIA_PROXY_RATE_WINDOW_MS = 60_000
export const MEDIA_PROXY_RATE_MAX = 60
export const MEDIA_PROXY_MAX_CONCURRENT = 8

/**
 * 阿里云 OSS 桶域名（含 accelerate），不含通用 *.aliyuncs.com
 * 例：daone-oss.oss-accelerate.aliyuncs.com、bucket.oss-cn-hangzhou.aliyuncs.com
 */
export const MEDIA_PROXY_OSS_HOST_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.oss-[a-z0-9-]+\.aliyuncs\.com$/i

/**
 * 腾讯云 COS 桶域名，不含通用 *.myqcloud.com
 * 例：bucket-1250000000.cos.ap-guangzhou.myqcloud.com
 */
export const MEDIA_PROXY_COS_HOST_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.cos\.[a-z0-9-]+\.myqcloud\.com$/i

/** 业务已知精确桶（可被 MEDIA_PROXY_ALLOWED_HOSTS 扩展） */
export const MEDIA_PROXY_EXACT_HOSTS = Object.freeze([
  'daone-oss.oss-accelerate.aliyuncs.com',
  'daone-oss.oss-cn-hangzhou.aliyuncs.com',
])

function readEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name])
    }
  } catch {
    // ignore
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return String(import.meta.env[name])
    }
  } catch {
    // ignore
  }
  return ''
}

function parseExactHostsFromEnv(raw) {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function getMediaProxyExactHosts() {
  const fromEnv = parseExactHostsFromEnv(
    readEnv('MEDIA_PROXY_ALLOWED_HOSTS') || readEnv('VITE_MEDIA_PROXY_ALLOWED_HOSTS'),
  )
  return new Set([...MEDIA_PROXY_EXACT_HOSTS.map((h) => h.toLowerCase()), ...fromEnv])
}

export function isAllowedMediaProxyHostname(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
  if (!host || host.includes(':') || host.includes('/') || host.includes('\\')) {
    return false
  }
  if (getMediaProxyExactHosts().has(host)) return true
  return MEDIA_PROXY_OSS_HOST_RE.test(host) || MEDIA_PROXY_COS_HOST_RE.test(host)
}

export function getMediaProxyHmacSecret() {
  const fromEnv =
    readEnv('MEDIA_PROXY_HMAC_SECRET').trim() ||
    readEnv('VITE_MEDIA_PROXY_HMAC_SECRET').trim()
  return fromEnv || MEDIA_PROXY_DEFAULT_HMAC_SECRET
}

export function buildMediaProxySignaturePayload(exp, targetUrl) {
  return `${exp}\n${targetUrl}`
}

export function signMediaProxyPayload(exp, targetUrl, secret = getMediaProxyHmacSecret()) {
  return hmacSha256Hex(secret, buildMediaProxySignaturePayload(exp, targetUrl))
}

/** 从代理请求 URL 解析上游目标（不含 mp_* 参数） */
export function extractMediaProxyTargetFromRequestUrl(rawUrl) {
  const incoming = new URL(rawUrl, 'http://localhost')
  let targetUrl = incoming.searchParams.get('url') || ''

  if (!targetUrl) {
    const pathMatch = incoming.pathname.match(/^\/(?:api\/)?media-proxy\/([^/]+)\/(.+)$/)
    if (pathMatch) {
      const params = new URLSearchParams(incoming.search)
      params.delete('mp_exp')
      params.delete('mp_sig')
      const query = params.toString()
      targetUrl = `https://${pathMatch[1]}/${pathMatch[2]}${query ? `?${query}` : ''}`
    }
  }

  if (!targetUrl) return null
  try {
    const parsed = new URL(targetUrl)
    parsed.searchParams.delete('mp_exp')
    parsed.searchParams.delete('mp_sig')
    return parsed.toString()
  } catch {
    return null
  }
}

export function readMediaProxySignature(rawUrl) {
  try {
    const incoming = new URL(rawUrl, 'http://localhost')
    const exp = incoming.searchParams.get('mp_exp') || ''
    const sig = incoming.searchParams.get('mp_sig') || ''
    return { exp, sig }
  } catch {
    return { exp: '', sig: '' }
  }
}

export function verifyMediaProxyRequestSignature(rawUrl, options = {}) {
  const nowSec =
    typeof options.nowSec === 'number' ? options.nowSec : Math.floor(Date.now() / 1000)
  const ttlSec = options.ttlSec ?? MEDIA_PROXY_SIG_TTL_SEC
  const secret = options.secret ?? getMediaProxyHmacSecret()
  const { exp, sig } = readMediaProxySignature(rawUrl)
  const expNum = Number(exp)
  if (!sig || !Number.isFinite(expNum) || expNum <= 0) {
    return { ok: false, statusCode: 401, message: 'Missing media proxy signature' }
  }
  if (expNum < nowSec || expNum > nowSec + ttlSec + 30) {
    return { ok: false, statusCode: 401, message: 'Expired media proxy signature' }
  }
  const targetUrl = extractMediaProxyTargetFromRequestUrl(rawUrl)
  if (!targetUrl) {
    return { ok: false, statusCode: 400, message: 'Missing or invalid url' }
  }
  const expected = signMediaProxyPayload(expNum, targetUrl, secret)
  if (!safeEqualString(expected, sig)) {
    return { ok: false, statusCode: 401, message: 'Invalid media proxy signature' }
  }
  return { ok: true, targetUrl, exp: expNum }
}

/**
 * 给同源代理路径追加短时签名（path 或 query 风格均可）。
 * @param {string} proxyUrl 如 `/media-proxy/host/path` 或 `/media-proxy?url=...`
 */
export function appendMediaProxySignature(proxyUrl, options = {}) {
  const ttlSec = options.ttlSec ?? MEDIA_PROXY_SIG_TTL_SEC
  const nowSec =
    typeof options.nowSec === 'number' ? options.nowSec : Math.floor(Date.now() / 1000)
  const secret = options.secret ?? getMediaProxyHmacSecret()
  const exp = nowSec + ttlSec
  const absolute = new URL(proxyUrl, 'http://localhost')
  absolute.searchParams.delete('mp_exp')
  absolute.searchParams.delete('mp_sig')
  const targetUrl = extractMediaProxyTargetFromRequestUrl(
    `${absolute.pathname}${absolute.search}`,
  )
  if (!targetUrl) return proxyUrl
  const sig = signMediaProxyPayload(exp, targetUrl, secret)
  absolute.searchParams.set('mp_exp', String(exp))
  absolute.searchParams.set('mp_sig', sig)
  return `${absolute.pathname}${absolute.search}`
}

export function createMediaProxyRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? MEDIA_PROXY_RATE_WINDOW_MS
  const max = options.max ?? MEDIA_PROXY_RATE_MAX
  const maxConcurrent = options.maxConcurrent ?? MEDIA_PROXY_MAX_CONCURRENT
  /** @type {Map<string, number[]>} */
  const hits = new Map()
  /** @type {Map<string, number>} */
  const inflight = new Map()

  function prune(key, now) {
    const list = hits.get(key) || []
    const next = list.filter((ts) => now - ts < windowMs)
    if (next.length) hits.set(key, next)
    else hits.delete(key)
    return next
  }

  return {
    tryAcquire(clientKey) {
      const key = clientKey || 'unknown'
      const now = Date.now()
      const recent = prune(key, now)
      if (recent.length >= max) {
        return { ok: false, statusCode: 429, message: 'Too many media proxy requests' }
      }
      const currentInflight = inflight.get(key) || 0
      if (currentInflight >= maxConcurrent) {
        return { ok: false, statusCode: 429, message: 'Too many concurrent media proxy requests' }
      }
      recent.push(now)
      hits.set(key, recent)
      inflight.set(key, currentInflight + 1)
      return {
        ok: true,
        release() {
          const next = (inflight.get(key) || 1) - 1
          if (next <= 0) inflight.delete(key)
          else inflight.set(key, next)
        },
      }
    },
  }
}

export function resolveMediaProxyClientKey(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim()
  }
  return req?.socket?.remoteAddress || 'unknown'
}

/** Nginx 主机白名单正则（与 isAllowedMediaProxyHostname 对齐） */
export const MEDIA_PROXY_NGINX_HOST_REGEX =
  '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.(oss-[a-z0-9-]+\\.aliyuncs\\.com|cos\\.[a-z0-9-]+\\.myqcloud\\.com)$'
