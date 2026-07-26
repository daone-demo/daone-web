import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageSourceRef } from './constants'

export type VideoSourceRef = {
  nodeId: string
  assetId?: string
  previewUrl: string
  fileName: string
  title: string
  index: number
}

/** 将运行时参考图列表转为可随节点 data 持久化的结构 */
export function toPersistedVideoSourceRefs(refs: VideoSourceRef[]): ImageSourceRef[] {
  return refs
    .filter((item) => Boolean(item.previewUrl))
    .map((item) => ({
      nodeId: item.nodeId,
      assetId: item.assetId,
      previewUrl: item.previewUrl,
      fileName: item.fileName || item.title || '',
    }))
}

/** 从节点快照还原对话框用的参考图列表（无连线时的溯源回退） */
export function videoSourceRefsFromStored(
  stored: ImageSourceRef[] | undefined,
): VideoSourceRef[] {
  return (Array.isArray(stored) ? stored : [])
    .filter((item) => Boolean(item.previewUrl))
    .map((item, index) => ({
      nodeId: item.nodeId,
      assetId: item.assetId,
      previewUrl: item.previewUrl,
      fileName: item.fileName ?? '',
      title: item.fileName ?? '',
      index: index + 1,
    }))
}

/**
 * 解析视频节点参考图列表。
 * - preferStored：对话框溯源优先用生成时落盘的快照（成片后删线仍可回显）
 * - 否则优先当前连线（底部生成面板编辑中）
 */
export function resolveVideoSourceRefsForNode(
  graph: Graph,
  videoNodeId: string,
  stored?: ImageSourceRef[],
  preferStored = false,
): VideoSourceRef[] {
  const live = getVideoSourceRefs(graph, videoNodeId)
  const fromStored = videoSourceRefsFromStored(stored)

  const hydrateFromGraph = (refs: VideoSourceRef[]): VideoSourceRef[] =>
    refs.map((ref, index) => {
      const cell = graph.getCellById(ref.nodeId)
      if (!cell?.isNode()) return { ...ref, index: index + 1 }
      const data = cell.getData() as CanvasNodeData
      if (!data.previewUrl) return { ...ref, index: index + 1 }
      return {
        nodeId: ref.nodeId,
        assetId: data.assetId || ref.assetId,
        previewUrl: data.previewUrl,
        fileName: data.fileName || ref.fileName,
        title: data.title || ref.title,
        index: index + 1,
      }
    })

  if (preferStored && fromStored.length) return hydrateFromGraph(fromStored)
  if (live.length) return live
  return hydrateFromGraph(fromStored)
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

/** 查找连入视频节点的上游文本节点（按画布位置排序） */
export function findIncomingTextNodes(graph: Graph, videoNodeId: string): Node[] {
  const nodes: Node[] = []

  for (const edge of graph.getEdges()) {
    const targetId = edge.getTargetCellId()
    if (targetId !== videoNodeId) continue

    const sourceId = edge.getSourceCellId()
    if (!sourceId) continue

    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue

    const data = source.getData() as CanvasNodeData
    if (data.kind !== 'text') continue

    nodes.push(source as Node)
  }

  return nodes.sort((a, b) => {
    const ay = a.getBBox().y
    const by = b.getBBox().y
    if (ay !== by) return ay - by
    return a.getBBox().x - b.getBBox().x
  })
}

/** 从文本节点 HTML content 提取纯文本 */
export function plainTextFromNodeContent(content?: string): string {
  const html = String(content || '').trim()
  if (!html) return ''
  if (typeof document !== 'undefined') {
    const div = document.createElement('div')
    div.innerHTML = html
    return (div.textContent || div.innerText || '').trim()
  }
  return html.replace(/<[^>]+>/g, '').trim()
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
      assetId: data.assetId,
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
