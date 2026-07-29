/**
 * Vercel Serverless：同源代理阿里云 OSS，供 canvas 读取像素。
 * 访问：/media-proxy?url=https%3A%2F%2F....（由 vercel.json 转到本函数）
 *
 * 注意：项目 package.json 为 "type": "module"，此处必须使用 ESM default export。
 */
export default async function mediaProxy(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  try {
    const incoming = new URL(req.url || '/', 'http://localhost')
    let targetUrl = incoming.searchParams.get('url') || ''

    // 兼容 path 风格：/media-proxy/<host>/<path>
    if (!targetUrl) {
      const pathMatch = incoming.pathname.match(/^\/(?:api\/)?media-proxy\/([^/]+)\/(.+)$/)
      if (pathMatch) {
        targetUrl = `https://${pathMatch[1]}/${pathMatch[2]}${incoming.search || ''}`
      }
    }

    if (!targetUrl) {
      res.statusCode = 400
      res.end('Missing url')
      return
    }

    const parsed = new URL(targetUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.statusCode = 400
      res.end('Invalid protocol')
      return
    }
    if (!/(^|\.)(aliyuncs\.com|myqcloud\.com)$/i.test(parsed.hostname)) {
      res.statusCode = 403
      res.end('Host not allowed')
      return
    }

    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      headers: {
        // 避免部分 CDN 对缺 UA 的拒绝
        'User-Agent': 'daone-media-proxy/1.0',
      },
      redirect: 'follow',
    })

    if (!upstream.ok) {
      res.statusCode = upstream.status
      res.end(`Upstream ${upstream.status}`)
      return
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.end(buffer)
  } catch (error) {
    res.statusCode = 502
    res.end(error instanceof Error ? error.message : 'Proxy failed')
  }
}
