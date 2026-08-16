/** 将接口/持久化数据中可能出现的素材 ID 规范为字符串（兼容 number 类型） */
export function normalizeAssetId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}
