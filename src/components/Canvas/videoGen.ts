import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'

export type VideoSourceRef = {
  nodeId: string
  previewUrl: string
  fileName: string
  title: string
  index: number
}

export function findIncomingImageNodes(graph: Graph, videoNodeId: string): Node[] {
  const nodes: Node[] = []

  for (const edge of graph.getEdges()) {
    const targetId = edge.getTargetCellId()
    if (targetId !== videoNodeId) continue

    const sourceId = edge.getSourceCellId()
    if (!sourceId) continue

    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue

    const data = source.getData() as CanvasNodeData
    if (data.kind !== 'image' || !data.previewUrl) continue
    if (data.imageGenTask === 'picker') continue

    nodes.push(source as Node)
  }

  return nodes.sort((a, b) => {
    const ay = a.getBBox().y
    const by = b.getBBox().y
    if (ay !== by) return ay - by
    return a.getBBox().x - b.getBBox().x
  })
}

export function findImageToVideoEdge(
  graph: Graph,
  imageNodeId: string,
  videoNodeId: string,
) {
  return graph.getEdges().find(
    (edge) =>
      edge.getSourceCellId() === imageNodeId &&
      edge.getTargetCellId() === videoNodeId,
  ) ?? null
}

export function disconnectImageFromVideo(
  graph: Graph,
  imageNodeId: string,
  videoNodeId: string,
) {
  const edge = findImageToVideoEdge(graph, imageNodeId, videoNodeId)
  if (!edge) return false
  graph.removeEdge(edge.id)
  return true
}

export function getVideoSourceRefs(graph: Graph, videoNodeId: string): VideoSourceRef[] {
  return findIncomingImageNodes(graph, videoNodeId).map((node, index) => {
    const data = node.getData() as CanvasNodeData
    return {
      nodeId: node.id,
      previewUrl: data.previewUrl,
      fileName: data.fileName,
      title: data.title,
      index: index + 1,
    }
  })
}

export type VideoGenTabImageRule = {
  min: number
  max: number
  emptyHint: string
}

export const VIDEO_GEN_TAB_IMAGE_RULES: Partial<Record<string, VideoGenTabImageRule>> = {
  reference: { min: 1, max: 9, emptyHint: '需要连接图片节点（1~9个）' },
  img2video: { min: 1, max: 9, emptyHint: '需要连接图片节点（1~9个）' },
  frames: { min: 1, max: 2, emptyHint: '需要连接图片节点（1~2个）' },
  imageRef: { min: 1, max: 2, emptyHint: '需要连接图片节点（1~2个）' },
}

export function getVideoGenTabValidation(tab: string, count: number): string | null {
  const rule = VIDEO_GEN_TAB_IMAGE_RULES[tab]
  if (!rule) return null
  if (count >= rule.min && count <= rule.max) return null
  if (count === 0) return rule.emptyHint
  return `当前图片数量 ${count} 个，需要 ${rule.min}~${rule.max} 个`
}

export function canLinkImageToNode(targetData: CanvasNodeData) {
  return targetData.kind === 'video' || targetData.kind === 'text'
}
