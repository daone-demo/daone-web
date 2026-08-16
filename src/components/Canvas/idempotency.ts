export function createIdempotencyKey(prefix: string, index?: number): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  const indexPart = index === undefined ? '' : `-${index}`
  return `${prefix}-${Date.now()}${indexPart}-${Math.random().toString(36).slice(2, 8)}`
}
