import type { IncomingMessage, ServerResponse } from 'node:http'

export interface MediaProxyOptions {
  /** false 时跳过上游 DNS 私网预检（仅用于本机 fake-IP DNS 环境） */
  enforceDnsGuard?: boolean
  /** 跳过 Bearer / users/me 校验（仅测试） */
  skipAuth?: boolean
  /** 未配置鉴权 API 时，仅校验 Bearer 存在（开发用） */
  allowBearerOnly?: boolean
}

export const MEDIA_PROXY_SECURITY_HEADERS: Readonly<Record<string, string>>
export const MEDIA_PROXY_MAX_BYTES: number
export const MEDIA_PROXY_TIMEOUT_MS: number

export function isAllowedMediaProxyUrl(rawUrl: string): boolean
export function isAllowedMediaProxyHostname(hostname: string): boolean
export function isAllowedContentType(contentType: string): boolean
export function resolveMediaProxyTargetUrl(rawUrl: string): string | null
export function isBlockedMediaProxyAddress(address: string): boolean
export function ensureMediaProxyHmacSecretConfigured(options?: {
  allowEphemeral?: boolean
  silent?: boolean
}): string
export function issueMediaProxySignedUrls(
  targetUrl: string,
  options?: { ttlSec?: number; nowSec?: number; secret?: string },
): { urls: string[]; exp: number; targetUrl: string }
export function resolveMediaProxyClientKey(
  req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } },
  options?: { trustProxy?: boolean },
): string
export function verifyMediaProxyRequestSignature(
  rawUrl: string,
  options?: { ttlSec?: number; nowSec?: number; secret?: string },
): { ok: true; targetUrl: string; exp: number } | { ok: false; statusCode: number; message: string }

export function proxyMediaTargetUrl(
  targetUrl: string,
  options?: MediaProxyOptions,
): Promise<{
  contentType: string
  contentLength: number
  body: ReadableStream<Uint8Array> | null
}>

export function handleMediaProxySignRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options?: MediaProxyOptions,
): Promise<boolean>

export function handleMediaProxyNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: string,
  options?: MediaProxyOptions,
): Promise<boolean>
