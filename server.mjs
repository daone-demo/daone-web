/**
 * 生产静态资源服务 + /media-proxy（与本地 Vite 插件行为一致）。
 * 用法：npm run build:prod && npm start
 * 或在 nginx 后反代：proxy_pass http://127.0.0.1:3000;
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleMediaProxyNodeRequest } from './scripts/media-proxy.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

function resolveStaticPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname.split('?')[0] || '/')
  const relative = decoded.replace(/^\/+/, '')
  const filePath = path.join(DIST_DIR, relative || 'index.html')
  const normalized = path.normalize(filePath)
  if (!normalized.startsWith(DIST_DIR)) return null
  return normalized
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  res.statusCode = 200
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const requestUrl = req.url || '/'

  if (requestUrl.startsWith('/media-proxy')) {
    await handleMediaProxyNodeRequest(req, res, requestUrl)
    return
  }

  const filePath = resolveStaticPath(new URL(requestUrl, 'http://localhost').pathname)
  if (!filePath) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, filePath)
      return
    }

    const indexPath = path.join(DIST_DIR, 'index.html')
    fs.stat(indexPath, (indexError, indexStats) => {
      if (indexError || !indexStats.isFile()) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }
      sendFile(res, indexPath)
    })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[daone-web] serving ${DIST_DIR} at http://${HOST}:${PORT}`)
})
