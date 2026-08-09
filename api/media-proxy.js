/**
 * Vercel Serverless：同源代理对象存储，供 canvas 读取像素 / 批量下载打包。
 * 访问：/media-proxy?url=https%3A%2F%2F....（由 vercel.json 转到本函数）
 */
import { handleMediaProxyNodeRequest } from '../scripts/media-proxy.mjs'

export default async function mediaProxy(req, res) {
  await handleMediaProxyNodeRequest(req, res, req.url || '/')
}
