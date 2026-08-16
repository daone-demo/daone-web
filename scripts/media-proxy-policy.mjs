/**
 * media-proxy 服务端安全策略（仅 Node / 测试加载，禁止打进浏览器产物）。
 * - 精确业务 Bucket 白名单（无 OSS/COS 正则兜底）
 * - 短时 HMAC（密钥仅服务端；无内置生产默认密钥）
 * - 进程内限频 / 限并发
 * - 客户端 IP：默认只用 socket；仅受控反代开启时信任 XFF
 */

import { randomBytes } from 'node:crypto'
import { hmacSha256Hex, safeEqualString } from './media-proxy-hmac.mjs'

export const MEDIA_PROXY_SIG_TTL_SEC = 10 * 60
export const MEDIA_PROXY_MAX_BYTES = 50 * 1024 * 1024
export const MEDIA_PROXY_TIMEOUT_MS = 15_000
export const MEDIA_PROXY_MAX_REDIRECTS = 3
export const MEDIA_PROXY_RATE_WINDOW_MS = 60_000
export const MEDIA_PROXY_RATE_MAX = 60
export const MEDIA_PROXY_MAX_CONCURRENT = 8
export const MEDIA_PROXY_MIN_SECRET_LENGTH = 32

/** 业务精确桶（可用 MEDIA_PROXY_ALLOWED_HOSTS 追加，不可用正则放开） */
export const MEDIA_PROXY_EXACT_HOSTS = Object.freeze([
  'daone-oss.oss-accelerate.aliyuncs.com',
  'daone-oss.oss-cn-hangzhou.aliyuncs.com',
])

const WEAK_SECRETS = new Set([
  'daone-media-proxy-hmac-v1',
  'secret',
  'password',
  'changeme',
  'media-proxy',
])

function readProcessEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return String(process.env[name])
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
  const fromEnv = parseExactHostsFromEnv(readProcessEnv('MEDIA_PROXY_ALLOWED_HOSTS'))
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
  return getMediaProxyExactHosts().has(host)
}

export function isMediaProxyHmacSecretStrong(secret) {
  const value = String(secret || '').trim()
  if (value.length < MEDIA_PROXY_MIN_SECRET_LENGTH) return false
  if (WEAK_SECRETS.has(value.toLowerCase())) return false
  return true
}

/**
 * 读取服务端 HMAC 密钥。故意不读取任何 VITE_* 变量，避免与前端产物耦合。
 * @param {{ optional?: boolean }} [options]
 */
export function getMediaProxyHmacSecret(options = {}) {
  const fromEnv = readProcessEnv('MEDIA_PROXY_HMAC_SECRET').trim()
  if (fromEnv) {
    if (!isMediaProxyHmacSecretStrong(fromEnv)) {
      const error = new Error(
        'MEDIA_PROXY_HMAC_SECRET is too weak (min 32 chars, not a known default)',
      )
      error.statusCode = 500
      throw error
    }
    return fromEnv
  }
  if (options.optional) return ''
  const error = new Error('MEDIA_PROXY_HMAC_SECRET is required')
  error.statusCode = 500
  throw error
}

/**
 * 生产启动必须配置强密钥；测试/开发可显式允许进程内临时密钥。
 */
export function ensureMediaProxyHmacSecretConfigured(options = {}) {
  const existing = readProcessEnv('MEDIA_PROXY_HMAC_SECRET').trim()
  if (existing) {
    if (!isMediaProxyHmacSecretStrong(existing)) {
      throw new Error(
        '[media-proxy] MEDIA_PROXY_HMAC_SECRET is too weak (min 32 chars, not a known default)',
      )
    }
    return existing
  }

  const allowEphemeral =
    options.allowEphemeral === true ||
    readProcessEnv('MEDIA_PROXY_ALLOW_EPHEMERAL_SECRET') === '1' ||
    readProcessEnv('NODE_ENV') === 'test'

  if (!allowEphemeral) {
    throw new Error(
      '[media-proxy] MEDIA_PROXY_HMAC_SECRET must be set to a strong random value (>=32 chars)',
    )
  }

  const generated = randomBytes(32).toString('hex')
  process.env.MEDIA_PROXY_HMAC_SECRET = generated
  if (options.silent !== true) {
    console.warn(
      '[media-proxy] MEDIA_PROXY_HMAC_SECRET missing; generated ephemeral secret for this process only',
    )
  }
  return generated
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
  let secret
  try {
    secret = options.secret ?? getMediaProxyHmacSecret()
  } catch (error) {
    return {
      ok: false,
      statusCode: error?.statusCode || 500,
      message: error instanceof Error ? error.message : 'Proxy signing unavailable',
    }
  }
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
 * 服务端为上游目标签发短时代理 URL（path + query 两种形态）。
 */
export function issueMediaProxySignedUrls(targetUrl, options = {}) {
  const ttlSec = options.ttlSec ?? MEDIA_PROXY_SIG_TTL_SEC
  const nowSec =
    typeof options.nowSec === 'number' ? options.nowSec : Math.floor(Date.now() / 1000)
  const secret = options.secret ?? getMediaProxyHmacSecret()
  const parsed = new URL(targetUrl)
  if (!isAllowedMediaProxyHostname(parsed.hostname)) {
    const error = new Error('Upstream host not allowed')
    error.statusCode = 403
    throw error
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    const error = new Error('Upstream url not allowed')
    error.statusCode = 400
    throw error
  }
  if (parsed.port && parsed.port !== '443') {
    const error = new Error('Upstream url not allowed')
    error.statusCode = 400
    throw error
  }

  const canonical = parsed.toString()
  const exp = nowSec + ttlSec
  const sig = signMediaProxyPayload(exp, canonical, secret)
  const pathname = parsed.pathname.replace(/^\//, '')
  const originalQuery = parsed.search ? parsed.search.slice(1) : ''
  const pathParams = new URLSearchParams(originalQuery)
  pathParams.set('mp_exp', String(exp))
  pathParams.set('mp_sig', sig)
  const pathStyle = `/media-proxy/${parsed.hostname}/${pathname}?${pathParams.toString()}`

  const queryParams = new URLSearchParams()
  queryParams.set('url', canonical)
  queryParams.set('mp_exp', String(exp))
  queryParams.set('mp_sig', sig)
  const queryStyle = `/media-proxy?${queryParams.toString()}`

  return { urls: [pathStyle, queryStyle], exp, targetUrl: canonical }
}

/** @deprecated 仅服务端/测试使用；勿在浏览器调用 */
export function appendMediaProxySignature(proxyUrl, options = {}) {
  const targetUrl = extractMediaProxyTargetFromRequestUrl(proxyUrl)
  if (!targetUrl) return proxyUrl
  const issued = issueMediaProxySignedUrls(targetUrl, options)
  const incoming = new URL(proxyUrl, 'http://localhost')
  if (incoming.searchParams.has('url')) return issued.urls[1]
  return issued.urls[0]
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

/**
 * 解析限流用客户端标识。
 * 默认只用 socket 地址；仅当 MEDIA_PROXY_TRUST_PROXY=1（或 options.trustProxy）时信任 X-Forwarded-For。
 */
export function resolveMediaProxyClientKey(req, options = {}) {
  const trustProxy =
    options.trustProxy === true || readProcessEnv('MEDIA_PROXY_TRUST_PROXY') === '1'
  if (trustProxy) {
    const forwarded = req?.headers?.['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim()
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return String(forwarded[0]).split(',')[0].trim()
    }
  }
  return req?.socket?.remoteAddress || 'unknown'
}

export function resolveMediaProxyAuthApiBase() {
  const explicit = readProcessEnv('MEDIA_PROXY_AUTH_API_BASE').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const host = readProcessEnv('VITE_API_BASE_HOST').trim()
  if (host) return `${host.replace(/\/$/, '')}/api/api/v1`
  const base = readProcessEnv('VITE_API_BASE_URL').trim()
  if (/^https?:\/\//i.test(base)) return base.replace(/\/$/, '')
  return ''
}
