/**
 * 画布加载竞态防护：epoch + 路由/响应 projectId 校验。
 * 纯函数，便于单元测试与 CreateOrEdit 共用。
 */

export type PendingCanvasSlot<TPayload> = {
  epoch: number
  projectId: string
  payload: TPayload
}

export function normalizeRouteProjectId(id: unknown): string {
  if (id == null) return ''
  if (Array.isArray(id)) return String(id[0] ?? '').trim()
  return String(id).trim()
}

/** 请求返回后是否仍可应用到当前页 */
export function isCanvasResponseApplicable(options: {
  requestEpoch: number
  currentEpoch: number
  targetId: string
  routeId: string
  responseProjectId: unknown
}): boolean {
  if (options.requestEpoch !== options.currentEpoch) return false
  const targetId = normalizeRouteProjectId(options.targetId)
  const routeId = normalizeRouteProjectId(options.routeId)
  if (!targetId || targetId !== routeId) return false
  const responseProjectId = normalizeRouteProjectId(options.responseProjectId)
  // 有响应 projectId 时必须与目标一致，防止串项目
  if (responseProjectId && responseProjectId !== targetId) return false
  return true
}

/** pending 冲刷前再次确认归属仍有效 */
export function shouldFlushPendingCanvasSlot<TPayload>(
  pending: PendingCanvasSlot<TPayload> | null | undefined,
  options: { currentEpoch: number; routeId: unknown },
): pending is PendingCanvasSlot<TPayload> {
  if (!pending) return false
  if (pending.epoch !== options.currentEpoch) return false
  const routeId = normalizeRouteProjectId(options.routeId)
  return Boolean(routeId) && pending.projectId === routeId
}
