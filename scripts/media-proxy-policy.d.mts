export const MEDIA_PROXY_SIG_TTL_SEC: number
export const MEDIA_PROXY_MAX_BYTES: number
export const MEDIA_PROXY_TIMEOUT_MS: number
export const MEDIA_PROXY_MAX_REDIRECTS: number
export const MEDIA_PROXY_RATE_WINDOW_MS: number
export const MEDIA_PROXY_RATE_MAX: number
export const MEDIA_PROXY_MAX_CONCURRENT: number
export const MEDIA_PROXY_MIN_SECRET_LENGTH: number
export const MEDIA_PROXY_EXACT_HOSTS: readonly string[]

export function getMediaProxyExactHosts(): Set<string>
export function isAllowedMediaProxyHostname(hostname: string): boolean
export function isMediaProxyHmacSecretStrong(secret: string): boolean
export function getMediaProxyHmacSecret(options?: { optional?: boolean }): string
export function ensureMediaProxyHmacSecretConfigured(options?: {
  allowEphemeral?: boolean
  silent?: boolean
}): string
export function buildMediaProxySignaturePayload(exp: number | string, targetUrl: string): string
export function signMediaProxyPayload(
  exp: number | string,
  targetUrl: string,
  secret?: string,
): string
export function extractMediaProxyTargetFromRequestUrl(rawUrl: string): string | null
export function readMediaProxySignature(rawUrl: string): { exp: string; sig: string }
export function verifyMediaProxyRequestSignature(
  rawUrl: string,
  options?: { ttlSec?: number; nowSec?: number; secret?: string },
): { ok: true; targetUrl: string; exp: number } | { ok: false; statusCode: number; message: string }
export function issueMediaProxySignedUrls(
  targetUrl: string,
  options?: { ttlSec?: number; nowSec?: number; secret?: string },
): { urls: string[]; exp: number; targetUrl: string }
export function appendMediaProxySignature(
  proxyUrl: string,
  options?: { ttlSec?: number; nowSec?: number; secret?: string },
): string
export function createMediaProxyRateLimiter(options?: {
  windowMs?: number
  max?: number
  maxConcurrent?: number
}): {
  tryAcquire: (clientKey: string) =>
    | { ok: true; release: () => void }
    | { ok: false; statusCode: number; message: string }
}
export function resolveMediaProxyClientKey(
  req: {
    headers?: Record<string, string | string[] | undefined>
    socket?: { remoteAddress?: string }
  },
  options?: { trustProxy?: boolean },
): string
export function resolveMediaProxyAuthApiBase(): string
