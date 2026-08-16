/**
 * 追踪“最后一次发起的请求”，用于丢弃乱序返回的旧响应。
 * 与 Admin resource-page/latestRequestTracker 语义一致。
 */
export type LatestRequestGuard = {
  /** 登记一次新请求；返回的 isCurrent() 仅在本次仍是最新时为 true */
  begin: () => () => boolean
  /** 使所有进行中的请求失效（例如项目切换清空状态时） */
  invalidate: () => void
}

export function createLatestRequestGuard(): LatestRequestGuard {
  let latestId = 0
  return {
    begin() {
      const id = ++latestId
      return () => id === latestId
    },
    invalidate() {
      latestId += 1
    },
  }
}

/**
 * 判断面板异步响应是否仍可写入：请求序号最新，且项目 ID 未变。
 */
export function isPanelResponseCurrent(options: {
  isCurrent: () => boolean
  requestedProjectId: string
  activeProjectId: string
}): boolean {
  return (
    options.isCurrent() &&
    Boolean(options.requestedProjectId) &&
    options.requestedProjectId === options.activeProjectId
  )
}
