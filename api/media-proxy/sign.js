/**
 * Vercel：签发短时 media-proxy 令牌（密钥仅服务端环境变量）。
 */
import { handleMediaProxyNodeRequest } from '../../scripts/media-proxy.mjs'

export default async function mediaProxySign(req, res) {
  await handleMediaProxyNodeRequest(req, res, '/media-proxy/sign')
}
