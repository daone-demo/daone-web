import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import test from 'node:test'
import {
  appendMediaProxySignature,
  handleMediaProxyNodeRequest,
  isAllowedContentType,
  isAllowedMediaProxyUrl,
  MEDIA_PROXY_SECURITY_HEADERS,
  resolveMediaProxyTargetUrl,
} from './media-proxy.mjs'
import {
  createMediaProxyRateLimiter,
  isAllowedMediaProxyHostname,
  MEDIA_PROXY_MAX_BYTES,
  signMediaProxyPayload,
  verifyMediaProxyRequestSignature,
} from './media-proxy-policy.mjs'

const OSS_HOST = 'example-bucket.oss-cn-hangzhou.aliyuncs.com'
const DAONE_HOST = 'daone-oss.oss-accelerate.aliyuncs.com'

function signedProxyPath(pathname) {
  return appendMediaProxySignature(pathname)
}

test('isAllowedMediaProxyHostname 仅允许 OSS/COS 桶域名', () => {
  assert.equal(isAllowedMediaProxyHostname(OSS_HOST), true)
  assert.equal(isAllowedMediaProxyHostname(DAONE_HOST), true)
  assert.equal(isAllowedMediaProxyHostname('bucket.cos.ap-guangzhou.myqcloud.com'), true)
  assert.equal(isAllowedMediaProxyHostname('evil.aliyuncs.com'), false)
  assert.equal(isAllowedMediaProxyHostname('ram.aliyuncs.com'), false)
  assert.equal(isAllowedMediaProxyHostname('cdn.myqcloud.com'), false)
  assert.equal(isAllowedMediaProxyHostname('evil.example.com'), false)
})

test('isAllowedMediaProxyUrl rejects http and non-standard ports', () => {
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}/a.png`), true)
  assert.equal(isAllowedMediaProxyUrl(`http://${OSS_HOST}/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}:8443/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl('https://evil.example.com/a.png'), false)
  assert.equal(isAllowedMediaProxyUrl(`https://user:pass@${OSS_HOST}/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl('https://evil.aliyuncs.com/a.png'), false)
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

test('短时 HMAC：缺签/错签拒绝，正确签名通过', () => {
  const path = `/media-proxy/${OSS_HOST}/asset.png`
  assert.equal(verifyMediaProxyRequestSignature(path).ok, false)
  assert.equal(verifyMediaProxyRequestSignature(`${path}?mp_exp=1&mp_sig=deadbeef`).ok, false)

  const signed = appendMediaProxySignature(path)
  const verified = verifyMediaProxyRequestSignature(signed)
  assert.equal(verified.ok, true)
  assert.equal(verified.targetUrl, `https://${OSS_HOST}/asset.png`)

  const forged = `${path}?mp_exp=${Math.floor(Date.now() / 1000) + 600}&mp_sig=${signMediaProxyPayload(1, 'https://evil.example.com/x')}`
  assert.equal(verifyMediaProxyRequestSignature(forged).ok, false)
})

test('isAllowedContentType blocks active formats and allows passive media', () => {
  assert.equal(isAllowedContentType('image/png'), true)
  assert.equal(isAllowedContentType('image/jpeg; charset=binary'), true)
  assert.equal(isAllowedContentType('image/webp'), true)
  assert.equal(isAllowedContentType('video/mp4'), true)
  assert.equal(isAllowedContentType('audio/mpeg'), true)
  assert.equal(isAllowedContentType('application/octet-stream'), true)
  assert.equal(isAllowedContentType('application/zip'), true)

  assert.equal(isAllowedContentType('image/svg+xml'), false)
  assert.equal(isAllowedContentType('text/html'), false)
  assert.equal(isAllowedContentType('application/xhtml+xml'), false)
  assert.equal(isAllowedContentType('application/xml'), false)
  assert.equal(isAllowedContentType('text/xml'), false)
  assert.equal(isAllowedContentType('application/javascript'), false)
  assert.equal(isAllowedContentType('text/javascript'), false)
  assert.equal(isAllowedContentType('application/pdf'), false)
  assert.equal(isAllowedContentType('application/dash+xml'), false)
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
    assert.equal(response.headers.get('content-security-policy'), MEDIA_PROXY_SECURITY_HEADERS['Content-Security-Policy'])
    assert.equal(
      response.headers.get('cross-origin-resource-policy'),
      MEDIA_PROXY_SECURITY_HEADERS['Cross-Origin-Resource-Policy'],
    )
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
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

test('handleMediaProxyNodeRequest rejects non-bucket aliyuncs host', async () => {
  const proxy = createServer(async (req, res) => {
    await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyPort = proxy.address().port

  const unsigned = '/media-proxy/evil.aliyuncs.com/a.png'
  // 签名目标本身不在白名单时，append 仍会签名，但 resolve 应失败
  const signed = appendMediaProxySignature(unsigned)
  const response = await fetch(`http://127.0.0.1:${proxyPort}${signed}`)
  assert.equal(response.status, 400)

  proxy.close()
  await once(proxy, 'close')
})

test('handleMediaProxyNodeRequest rejects svg upstream content type', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
    res.end('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
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
      `http://127.0.0.1:${proxyPort}${signedProxyPath(`/media-proxy/${OSS_HOST}/evil.svg`)}`,
    )
    assert.equal(response.status, 415)
    assert.match(await response.text(), /content type not allowed/i)

    proxy.close()
    await once(proxy, 'close')
  } finally {
    restoreFetch()
    upstream.close()
    await once(upstream, 'close')
  }
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

test('handleMediaProxyNodeRequest rejects http target urls', async () => {
  const proxy = createServer(async (req, res) => {
    await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyPort = proxy.address().port

  const httpTarget = encodeURIComponent(`http://${OSS_HOST}/a.png`)
  const signed = appendMediaProxySignature(`/media-proxy?url=${httpTarget}`)
  const response = await fetch(`http://127.0.0.1:${proxyPort}${signed}`)
  // 签名校验基于提取目标；http 目标在 resolve 阶段被拒绝
  assert.ok(response.status === 400 || response.status === 401)

  proxy.close()
  await once(proxy, 'close')
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

test('限并发器在同时进行中超限返回 429', () => {
  const limiter = createMediaProxyRateLimiter({ windowMs: 60_000, max: 100, maxConcurrent: 2 })
  const a = limiter.tryAcquire('ip-2')
  const b = limiter.tryAcquire('ip-2')
  assert.equal(a.ok, true)
  assert.equal(b.ok, true)
  const blocked = limiter.tryAcquire('ip-2')
  assert.equal(blocked.ok, false)
  assert.equal(blocked.statusCode, 429)
  a.release()
  b.release()
  assert.equal(limiter.tryAcquire('ip-2').ok, true)
})
