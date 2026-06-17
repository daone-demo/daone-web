import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageGenTask } from './constants'
import { addCanvasNode, getNodeSize } from './graph'

import { getFlowEdgeAttrs } from './edgeStyle'

const GEN_GAP = 56

export function connectGenEdge(graph: Graph, sourceId: string, targetId: string) {
  return graph.addEdge({
    source: { cell: sourceId, port: 'right' },
    target: { cell: targetId, port: 'left' },
    attrs: getFlowEdgeAttrs(),
    zIndex: 0,
  })
}

export function findOutgoingGenNode(graph: Graph, sourceId: string) {
  const edge = graph.getEdges().find((item) => {
    const source = item.getSourceCellId()
    const target = item.getTargetCellId()
    if (source !== sourceId) return false
    const targetNode = target ? graph.getCellById(target) : null
    if (!targetNode?.isNode()) return false
    const data = targetNode.getData() as CanvasNodeData
    return Boolean(data.imageGenTask)
  })
  if (!edge) return null
  const target = graph.getCellById(edge.getTargetCellId()!)
  return target?.isNode() ? (target as Node) : null
}

export function syncGenNodesFromSource(graph: Graph, sourceNode: Node) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  if (!sourceData.previewUrl) return

  graph.getEdges().forEach((edge) => {
    if (edge.getSourceCellId() !== sourceNode.id) return
    const target = graph.getCellById(edge.getTargetCellId()!)
    if (!target?.isNode()) return

    const data = { ...(target.getData() as CanvasNodeData) }
    if (!data.imageGenTask) return

    data.sourceNodeId = sourceNode.id
    data.sourcePreviewUrl = sourceData.previewUrl
    data.sourceFileName = sourceData.fileName
    data.inputUpdated = true
    target.setData(data)
  })
}

export function spawnImageGenNode(
  graph: Graph,
  sourceNode: Node,
  task: ImageGenTask | 'picker' = 'picker',
) {
  const existing = findOutgoingGenNode(graph, sourceNode.id)
  if (existing) {
    if (task !== 'picker') {
      applyImageGenTask(existing, task)
    }
    return existing
  }

  const sourceData = sourceNode.getData() as CanvasNodeData
  const bbox = sourceNode.getBBox()
  const genTask: ImageGenTask = task === 'picker' ? 'picker' : task
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: genTask === 'picker' ? 'picker' : 'editor',
    imageGenTask: genTask,
    title: genTask === 'img2img' ? '图生图' : genTask === 'hd' ? '图片高清' : '图片节点',
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    inputUpdated: Boolean(sourceData.previewUrl),
    genSeed: 58,
  }

  const size = getNodeSize('image', overrides.mode, overrides)
  const centerY = bbox.y + bbox.height / 2
  const point = {
    x: bbox.x + bbox.width + GEN_GAP + size.width / 2,
    y: centerY,
  }

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

export function spawnImageGenNodeAtPoint(
  graph: Graph,
  sourceNode: Node,
  point: { x: number; y: number },
) {
  const existing = findOutgoingGenNode(graph, sourceNode.id)
  if (existing) return existing

  const sourceData = sourceNode.getData() as CanvasNodeData
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'picker',
    imageGenTask: 'picker',
    title: '图片节点',
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    inputUpdated: Boolean(sourceData.previewUrl),
    genSeed: 58,
  }

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 由文本/非图片节点连线生成「文生图」目标节点：干净占位 + 待生成态 */
export function spawnText2ImgNode(
  graph: Graph,
  sourceNode: Node,
  point: { x: number; y: number },
) {
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    imageGenTask: 'picker',
    imageGenState: 'idle',
    title: '图片节点',
    sourceNodeId: sourceNode.id,
    genSeed: 58,
  }
  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

export function applyImageGenTask(node: Node, task: ImageGenTask) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenTask = task
  data.mode = 'editor'
  data.title = task === 'img2img' ? '图生图' : '图片高清'
  if (data.sourcePreviewUrl) {
    data.inputUpdated = true
  }
  node.setData(data)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
}

export function createStandaloneGenEdge(graph: Graph, source: Node, target: Node) {
  const exists = graph.getEdges().some(
    (edge) =>
      edge.getSourceCellId() === source.id && edge.getTargetCellId() === target.id,
  )
  if (exists) return
  connectGenEdge(graph, source.id, target.id)
}

export function spawnCroppedImageNode(
  graph: Graph,
  sourceNode: Node,
  payload: { dataUrl: string; width: number; height: number },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const bbox = sourceNode.getBBox()
  const outgoingCount = graph.getEdges().filter((edge) => edge.getSourceCellId() === sourceNode.id).length
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    title: '裁剪结果',
    previewUrl: payload.dataUrl,
    mediaWidth: payload.width,
    mediaHeight: payload.height,
    uploadState: 'done',
    fileName: sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png',
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point = {
    x: bbox.x + bbox.width + GEN_GAP + outgoingCount * (size.width + GEN_GAP) + size.width / 2,
    y: bbox.y + bbox.height / 2,
  }

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}
