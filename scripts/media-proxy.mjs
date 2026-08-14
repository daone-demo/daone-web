import dns from 'node:dns/promises'
import net from 'node:net'

const MEDIA_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i
const MEDIA_PROXY_TIMEOUT_MS = 15_000
const MEDIA_PROXY_MAX_BYTES = 50 * 1024 * 1024
const MEDIA_PROXY_MAX_REDIRECTS = 3
const MEDIA_PROXY_ALLOWED_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'model/',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/vnd.apple.mpegurl',
  'application/dash+xml',
]

function isAllowedMediaProxyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const isStandardPort = !parsed.port ||
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.username &&
      !parsed.password &&
      isStandardPort &&
      MEDIA_PROXY_HOST_RE.test(parsed.hostname)
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
  return a === 0 ||
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
}

export function isBlockedMediaProxyAddress(address) {
  const normalized = address.toLowerCase().split('%')[0]
  const ipVersion = net.isIP(normalized)
  if (ipVersion === 4) return isBlockedIpv4(normalized)
  if (ipVersion !== 6) return true

  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4[1])

  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('2001:db8:')
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

function isAllowedContentType(contentType) {
  const normalized = contentType.split(';', 1)[0].trim().toLowerCase()
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
      targetUrl = `https://${pathMatch[1]}/${pathMatch[2]}${incoming.search || ''}`
    }
  }

  if (!targetUrl) return null

  const parsed = new URL(targetUrl)
  if (!isAllowedMediaProxyUrl(parsed.toString())) {
    return null
  }

  return parsed.toString()
}

export async function proxyMediaTargetUrl(targetUrl) {
  let currentUrl = targetUrl
  let upstream

  for (let redirectCount = 0; redirectCount <= MEDIA_PROXY_MAX_REDIRECTS; redirectCount += 1) {
    if (!isAllowedMediaProxyUrl(currentUrl)) {
      const error = new Error('Upstream host not allowed')
      error.statusCode = 403
      throw error
    }

    await assertPublicMediaProxyHost(new URL(currentUrl).hostname)
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
  const contentLength = Number(upstream.headers.get('content-length') || 0)
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > MEDIA_PROXY_MAX_BYTES) {
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

export async function handleMediaProxyNodeRequest(req, res, requestUrl) {
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

  const targetUrl = resolveMediaProxyTargetUrl(requestUrl)
  if (!targetUrl) {
    res.statusCode = 400
    res.end('Missing or invalid url')
    return true
  }

  try {
    const { contentType, contentLength, body } = await proxyMediaTargetUrl(targetUrl)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    if (contentLength > 0) {
      res.setHeader('Content-Length', contentLength)
    }
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    await pipeMediaProxyBody(body, res)
  } catch (error) {
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined)
      return true
    }
    res.statusCode = error?.statusCode || 502
    res.end(error instanceof Error ? error.message : 'Proxy failed')
  }

  return true
}
