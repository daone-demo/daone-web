import type { CanvasNodeData } from '../constants'

/** 将 X6 节点 data 同步到 Vue reactive，并移除图上已删除的字段 */
export function syncNodeViewData(target: CanvasNodeData, source: CanvasNodeData) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      delete (target as Record<string, unknown>)[key]
    }
  }
  Object.assign(target, source)
}
