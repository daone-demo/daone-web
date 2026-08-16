import type { IncomingMessage, ServerResponse } from 'node:http'

export interface MediaProxyOptions {
  /** false 时跳过上游 DNS 私网预检（仅用于本机 fake-IP DNS 环境） */
  enforceDnsGuard?: boolean
}

export const MEDIA_PROXY_SECURITY_HEADERS: Readonly<Record<string, string>>

export function isAllowedMediaProxyUrl(rawUrl: string): boolean

export function isAllowedContentType(contentType: string): boolean

export function resolveMediaProxyTargetUrl(rawUrl: string): string | null

export function isBlockedMediaProxyAddress(address: string): boolean

export function proxyMediaTargetUrl(
  targetUrl: string,
  options?: MediaProxyOptions,
): Promise<{
  contentType: string
  contentLength: number
  body: ReadableStream<Uint8Array> | null
}>

export function handleMediaProxyNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: string,
  options?: MediaProxyOptions,
): Promise<boolean>
