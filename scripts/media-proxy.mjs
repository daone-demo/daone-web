const MEDIA_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i
const MEDIA_PROXY_TIMEOUT_MS = 15_000
const MEDIA_PROXY_MAX_BYTES = 50 * 1024 * 1024
const MEDIA_PROXY_MAX_REDIRECTS = 3

function isAllowedMediaProxyUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      MEDIA_PROXY_HOST_RE.test(parsed.hostname)
  } catch {
    return false
  }
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
  const contentLength = Number(upstream.headers.get('content-length') || 0)
  if (contentLength > MEDIA_PROXY_MAX_BYTES) {
    const error = new Error('Upstream response too large')
    error.statusCode = 413
    throw error
  }
  const buffer = Buffer.from(await upstream.arrayBuffer())
  if (buffer.byteLength > MEDIA_PROXY_MAX_BYTES) {
    const error = new Error('Upstream response too large')
    error.statusCode = 413
    throw error
  }
  return { contentType, buffer }
}

export async function handleMediaProxyNodeRequest(req, res, requestUrl) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return true
  }

  const targetUrl = resolveMediaProxyTargetUrl(requestUrl)
  if (!targetUrl) {
    res.statusCode = 400
    res.end('Missing or invalid url')
    return true
  }

  try {
    const { contentType, buffer } = await proxyMediaTargetUrl(targetUrl)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(buffer)
  } catch (error) {
    res.statusCode = error?.statusCode || 502
    res.end(error instanceof Error ? error.message : 'Proxy failed')
  }

  return true
}
