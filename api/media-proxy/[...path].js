/**
 * Vercel：承接 /api/media-proxy/<host>/<path>（vercel.json rewrite 的 path 风格）
 */
import { handleMediaProxyNodeRequest } from '../../scripts/media-proxy.mjs'

export default async function mediaProxyPath(req, res) {
  const handled = await handleMediaProxyNodeRequest(req, res, req.url || '/')
  if (!handled) {
    res.statusCode = 404
    res.end('Not Found')
  }
}
