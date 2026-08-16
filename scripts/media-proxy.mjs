import dns from 'node:dns/promises'
import net from 'node:net'
import {
  MEDIA_PROXY_MAX_BYTES,
  MEDIA_PROXY_MAX_REDIRECTS,
  MEDIA_PROXY_TIMEOUT_MS,
  appendMediaProxySignature,
  createMediaProxyRateLimiter,
  isAllowedMediaProxyHostname,
  resolveMediaProxyClientKey,
  verifyMediaProxyRequestSignature,
} from './media-proxy-policy.mjs'

export {
  MEDIA_PROXY_MAX_BYTES,
  MEDIA_PROXY_TIMEOUT_MS,
  appendMediaProxySignature,
  isAllowedMediaProxyHostname,
  verifyMediaProxyRequestSignature,
} from './media-proxy-policy.mjs'

/** 允许代理的被动媒体类型；主动可执行文档（SVG/HTML/XML/JS/PDF）一律拒绝 */
const MEDIA_PROXY_ALLOWED_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'model/',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/vnd.apple.mpegurl',
]

const MEDIA_PROXY_BLOCKED_CONTENT_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/xml',
  'application/xml',
  'image/xml',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript',
  'application/pdf',
  'application/x-javascript',
  'application/dash+xml',
])

export const MEDIA_PROXY_SECURITY_HEADERS = Object.freeze({
  'Content-Disposition': 'attachment',
  'Content-Security-Policy': "sandbox; default-src 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'public, max-age=3600',
})

const mediaProxyRateLimiter = createMediaProxyRateLimiter()

function normalizeContentType(contentType) {
  return String(contentType || '').split(';', 1)[0].trim().toLowerCase()
}

export function isAllowedMediaProxyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const isStandardPort = !parsed.port || parsed.port === '443'
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      isStandardPort &&
      isAllowedMediaProxyHostname(parsed.hostname)
    )
  } catch {
    return false
  }
}

function isBlockedIpv4(address) {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b, c] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

export function isBlockedMediaProxyAddress(address) {
  const normalized = address.toLowerCase().split('%')[0]
  const ipVersion = net.isIP(normalized)
  if (ipVersion === 4) return isBlockedIpv4(normalized)
  if (ipVersion !== 6) return true

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4[1])

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
  )
}

/**
 * DNS 预检是否强制生效。
 * fake-IP 模式的本地 DNS 代理（Clash / Surge 等）会把公网域名解析到 198.18.0.0/15、
 * fdfe:dcba:9876::/48 等保留段，使合法对象存储域名被判为私网地址而返回 403。
 * 因此开发服务器可显式关闭预检；生产入口（server.mjs、api/*）默认保持开启。
 */
function shouldEnforceDnsGuard(override) {
  if (process.env.MEDIA_PROXY_ENFORCE_DNS_GUARD === '0') return false
  if (process.env.MEDIA_PROXY_ENFORCE_DNS_GUARD === '1') return true
  return override !== false
}

async function assertPublicMediaProxyHost(hostname) {
  let addresses
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    const error = new Error('Unable to resolve upstream host')
    error.statusCode = 502
    throw error
  }
  if (!addresses.length || addresses.some(({ address }) => isBlockedMediaProxyAddress(address))) {
    const error = new Error('Upstream address not allowed')
    error.statusCode = 403
    throw error
  }
}

export function isAllowedContentType(contentType) {
  const normalized = normalizeContentType(contentType)
  if (!normalized || MEDIA_PROXY_BLOCKED_CONTENT_TYPES.has(normalized)) {
    return false
  }
  if (normalized.includes('svg') || normalized.includes('javascript') || normalized.endsWith('+xml')) {
    return false
  }
  return MEDIA_PROXY_ALLOWED_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith('/') ? normalized.startsWith(allowed) : normalized === allowed,
  )
}

export function resolveMediaProxyTargetUrl(rawUrl) {
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
    if (!isAllowedMediaProxyUrl(parsed.toString())) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function applyMediaProxySecurityHeaders(res) {
  for (const [name, value] of Object.entries(MEDIA_PROXY_SECURITY_HEADERS)) {
    res.setHeader(name, value)
  }
}

export async function proxyMediaTargetUrl(targetUrl, options = {}) {
  const enforceDnsGuard = shouldEnforceDnsGuard(options.enforceDnsGuard)
  let currentUrl = targetUrl
  let upstream

  for (let redirectCount = 0; redirectCount <= MEDIA_PROXY_MAX_REDIRECTS; redirectCount += 1) {
    if (!isAllowedMediaProxyUrl(currentUrl)) {
      const error = new Error('Upstream host not allowed')
      error.statusCode = 403
      throw error
    }

    if (enforceDnsGuard) {
      await assertPublicMediaProxyHost(new URL(currentUrl).hostname)
    }
    upstream = await fetch(currentUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'daone-media-proxy/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(MEDIA_PROXY_TIMEOUT_MS),
    })

    if (upstream.status < 300 || upstream.status >= 400) break
    const location = upstream.headers.get('location')
    if (!location || redirectCount === MEDIA_PROXY_MAX_REDIRECTS) {
      const error = new Error('Too many upstream redirects')
      error.statusCode = 502
      throw error
    }
    currentUrl = new URL(location, currentUrl).toString()
  }

  if (!upstream?.ok) {
    const error = new Error(`Upstream ${upstream.status}`)
    error.statusCode = upstream.status
    throw error
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  if (!isAllowedContentType(contentType)) {
    const error = new Error('Upstream content type not allowed')
    error.statusCode = 415
    throw error
  }
  const contentLengthHeader = upstream.headers.get('content-length')
  const contentLength = contentLengthHeader == null ? 0 : Number(contentLengthHeader)
  if (
    contentLengthHeader != null &&
    (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MEDIA_PROXY_MAX_BYTES)
  ) {
    const error = new Error('Upstream response too large')
    error.statusCode = 413
    throw error
  }
  return { contentType, contentLength, body: upstream.body }
}

async function pipeMediaProxyBody(body, res) {
  if (!body) {
    res.end()
    return
  }

  let receivedBytes = 0
  for await (const chunk of body) {
    receivedBytes += chunk.byteLength
    if (receivedBytes > MEDIA_PROXY_MAX_BYTES) {
      await body.cancel('Upstream response too large').catch(() => {})
      res.destroy(new Error('Upstream response too large'))
      return
    }
    if (!res.write(Buffer.from(chunk))) {
      await new Promise((resolve) => res.once('drain', resolve))
    }
  }
  res.end()
}

export async function handleMediaProxyNodeRequest(req, res, requestUrl, options = {}) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return true
  }

  if (req.headers?.['sec-fetch-site'] === 'cross-site') {
    res.statusCode = 403
    res.end('Cross-site request not allowed')
    return true
  }

  const signature = verifyMediaProxyRequestSignature(requestUrl)
  if (!signature.ok) {
    res.statusCode = signature.statusCode
    res.end(signature.message)
    return true
  }

  const targetUrl = resolveMediaProxyTargetUrl(requestUrl)
  if (!targetUrl) {
    res.statusCode = 400
    res.end('Missing or invalid url')
    return true
  }

  const rate = mediaProxyRateLimiter.tryAcquire(resolveMediaProxyClientKey(req))
  if (!rate.ok) {
    res.statusCode = rate.statusCode
    res.end(rate.message)
    return true
  }

  try {
    const { contentType, contentLength, body } = await proxyMediaTargetUrl(targetUrl, options)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    if (contentLength > 0) {
      res.setHeader('Content-Length', contentLength)
    }
    applyMediaProxySecurityHeaders(res)
    await pipeMediaProxyBody(body, res)
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined)
      return true
    }
    res.statusCode = error?.statusCode || 502
    res.end(error instanceof Error ? error.message : 'Proxy failed')
  } finally {
    rate.release()
  }

  return true
}
