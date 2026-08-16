/**
 * 浏览器可见的业务 Bucket 主机名（非密钥）。
 * 仅用于判断是否值得请求服务端签发；真正放行仍由服务端精确白名单决定。
 */

const BUILTIN_ALLOWED_HOSTS = [
  'daone-oss.oss-accelerate.aliyuncs.com',
  'daone-oss.oss-cn-hangzhou.aliyuncs.com',
] as const

function parseHostList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function getClientMediaProxyAllowedHosts(): Set<string> {
  const fromEnv = parseHostList(
    import.meta.env.VITE_MEDIA_PROXY_ALLOWED_HOSTS as string | undefined,
  )
  return new Set([...BUILTIN_ALLOWED_HOSTS, ...fromEnv])
}

export function isAllowedMediaProxyHost(hostname: string): boolean {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
  if (!host) return false
  return getClientMediaProxyAllowedHosts().has(host)
}
