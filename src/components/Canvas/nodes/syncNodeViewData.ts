import type { CanvasNodeData } from '../constants'

/** 将 X6 节点 data 同步到 Vue reactive，并移除图上已删除的字段 */
export function syncNodeViewData(target: CanvasNodeData, source: CanvasNodeData) {
  const targetRecord = target as unknown as Record<string, unknown>
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      delete targetRecord[key]
    }
  }
  Object.assign(target, source)
}
