import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageGenTask, ImageSourceRef } from './constants'
import {
  createDefaultImageDialogueSettings,
  normalizeAssetId,
} from './constants'
import { addCanvasNode, getNodeSize, syncNodeShapeFromData } from './graph'
import { GRID_SPLIT_GAP, computeGridSplitContentOrigin } from './gridSplitUtils'

import { getFlowEdgeAttrs } from './edgeStyle'
import type { OutgoingResultLayoutOptions, ResultPlacement } from './imageGenOutgoingResultLayout'
import {
  resolveOutgoingResultNodePoint,
} from './imageGenOutgoingResultLayout'
import {
  isImageGenerationFailedNode,
  isImageGenerationUploadPlaceholderNode,
  isPendingImageGenerationTarget,
  isText2ImagePlaceholderNode,
} from './imageGenPredicates'

const GEN_GAP = 56

export type { ResultPlacement } from './imageGenOutgoingResultLayout'
export {
  computeOutgoingResultNodePoint,
  planOutgoingResultPoints,
  reserveOutgoingBatchColumnOffset,
  resolveOutgoingResultNodePoint,
} from './imageGenOutgoingResultLayout'
export {
  isCropDerivedImageData,
  isImageGenerationFailedNode,
  isImageGenerationUploadPlaceholderNode,
  isPendingImageGenerationTarget,
  isText2ImagePlaceholderNode,
  resolveImageGenerationProgressLabel,
  shouldGenerateImageInPlaceOnNode,
} from './imageGenPredicates'

function countOutgoingSlots(graph: Graph, sourceId: string) {
  return graph.getEdges().filter((edge) => edge.getSourceCellId() === sourceId).length
}

export function connectGenEdge(graph: Graph, sourceId: string, targetId: string) {
  return graph.addEdge({
    source: { cell: sourceId, port: 'right' },
    target: { cell: targetId, port: 'left' },
    attrs: getFlowEdgeAttrs(),
    zIndex: 0,
  })
}

function isUpstreamDialogueSourceRef(item: ImageSourceRef, targetId: string) {
  if (!item.previewUrl?.trim() || !item.nodeId || item.nodeId === targetId) return false
  const nodeId = String(item.nodeId)
  return !nodeId.startsWith('digital-human-') && !nodeId.startsWith('upload-')
}

/** 统计目标节点上游图片源数量（优先以入边为准） */
export function collectUpstreamImageSourceRefs(
  graph: Graph,
  targetId: string,
  data: CanvasNodeData,
): ImageSourceRef[] {
  const fromEdges: ImageSourceRef[] = []
  const seen = new Set<string>()
  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== targetId) continue
    const sourceId = edge.getSourceCellId()
    if (!sourceId || seen.has(sourceId) || sourceId === targetId) continue
    const source = graph.getCellById(sourceId)
    if (!source?.isNode()) continue
    const sourceData = source.getData() as CanvasNodeData
    if (
      sourceData.kind !== 'image' ||
      !sourceData.previewUrl?.trim() ||
      sourceData.uploadState === 'uploading'
    ) {
      continue
    }
    seen.add(sourceId)
    fromEdges.push({
      nodeId: sourceId,
      assetId: normalizeAssetId(sourceData.assetId),
      previewUrl: sourceData.previewUrl,
      fileName: sourceData.fileName || sourceData.title || '',
    })
  }
  if (fromEdges.length) return fromEdges

  const fromRefs = (Array.isArray(data.imageSourceRefs) ? data.imageSourceRefs : []).filter((item) =>
    isUpstreamDialogueSourceRef(item, targetId),
  )
  return fromRefs.map((item) => ({
    nodeId: item.nodeId,
    assetId: normalizeAssetId(item.assetId),
    previewUrl: item.previewUrl,
    fileName: item.fileName ?? '',
  }))
}

/** 单图源待生成节点：继承源节点画布尺寸与媒体比例 */
function resolvePendingImageTargetLayoutFromSource(
  sourceNode: Node,
  targetData: CanvasNodeData,
): { layout: Partial<CanvasNodeData>; size: { width: number; height: number } } {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const sourceSize = sourceNode.getSize()
  const layout: Partial<CanvasNodeData> = {}

  if (sourceData.mediaWidth > 0 && sourceData.mediaHeight > 0) {
    layout.mediaWidth = sourceData.mediaWidth
    layout.mediaHeight = sourceData.mediaHeight
  }

  if (sourceData.editorWidth && sourceData.editorHeight) {
    layout.editorWidth = sourceData.editorWidth
    layout.editorHeight = sourceData.editorHeight
  } else if (sourceSize.width > 0 && sourceSize.height > 0) {
    layout.editorWidth = Math.round(sourceSize.width)
    layout.editorHeight = Math.round(sourceSize.height)
  }

  if (typeof sourceData.viewScale === 'number' && sourceData.viewScale > 0) {
    layout.viewScale = sourceData.viewScale
  }

  const merged = { ...targetData, ...layout }
  const size = getNodeSize('image', merged.mode ?? 'picker', merged)
  return { layout, size }
}

function resolveDefaultPendingImageTargetLayout(
  targetData: CanvasNodeData,
): { layout: Partial<CanvasNodeData>; size: { width: number; height: number } } {
  const layout: Partial<CanvasNodeData> = {
    mediaWidth: 0,
    mediaHeight: 0,
  }
  const merged = { ...targetData, ...layout }
  delete merged.editorWidth
  delete merged.editorHeight
  delete merged.viewScale
  const size = getNodeSize('image', merged.mode ?? 'picker', merged)
  return { layout, size }
}

function applyPendingImageTargetLayout(
  targetNode: Node,
  data: CanvasNodeData,
  layout: Partial<CanvasNodeData>,
  size: { width: number; height: number },
) {
  const next = { ...data, ...layout }
  if (!layout.editorWidth) delete next.editorWidth
  if (!layout.editorHeight) delete next.editorHeight
  if (!layout.viewScale) delete next.viewScale
  targetNode.setData(next, { overwrite: true })
  targetNode.resize(size.width, size.height)
  syncNodeShapeFromData(targetNode)
}

/**
 * 待生成节点按上游图源数量同步展示图与 assetId：
 * - 单图源：继承来源预览与 assetId
 * - 多图源：清空节点预览与 assetId，并重置工作流
 */
export function syncPendingImageTargetFromSources(graph: Graph, targetNode: Node): boolean {
  const data = { ...(targetNode.getData() as CanvasNodeData) }
  if (!isPendingImageGenerationTarget(data)) return false

  const refs = collectUpstreamImageSourceRefs(graph, targetNode.id, data)

  if (refs.length) {
    data.imageSourceRefs = refs.map((item) => ({
      nodeId: item.nodeId,
      assetId: item.assetId,
      previewUrl: item.previewUrl,
      fileName: item.fileName ?? '',
    }))
  } else {
    data.imageSourceRefs = []
  }

  if (refs.length === 1) {
    const ref = refs[0]
    const sourceCell = graph.getCellById(ref.nodeId)
    const sourceData = sourceCell?.isNode() ? (sourceCell.getData() as CanvasNodeData) : null
    data.previewUrl = ref.previewUrl
    data.assetId = normalizeAssetId(ref.assetId)
    data.sourceNodeId = ref.nodeId
    data.sourcePreviewUrl = ref.previewUrl
    data.sourceFileName = ref.fileName || sourceData?.fileName || sourceData?.title || ''
    data.sourceAssetId = normalizeAssetId(ref.assetId)
    data.fileName = ref.fileName || sourceData?.fileName || sourceData?.title || ''
    data.uploadState = 'done'
    data.uploadProgress = 100
    data.imageGenState = 'idle'
    data.inputUpdated = true
    const layoutResult = sourceCell?.isNode()
      ? resolvePendingImageTargetLayoutFromSource(sourceCell as Node, data)
      : resolveDefaultPendingImageTargetLayout(data)
    applyPendingImageTargetLayout(targetNode, data, layoutResult.layout, layoutResult.size)
    return true
  }

  if (refs.length > 1) {
    data.previewUrl = ''
    delete data.assetId
    data.uploadState = 'idle'
    data.uploadProgress = 0
    delete data.imageGenState
    data.inputUpdated = true
    const settings = data.imageDialogueSettings ?? createDefaultImageDialogueSettings()
    if (settings.workflowId) {
      data.imageDialogueSettings = { ...settings, workflowId: '' }
    }
    const layoutResult = resolveDefaultPendingImageTargetLayout(data)
    applyPendingImageTargetLayout(targetNode, data, layoutResult.layout, layoutResult.size)
    return true
  }

  if (refs.length === 0) {
    data.previewUrl = ''
    delete data.assetId
    data.uploadState = 'idle'
    data.uploadProgress = 0
    delete data.imageGenState
    data.inputUpdated = false
    delete data.sourceNodeId
    delete data.sourcePreviewUrl
    delete data.sourceFileName
    delete data.sourceAssetId
    const layoutResult = resolveDefaultPendingImageTargetLayout(data)
    applyPendingImageTargetLayout(targetNode, data, layoutResult.layout, layoutResult.size)
    return true
  }

  return false
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
    sourceAssetId: normalizeAssetId(sourceData.assetId),
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
  syncPendingImageTargetFromSources(graph, node)
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
    sourceAssetId: normalizeAssetId(sourceData.assetId),
    inputUpdated: Boolean(sourceData.previewUrl),
    genSeed: 58,
  }

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  syncPendingImageTargetFromSources(graph, node)
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
    title: '文生图',
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
  layout?: OutgoingResultLayoutOptions,
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = layout?.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    title: '裁剪结果',
    previewUrl: payload.dataUrl,
    mediaWidth: payload.width,
    mediaHeight: payload.height,
    uploadState: 'done',
    uploadProgress: 100,
    fileName: sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png',
    cropResult: true,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point = resolveOutgoingResultNodePoint(graph, sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: layout?.layoutTotal,
    placement: layout?.placement,
    columnOffset: layout?.columnOffset,
  })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

export function spawnErasedImageNode(
  graph: Graph,
  sourceNode: Node,
  payload: { dataUrl: string; width: number; height: number },
  layout?: OutgoingResultLayoutOptions,
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = layout?.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    title: '擦除结果',
    previewUrl: payload.dataUrl,
    mediaWidth: payload.width,
    mediaHeight: payload.height,
    uploadState: 'done',
    fileName: sourceData.fileName ? `擦除-${sourceData.fileName}` : '擦除结果.png',
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point = resolveOutgoingResultNodePoint(graph, sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: layout?.layoutTotal,
    placement: layout?.placement,
    columnOffset: layout?.columnOffset,
  })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 生成中占位节点：继承源图片节点的画布尺寸与媒体比例 */
export function resolveImageGenerationPlaceholderLayout(sourceNode: Node) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const sourceSize = sourceNode.getSize()

  const data: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    imageGenTask: 'picker',
    imageGenState: 'loading',
  }

  if (sourceData.mediaWidth > 0 && sourceData.mediaHeight > 0) {
    data.mediaWidth = sourceData.mediaWidth
    data.mediaHeight = sourceData.mediaHeight
    if (sourceSize.width > 0) {
      data.editorWidth = sourceSize.width
    }
  } else if (sourceData.kind === 'image' && sourceSize.width > 0 && sourceSize.height > 0) {
    data.editorWidth = sourceSize.width
    data.editorHeight = sourceSize.height
  }

  const size = getNodeSize('image', 'editor', data)
  return { width: size.width, height: size.height, data }
}

export function getImageGenerationPlaceholderSize(sourceNode: Node) {
  const layout = resolveImageGenerationPlaceholderLayout(sourceNode)
  return { width: layout.width, height: layout.height }
}

/** 在源节点右侧生成「生成中」结果节点，并连线 */
export function spawnGenerationResultNode(
  graph: Graph,
  sourceNode: Node,
  options: {
    title: string
    fileName?: string
    layoutSlot?: number
    layoutTotal?: number
    placement?: ResultPlacement
    columnOffset?: number
    centerPoint?: { x: number; y: number }
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const layout = resolveImageGenerationPlaceholderLayout(sourceNode)
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    ...layout.data,
    imageGenProgress: 0,
    title: options.title,
    fileName: options.fileName || options.title,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
    inputUpdated: Boolean(sourceData.previewUrl),
  }
  const size = { width: layout.width, height: layout.height }
  const point =
    options.centerPoint ??
    resolveOutgoingResultNodePoint(graph, sourceNode, size, {
      layoutSlot: slot,
      layoutTotal: options.layoutTotal,
      placement: options.placement,
      columnOffset: options.columnOffset,
    })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 查找可复用的失败生成节点：无预览的源占位，或连出的失败子节点 */
export function findReusableImageGenerationNode(graph: Graph, sourceNode: Node): Node | null {
  const sourceData = sourceNode.getData() as CanvasNodeData
  if (!sourceData.previewUrl?.trim() && isImageGenerationFailedNode(sourceData)) {
    return sourceNode
  }

  let candidate: Node | null = null
  for (const edge of graph.getEdges()) {
    if (edge.getSourceCellId() !== sourceNode.id) continue
    const target = graph.getCellById(edge.getTargetCellId()!)
    if (!target?.isNode()) continue
    const data = target.getData() as CanvasNodeData
    if (isImageGenerationFailedNode(data)) {
      candidate = target as Node
    }
  }
  return candidate
}

/** 将失败节点重置为生成中，用于原地重试 */
export function resetImageGenerationNodeForRetry(
  node: Node,
  options: { title: string; fileName: string; prompt?: string },
) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.kind = 'image'
  data.mode = 'editor'
  data.imageGenState = 'loading'
  data.imageGenProgress = 0
  data.title = options.title
  data.fileName = options.fileName
  data.previewUrl = ''
  data.imageGenTask = undefined
  delete data.generationTaskId
  delete data.generationTaskType
  delete data.generationFailMessage
  if (options.prompt) {
    data.genPrompt = options.prompt
  }

  const layoutSource = resolveImageGenerationLayoutSourceNode(node)
  const layout = resolveImageGenerationPlaceholderLayout(layoutSource)
  node.setData({ ...data, ...layout.data }, { overwrite: true })
  node.resize(layout.width, layout.height)
}

/** 文本节点提交文生图时，优先复用已连出的空占位/失败节点 */
export function resolveText2ImageGenerationTargetNode(
  graph: Graph,
  sourceNode: Node,
): Node | null {
  const outgoing = findOutgoingGenNode(graph, sourceNode.id)
  if (outgoing) {
    const data = outgoing.getData() as CanvasNodeData
    if (
      !data.previewUrl?.trim() &&
      (isText2ImagePlaceholderNode(data) || isImageGenerationFailedNode(data))
    ) {
      return outgoing
    }
  }

  return findReusableImageGenerationNode(graph, sourceNode)
}

function resolveImageGenerationLayoutSourceNode(node: Node): Node {
  const data = node.getData() as CanvasNodeData
  const graph = node.model?.graph as Graph | undefined
  if (!graph || !data.sourceNodeId) return node

  const upstream = graph.getCellById(data.sourceNodeId)
  if (!upstream?.isNode()) return node
  const upstreamData = upstream.getData() as CanvasNodeData
  if (!upstreamData.previewUrl?.trim()) return node

  if (
    isImageGenerationUploadPlaceholderNode(data) ||
    (isImageGenerationFailedNode(data) && !data.previewUrl?.trim())
  ) {
    return upstream as Node
  }
  return node
}

/** 将节点置为生成中，用于原地图生图 */
export function prepareImageNodeForInPlaceGeneration(
  node: Node,
  options: { title: string; fileName: string; prompt?: string },
) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.kind = 'image'
  data.mode = 'editor'
  data.imageGenState = 'loading'
  data.imageGenProgress = 0
  data.title = options.title
  data.fileName = options.fileName
  data.imageGenTask = undefined
  delete data.generationTaskId
  delete data.generationTaskType
  if (options.prompt) {
    data.genPrompt = options.prompt
  }

  if (data.previewUrl?.trim()) {
    node.setData(data, { overwrite: true })
    return
  }

  const layoutSource = resolveImageGenerationLayoutSourceNode(node)
  const layout = resolveImageGenerationPlaceholderLayout(layoutSource)
  node.setData({ ...data, ...layout.data }, { overwrite: true })
  node.resize(layout.width, layout.height)
}

/** 在源节点右侧生成已完成的普通图片节点（无生成占位态），并连线 */
export function spawnCompletedImageResultNode(
  graph: Graph,
  sourceNode: Node,
  options: {
    title: string
    fileName?: string
    previewUrl?: string
    assetId?: string
    mediaWidth?: number
    mediaHeight?: number
    layoutSlot?: number
    layoutTotal?: number
    placement?: ResultPlacement
    columnOffset?: number
    centerPoint?: { x: number; y: number }
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    title: options.title,
    fileName: options.fileName || options.title,
    previewUrl: options.previewUrl,
    assetId: options.assetId,
    mediaWidth: options.mediaWidth,
    mediaHeight: options.mediaHeight,
    uploadState: 'done',
    uploadProgress: 100,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
    inputUpdated: Boolean(sourceData.previewUrl),
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point =
    options.centerPoint ??
    resolveOutgoingResultNodePoint(graph, sourceNode, size, {
      layoutSlot: slot,
      layoutTotal: options.layoutTotal,
      placement: options.placement,
      columnOffset: options.columnOffset,
    })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 在源节点右侧生成「图转 3D」加载中节点，并连线 */
export function spawnModel3DResultNode(
  graph: Graph,
  sourceNode: Node,
  options: {
    title: string
    fileName?: string
    layoutSlot?: number
    layoutTotal?: number
    columnOffset?: number
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'model3d',
    mode: 'editor',
    imageGenState: 'loading',
    imageGenProgress: 0,
    title: options.title,
    fileName: options.fileName || `${options.title}.glb`,
    previewUrl: '',
    mediaWidth: 320,
    mediaHeight: 360,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
  }
  const size = getNodeSize('model3d', 'editor', overrides)
  const point = resolveOutgoingResultNodePoint(graph, sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
    columnOffset: options.columnOffset,
  })

  const node = addCanvasNode(graph, 'model3d', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 在源节点右侧生成「文生视频」加载中视频节点，并连线 */
export function spawnVideoGenerationResultNode(
  graph: Graph,
  sourceNode: Node,
  options: {
    title: string
    fileName?: string
    layoutSlot?: number
    layoutTotal?: number
    columnOffset?: number
    centerPoint?: { x: number; y: number }
    /** 生成文案溯源（写入结果节点，打开对话框可回显） */
    videoDialogueText?: string
    /** 生成参数溯源 */
    videoDialogueSettings?: CanvasNodeData['videoDialogueSettings']
    /** 多图参考来源快照 */
    videoSourceRefs?: CanvasNodeData['videoSourceRefs']
    genPrompt?: string
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const dialogueText =
    options.videoDialogueText ??
    sourceData.videoDialogueText ??
    options.genPrompt ??
    sourceData.genPrompt ??
    ''
  const dialogueSettings =
    options.videoDialogueSettings ?? sourceData.videoDialogueSettings
  const videoGenAspectRatio =
    sourceData.videoGenAspectRatio ?? dialogueSettings?.aspectRatio
  const sourceRefs =
    options.videoSourceRefs ??
    (Array.isArray(sourceData.videoSourceRefs) ? sourceData.videoSourceRefs : undefined)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'video',
    mode: 'editor',
    uploadState: 'uploading',
    uploadProgress: 0,
    generationTaskType: 'VIDEO',
    title: options.title,
    fileName: options.fileName || `${options.title}.mp4`,
    previewUrl: '',
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
    genPrompt: (options.genPrompt ?? dialogueText) || sourceData.genPrompt || '',
    videoDialogueText: dialogueText,
    videoDialogueSettings: dialogueSettings ? { ...dialogueSettings } : undefined,
    videoGenAspectRatio,
    videoSourceRefs: sourceRefs?.length ? sourceRefs.map((item) => ({ ...item })) : undefined,
  }
  const size = getNodeSize('video', 'editor', overrides)
  const point =
    options.centerPoint ??
    resolveOutgoingResultNodePoint(graph, sourceNode, size, {
      layoutSlot: slot,
      layoutTotal: options.layoutTotal,
      columnOffset: options.columnOffset,
    })

  const node = addCanvasNode(graph, 'video', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

/** 在源节点右侧生成「反推提示词」加载中文本节点，并连线 */
export function spawnTextPromptResultNode(
  graph: Graph,
  sourceNode: Node,
  options: {
    title: string
    layoutSlot?: number
    layoutTotal?: number
    columnOffset?: number
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'text',
    mode: 'editor',
    textGenState: 'loading',
    textGenProgress: 0,
    textPickerTask: '',
    content: '',
    title: options.title,
    linkedImageNodeId: sourceNode.id,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
  }
  const size = getNodeSize('text', 'editor', overrides)
  const point = resolveOutgoingResultNodePoint(graph, sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
    columnOffset: options.columnOffset,
  })

  const node = addCanvasNode(graph, 'text', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

export function findOutgoingLoadingGenerationNode(graph: Graph, sourceId: string) {
  for (const edge of graph.getEdges()) {
    if (edge.getSourceCellId() !== sourceId) continue
    const target = graph.getCellById(edge.getTargetCellId()!)
    if (!target?.isNode()) continue
    const data = target.getData() as CanvasNodeData
    if (data.imageGenState === 'loading' || data.textGenState === 'loading') {
      return target as Node
    }
  }
  return null
}

/**
 * 宫格拆分：在源图原位生成碎片节点（节点间距固定 2px），不修改/删除原图，默认不解组。
 * 按碎片原始像素等比缩放后紧密排布，避免 cell 比例与图片不一致导致的上下/左右视觉缝宽不同。
 */
export function spawnGridSplitResultNodes(
  graph: Graph,
  sourceNode: Node,
  tiles: Array<{
    dataUrl: string
    width: number
    height: number
    row: number
    col: number
    label: string
  }>,
  options: {
    titlePrefix?: string
    rows: number
    cols: number
    rowStops?: number[]
    colStops?: number[]
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const bbox = sourceNode.getBBox()
  const titlePrefix = options.titlePrefix?.trim() || '宫格'
  const rows = Math.max(1, options.rows)
  const cols = Math.max(1, options.cols)
  const gap = GRID_SPLIT_GAP

  const previewOffsetY = 0
  const contentW = bbox.width
  const contentH = Math.max(1, bbox.height - previewOffsetY)

  const tileMap = new Map(tiles.map((tile) => [`${tile.row}-${tile.col}`, tile]))

  // 每列/每行取碎片原始像素尺寸（同列宽一致、同行高一致）
  const colNaturalWidths = Array.from({ length: cols }, (_, col) => {
    let width = 1
    for (let row = 0; row < rows; row += 1) {
      const tile = tileMap.get(`${row + 1}-${col + 1}`)
      if (tile) width = Math.max(width, tile.width)
    }
    return width
  })
  const rowNaturalHeights = Array.from({ length: rows }, (_, row) => {
    let height = 1
    for (let col = 0; col < cols; col += 1) {
      const tile = tileMap.get(`${row + 1}-${col + 1}`)
      if (tile) height = Math.max(height, tile.height)
    }
    return height
  })

  const naturalW = colNaturalWidths.reduce((sum, value) => sum + value, 0)
  const naturalH = rowNaturalHeights.reduce((sum, value) => sum + value, 0)
  const availableW = Math.max(cols, contentW - (cols - 1) * gap)
  const availableH = Math.max(rows, contentH - (rows - 1) * gap)
  const scale = Math.min(availableW / Math.max(1, naturalW), availableH / Math.max(1, naturalH))

  const colWidths = colNaturalWidths.map((width) => Math.max(1, Math.round(width * scale)))
  const rowHeights = rowNaturalHeights.map((height) => Math.max(1, Math.round(height * scale)))

  const colOffsets: number[] = []
  let cursorX = 0
  for (let col = 0; col < cols; col += 1) {
    colOffsets.push(cursorX)
    cursorX += colWidths[col] + (col < cols - 1 ? gap : 0)
  }

  const rowOffsets: number[] = []
  let cursorY = 0
  for (let row = 0; row < rows; row += 1) {
    rowOffsets.push(cursorY)
    cursorY += rowHeights[row] + (row < rows - 1 ? gap : 0)
  }

  const gridHeight = cursorY
  const { x: contentX, y: contentY } = computeGridSplitContentOrigin(
    graph,
    sourceNode,
    gridHeight,
    GEN_GAP,
  )

  const nodes: Node[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const tile = tileMap.get(`${row + 1}-${col + 1}`)
      if (!tile) continue

      const width = colWidths[col]
      const height = rowHeights[row]
      const overrides: Partial<CanvasNodeData> = {
        kind: 'image',
        mode: 'editor',
        title: `${titlePrefix} ${tile.label}`,
        previewUrl: tile.dataUrl,
        mediaWidth: tile.width,
        mediaHeight: tile.height,
        editorWidth: width,
        editorHeight: height,
        compactPreview: true,
        gridSplitTile: { row: row + 1, col: col + 1, rows, cols },
        viewScale: 1,
        uploadState: 'done',
        fileName: sourceData.fileName
          ? `${titlePrefix}-${tile.label}-${sourceData.fileName}`
          : `${titlePrefix}-${tile.label}.png`,
        sourceNodeId: sourceNode.id,
        sourcePreviewUrl: sourceData.previewUrl ?? '',
        sourceFileName: sourceData.fileName ?? '',
        sourceAssetId: sourceData.assetId,
      }

      const point = {
        x: contentX + colOffsets[col] + width / 2,
        y: contentY + rowOffsets[row] + height / 2,
      }
      nodes.push(addCanvasNode(graph, 'image', point, overrides))
    }
  }

  return nodes
}
