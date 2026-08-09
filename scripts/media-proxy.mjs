const MEDIA_PROXY_HOST_RE = /(^|\.)(aliyuncs\.com|myqcloud\.com)$/i

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
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  if (!MEDIA_PROXY_HOST_RE.test(parsed.hostname)) {
    return null
  }

  return parsed.toString()
}

export async function proxyMediaTargetUrl(targetUrl) {
  const upstream = await fetch(targetUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'daone-media-proxy/1.0' },
    redirect: 'follow',
  })

  if (!upstream.ok) {
    const error = new Error(`Upstream ${upstream.status}`)
    error.statusCode = upstream.status
    throw error
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await upstream.arrayBuffer())
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
