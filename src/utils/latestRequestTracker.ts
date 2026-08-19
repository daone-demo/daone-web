/**
 * 追踪“最后一次发起的请求”，用于丢弃乱序返回的旧响应。
 *
 * 每次 begin() 使之前的请求全部失效，返回的 isCurrent() 仅在
 * 本次请求仍是最新一次时为 true。
 */
export type LatestRequestTracker = {
  begin: () => () => boolean
  invalidate: () => void
}

export function createLatestRequestTracker(): LatestRequestTracker {
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
