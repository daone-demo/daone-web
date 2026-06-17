import type { Edge, Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { syncTextNodeImageSource } from './textPrompt'

/** 两端都已连接到节点的有效连线（排除拖拽中的预览线） */
export function isPersistedEdge(edge: Edge) {
  const source = edge.getSource()
  const target = edge.getTarget()
  return (
    Boolean(source && typeof source === 'object' && 'cell' in source && source.cell) &&
    Boolean(target && typeof target === 'object' && 'cell' in target && target.cell)
  )
}

/** 删除连线前，解除目标节点对源节点的引用关系 */
export function detachEdgeRelation(graph: Graph, edge: Edge) {
  const sourceId = edge.getSourceCellId()
  const targetId = edge.getTargetCellId()
  if (!sourceId || !targetId || !isPersistedEdge(edge)) return null

  const targetCell = graph.getCellById(targetId)
  if (!targetCell?.isNode()) return null

  const target = targetCell as Node
  const data = { ...(target.getData() as CanvasNodeData) }

  if (data.kind === 'image' || data.kind === 'text') {
    const refs = (Array.isArray(data.imageSourceRefs) ? data.imageSourceRefs : []).filter(
      (item) => item.nodeId !== sourceId,
    )
    data.imageSourceRefs = refs

    const latest = refs[refs.length - 1]
    data.sourceNodeId = latest?.nodeId ?? ''
    data.sourcePreviewUrl = latest?.previewUrl ?? ''
    data.sourceFileName = latest?.fileName ?? ''
    data.inputUpdated = refs.some((item) => Boolean(item.previewUrl))

    if (data.kind === 'text') {
      data.linkedImageNodeId = latest?.nodeId ?? ''
      target.setData(data, { overwrite: true })
      syncTextNodeImageSource(graph, target)
    } else {
      target.setData(data, { overwrite: true })
    }

    return { targetId, targetKind: data.kind as 'image' | 'text' }
  }

  if (data.sourceNodeId === sourceId) {
    data.sourceNodeId = ''
    data.sourcePreviewUrl = ''
    data.sourceFileName = ''
    data.inputUpdated = false
    target.setData(data)
  }

  return { targetId, targetKind: data.kind }
}
