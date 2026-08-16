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
} from './media-proxy.mjs'

const OSS_HOST = 'example-bucket.oss-cn-hangzhou.aliyuncs.com'

test('isAllowedMediaProxyUrl rejects http and non-standard ports', () => {
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}/a.png`), true)
  assert.equal(isAllowedMediaProxyUrl(`http://${OSS_HOST}/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl(`https://${OSS_HOST}:8443/a.png`), false)
  assert.equal(isAllowedMediaProxyUrl('https://evil.example.com/a.png'), false)
  assert.equal(isAllowedMediaProxyUrl(`https://user:pass@${OSS_HOST}/a.png`), false)
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
    // 仅改写代理内部对对象存储上游的 HTTPS 请求；客户端访问本地代理的请求保持原样
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
      `http://127.0.0.1:${proxyPort}/media-proxy/${OSS_HOST}/asset.png`,
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
      `http://127.0.0.1:${proxyPort}/media-proxy/${OSS_HOST}/evil.svg`,
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

test('handleMediaProxyNodeRequest rejects http target urls', async () => {
  const proxy = createServer(async (req, res) => {
    await handleMediaProxyNodeRequest(req, res, req.url || '/', { enforceDnsGuard: false })
  })
  proxy.listen(0, '127.0.0.1')
  await once(proxy, 'listening')
  const proxyPort = proxy.address().port

  const httpTarget = encodeURIComponent(`http://${OSS_HOST}/a.png`)
  const response = await fetch(`http://127.0.0.1:${proxyPort}/media-proxy?url=${httpTarget}`)
  assert.equal(response.status, 400)

  proxy.close()
  await once(proxy, 'close')
})
