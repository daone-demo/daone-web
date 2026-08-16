import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import {
  handleMediaProxyNodeRequest,
  isAllowedContentType,
  isAllowedMediaProxyUrl,
  MEDIA_PROXY_SECURITY_HEADERS,
  resolveMediaProxyTargetUrl,
  issueMediaProxySignedUrls,
  resolveMediaProxyClientKey,
  ensureMediaProxyHmacSecretConfigured,
} from './media-proxy.mjs'
import {
  createMediaProxyRateLimiter,
  isAllowedMediaProxyHostname,
  MEDIA_PROXY_MAX_BYTES,
  signMediaProxyPayload,
  verifyMediaProxyRequestSignature,
} from './media-proxy-policy.mjs'

process.env.NODE_ENV = 'test'
ensureMediaProxyHmacSecretConfigured({ allowEphemeral: true, silent: true })

const OSS_HOST = 'daone-oss.oss-cn-hangzhou.aliyuncs.com'
const DAONE_HOST = 'daone-oss.oss-accelerate.aliyuncs.com'

function signedProxyPath(pathname) {
  const target = extractTargetFromProxyPath(pathname)
  return issueMediaProxySignedUrls(target).urls[0]
}

function extractTargetFromProxyPath(pathname) {
  const url = new URL(pathname, 'http://localhost')
  if (url.searchParams.get('url')) return url.searchParams.get('url')
  const match = url.pathname.match(/^\/media-proxy\/([^/]+)\/(.+)$/)
  if (!match) throw new Error(`bad path ${pathname}`)
  return `https://${match[1]}/${match[2]}${url.search || ''}`
}

test('isAllowedMediaProxyHostname 仅精确业务桶', () => {
  assert.equal(isAllowedMediaProxyHostname(OSS_HOST), true)
  assert.equal(isAllowedMediaProxyHostname(DAONE_HOST), true)
  assert.equal(isAllowedMediaProxyHostname('example-bucket.oss-cn-hangzhou.aliyuncs.com'), false)
  assert.equal(isAllowedMediaProxyHostname('bucket.cos.ap-guangzhou.myqcloud.com'), false)
  assert.equal(isAllowedMediaProxyHostname('evil.aliyuncs.com'), false)
  assert.equal(isAllowedMediaProxyHostname('ram.aliyuncs.com'), false)
})

test('前端可达代码不包含 HMAC 签发能力（无默认密钥常量）', async () => {
  const fs = await import('node:fs/promises')
  const clientSource = await fs.readFile(
    new URL('../src/components/Canvas/mediaProxy.ts', import.meta.url),
    'utf8',
  )
  assert.equal(clientSource.includes('appendMediaProxySignature'), false)
  assert.equal(clientSource.includes('signMediaProxyPayload'), false)
  assert.equal(clientSource.includes('MEDIA_PROXY_HMAC'), false)
  assert.equal(clientSource.includes('hmacSha256'), false)
  assert.match(clientSource, /mintMediaProxyCandidates/)
  assert.match(clientSource, /\/media-proxy\/sign/)
})

test('isAllowedMediaProxyUrl rejects http and non-business hosts', () => {
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}/a.png`), true)
  assert.equal(isAllowedMediaProxyUrl(`http://${OSS_HOST}/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}:8443/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl('https://evil.example.com/a.png'), false)
  assert.equal(isAllowedMediaProxyUrl(`https://user:pass@${OSS_HOST}/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl('https://example-bucket.oss-cn-hangzhou.aliyuncs.com/a.png'), false)
})

test('resolveMediaProxyTargetUrl accepts https path/query and rejects http', () => {
  const httpsTarget = `https://${OSS_HOST}/path/to/file.png?x=1`
  assert.equal(
    resolveMediaProxyTargetUrl(`/media-proxy/${OSS_HOST}/path/to/file.png?x=1`),
    httpsTarget,
  )
  assert.equal(
    resolveMediaProxyTargetUrl(`/api/media-proxy/${OSS_HOST}/path/to/file.png?x=1`),
    httpsTarget,
  )
  assert.equal(
    resolveMediaProxyTargetUrl(`/media-proxy?url=${encodeURIComponent(httpsTarget)}`),
    httpsTarget,
  )
  assert.equal(
    resolveMediaProxyTargetUrl(`/media-proxy?url=${encodeURIComponent(`http://${OSS_HOST}/a.png`)}`),
    null,
  )
  assert.equal(resolveMediaProxyTargetUrl('/media-proxy'), null)
})

test('短时 HMAC：缺签/错签拒绝，服务端签发通过', () => {
  const path = `/media-proxy/${OSS_HOST}/asset.png`
  assert.equal(verifyMediaProxyRequestSignature(path).ok, false)
  assert.equal(verifyMediaProxyRequestSignature(`${path}?mp_exp=1&mp_sig=deadbeef`).ok, false)

  const signed = signedProxyPath(path)
  const verified = verifyMediaProxyRequestSignature(signed)
  assert.equal(verified.ok, true)
  assert.equal(verified.targetUrl, `https://${OSS_HOST}/asset.png`)

  const forged = `${path}?mp_exp=${Math.floor(Date.now() / 1000) + 600}&mp_sig=${signMediaProxyPayload(1, 'https://evil.example.com/x')}`
  assert.equal(verifyMediaProxyRequestSignature(forged).ok, false)
})

test('非业务 Bucket 无法签发', () => {
  assert.throws(
    () => issueMediaProxySignedUrls('https://example-bucket.oss-cn-hangzhou.aliyuncs.com/a.png'),
    /not allowed/i,
  )
})

test('默认不信任伪造的 X-Forwarded-For', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
  }
  assert.equal(resolveMediaProxyClientKey(req), '127.0.0.1')
  assert.equal(resolveMediaProxyClientKey(req, { trustProxy: true }), '203.0.113.9')
})

test('伪造 XFF 在未开启 trustProxy 时不能换限流桶', () => {
  const limiter = createMediaProxyRateLimiter({ windowMs: 60_000, max: 2, maxConcurrent: 8 })
  const socketReq = {
    headers: { 'x-forwarded-for': '198.51.100.1' },
    socket: { remoteAddress: '10.1.1.1' },
  }
  const key = resolveMediaProxyClientKey(socketReq)
  assert.equal(key, '10.1.1.1')
  assert.equal(limiter.tryAcquire(key).ok, true)
  assert.equal(limiter.tryAcquire(key).ok, true)
  assert.equal(limiter.tryAcquire(key).ok, false)

  // 换一个伪造 XFF 仍落到同一 socket key
  const forged = {
    headers: { 'x-forwarded-for': '198.51.100.2' },
    socket: { remoteAddress: '10.1.1.1' },
  }
  assert.equal(resolveMediaProxyClientKey(forged), '10.1.1.1')
  assert.equal(limiter.tryAcquire(resolveMediaProxyClientKey(forged)).ok, false)
})

test('isAllowedContentType blocks active formats and allows passive media', () => {
  assert.equal(isAllowedContentType('image/png'), true)
  assert.equal(isAllowedContentType('image/svg+xml'), false)
  assert.equal(isAllowedContentType('text/html'), false)
  assert.equal(isAllowedContentType('application/javascript'), false)
})

function installUpstreamFetchMock(upstreamPort) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.startsWith(`https://${OSS_HOST}/`)) {
      const pathname = new URL(url).pathname
      return originalFetch(`http://127.0.0.1:${upstreamPort}${pathname}`, init)
    }
    return originalFetch(input, init)
  }
  return () => {
    globalThis.fetch = originalFetch
  }
}

test('handleMediaProxyNodeRequest returns security headers for allowed media', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': '4',
    })
    res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const { port } = upstream.address()
  const restoreFetch = installUpstreamFetchMock(port)

  try {
    const proxy = createServer(async (req, res) => {
      await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
    })
    proxy.listen(0, '127.0.0.1')
    await once(proxy, 'listening')
    const proxyPort = proxy.address().port

    const response = await fetch(
      `http://127.0.0.1:${proxyPort}${signedProxyPath(`/media-proxy/${OSS_HOST}/asset.png`)}`,
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('content-disposition'), MEDIA_PROXY_SECURITY_HEADERS['Content-Disposition'])
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    proxy.close()
    await once(proxy, 'close')
  } finally {
    restoreFetch()
    upstream.close()
    await once(upstream, 'close')
  }
})

test('handleMediaProxyNodeRequest rejects missing signature', async () => {
  const proxy = createServer(async (req, res) => {
    await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyPort = proxy.address().port

  const response = await fetch(`http://127.0.0.1:${proxyPort}/media-proxy/${OSS_HOST}/asset.png`)
  assert.equal(response.status, 401)

  proxy.close()
  await once(proxy, 'close')
})

test('sign 接口无 Bearer 拒绝，有 Bearer 可签发业务桶', async () => {
  const proxy = createServer(async (req, res) => {
    await handleMediaProxyNodeRequest(req, res, req.url || '/', {
      enforceDnsGuard: false,
      skipAuth: false,
      allowBearerOnly: true,
    })
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyPort = proxy.address().port

  const unauthorized = await fetch(`http://127.0.0.1:${proxyPort}/media-proxy/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `https://${OSS_HOST}/a.png` }),
  })
  assert.equal(unauthorized.status, 401)

  const authorized = await fetch(`http://127.0.0.1:${proxyPort}/media-proxy/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token-1234567890',
    },
    body: JSON.stringify({ url: `https://${OSS_HOST}/a.png` }),
  })
  assert.equal(authorized.status, 200)
  const payload = await authorized.json()
  assert.ok(Array.isArray(payload.urls) && payload.urls.length >= 1)
  assert.equal(verifyMediaProxyRequestSignature(payload.urls[0]).ok, true)

  const foreign = await fetch(`http://127.0.0.1:${proxyPort}/media-proxy/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token-1234567890',
    },
    body: JSON.stringify({ url: 'https://example-bucket.oss-cn-hangzhou.aliyuncs.com/a.png' }),
  })
  assert.equal(foreign.status, 403)

  proxy.close()
  await once(proxy, 'close')
})

test('handleMediaProxyNodeRequest rejects oversized content-length', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': String(MEDIA_PROXY_MAX_BYTES + 1),
    })
    res.end()
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const { port } = upstream.address()
  const restoreFetch = installUpstreamFetchMock(port)

  try {
    const proxy = createServer(async (req, res) => {
      await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
    })
    proxy.listen(0, '127.0.0.1')
    await once(proxy, 'listening')
    const proxyPort = proxy.address().port

    const response = await fetch(
      `http://127.0.0.1:${proxyPort}${signedProxyPath(`/media-proxy/${OSS_HOST}/huge.png`)}`,
    )
    assert.equal(response.status, 413)

    proxy.close()
    await once(proxy, 'close')
  } finally {
    restoreFetch()
    upstream.close()
    await once(upstream, 'close')
  }
})

test('限频器在窗口内超限返回 429', () => {
  const limiter = createMediaProxyRateLimiter({ windowMs: 60_000, max: 3, maxConcurrent: 8 })
  assert.equal(limiter.tryAcquire('ip-1').ok, true)
  assert.equal(limiter.tryAcquire('ip-1').ok, true)
  assert.equal(limiter.tryAcquire('ip-1').ok, true)
  const blocked = limiter.tryAcquire('ip-1')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.statusCode, 429)
})
