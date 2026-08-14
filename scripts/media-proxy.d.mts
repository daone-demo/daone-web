import type { IncomingMessage, ServerResponse } from 'node:http'

export function resolveMediaProxyTargetUrl(rawUrl: string): string | null

export function proxyMediaTargetUrl(targetUrl: string): Promise<{
  contentType: string
  buffer: Buffer
}>

export function handleMediaProxyNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: string,
): Promise<boolean>
