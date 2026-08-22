/**
 * 会话级附件操作 generation：关闭标签时 bump，作废尚未提交的 add/校验链。
 */
export function getSessionAttachOpGeneration(
  map: Map<string, number>,
  sessionId: string,
): number {
  return map.get(sessionId) ?? 0
}

export function bumpSessionAttachOpGeneration(
  map: Map<string, number>,
  sessionId: string,
): number {
  const id = String(sessionId || '').trim()
  if (!id) return 0
  const next = (map.get(id) ?? 0) + 1
  map.set(id, next)
  return next
}

export function isSessionAttachOpCurrent(
  map: Map<string, number>,
  sessionId: string,
  capturedGeneration: number,
): boolean {
  return getSessionAttachOpGeneration(map, sessionId) === capturedGeneration
}
