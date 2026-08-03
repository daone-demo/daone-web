import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageGenTask } from './constants'
import { addCanvasNode, getNodeSize } from './graph'
import { GRID_SPLIT_GAP, computeGridSplitContentOrigin } from './gridSplitUtils'

import { getFlowEdgeAttrs } from './edgeStyle'

const GEN_GAP = 56

export type ResultPlacement = 'right' | 'above'

type OutgoingResultLayoutOptions = {
  layoutSlot?: number
  layoutTotal?: number
  placement?: ResultPlacement
  /** 多批次结果时向右（或向上）错开整列，避免与已有子节点重叠 */
  columnOffset?: number
}

type LayoutRect = { x: number; y: number; width: number; height: number }

function countOutgoingSlots(graph: Graph, sourceId: string) {
  return graph.getEdges().filter((edge) => edge.getSourceCellId() === sourceId).length
}

function centerToRect(
  center: { x: number; y: number },
  size: { width: number; height: number },
): LayoutRect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  }
}

function rectsOverlap(a: LayoutRect, b: LayoutRect, gap = GEN_GAP) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

function getNodeLayoutRect(node: Node): LayoutRect {
  const pos = node.position()
  const size = node.getSize()
  return {
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
  }
}

/** 收集画布上已有节点占位（用于碰撞检测） */
function collectGraphNodeRects(graph: Graph, excludeNodeIds: string[] = []): LayoutRect[] {
  const excluded = new Set(excludeNodeIds)
  return graph
    .getNodes()
    .filter((cell) => !excluded.has(cell.id))
    .map((cell) => getNodeLayoutRect(cell as Node))
}

function isPointFree(
  point: { x: number; y: number },
  size: { width: number; height: number },
  occupied: LayoutRect[],
) {
  const rect = centerToRect(point, size)
  return !occupied.some((item) => rectsOverlap(rect, item))
}

function fallbackOutgoingPoint(
  sourceNode: Node,
  size: { width: number; height: number },
  occupied: LayoutRect[],
  placement: ResultPlacement,
) {
  const sourceRect = getNodeLayoutRect(sourceNode)
  if (!occupied.length) {
    return computeOutgoingResultNodePoint(sourceNode, size, { placement, layoutSlot: 0 })
  }

  if (placement === 'above') {
    const minY = Math.min(...occupied.map((rect) => rect.y))
    const centerX =
      occupied.reduce((sum, rect) => sum + rect.x + rect.width / 2, 0) / occupied.length
    return {
      x: centerX,
      y: minY - GEN_GAP - size.height / 2,
    }
  }

  const maxRight = Math.max(sourceRect.x + sourceRect.width, ...occupied.map((rect) => rect.x + rect.width))
  const centerY = sourceRect.y + sourceRect.height / 2
  return {
    x: maxRight + GEN_GAP + size.width / 2,
    y: centerY,
  }
}

function findFreePointNearSource(
  sourceNode: Node,
  size: { width: number; height: number },
  occupied: LayoutRect[],
  placement: ResultPlacement,
  hint?: {
    layoutSlot?: number
    layoutTotal?: number
    columnOffset?: number
  },
) {
  if (
    typeof hint?.layoutTotal === 'number' &&
    hint.layoutTotal > 1 &&
    typeof hint.layoutSlot === 'number'
  ) {
    const startColumn = hint.columnOffset ?? 0
    for (let column = startColumn; column < startColumn + 40; column += 1) {
      const point = computeOutgoingResultNodePoint(sourceNode, size, {
        placement,
        layoutSlot: hint.layoutSlot,
        layoutTotal: hint.layoutTotal,
        columnOffset: column,
      })
      if (isPointFree(point, size, occupied)) return point
    }
  }

  const sourceRect = getNodeLayoutRect(sourceNode)
  const colStep = size.width + GEN_GAP
  const rowStep = size.height + GEN_GAP

  if (placement === 'above') {
    for (let column = 0; column < 40; column += 1) {
      const centerY = sourceRect.y - GEN_GAP - size.height / 2 - column * colStep
      for (let row = 0; row < 40; row += 1) {
        const rowOffsets = row === 0 ? [0] : [row, -row]
        for (const rowOffset of rowOffsets) {
          const centerX = sourceRect.x + sourceRect.width / 2 + rowOffset * rowStep
          const point = { x: centerX, y: centerY }
          if (isPointFree(point, size, occupied)) return point
        }
      }
    }
  } else {
    for (let column = 0; column < 40; column += 1) {
      const centerX = sourceRect.x + sourceRect.width + GEN_GAP + column * colStep + size.width / 2
      for (let row = 0; row < 40; row += 1) {
        const rowOffsets = row === 0 ? [0] : [row, -row]
        for (const rowOffset of rowOffsets) {
          const centerY = sourceRect.y + sourceRect.height / 2 + rowOffset * rowStep
          const point = { x: centerX, y: centerY }
          if (isPointFree(point, size, occupied)) return point
        }
      }
    }
  }

  return fallbackOutgoingPoint(sourceNode, size, occupied, placement)
}

/** 规划一批结果节点中心点，保证彼此及与画布已有节点不重叠 */
export function planOutgoingResultPoints(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  count: number,
  placement: ResultPlacement = 'right',
) {
  const safeCount = Math.max(1, Math.floor(count) || 1)
  const occupied = collectGraphNodeRects(graph)
  const points: { x: number; y: number }[] = []

  for (let index = 0; index < safeCount; index += 1) {
    const point = findFreePointNearSource(sourceNode, size, occupied, placement, {
      layoutSlot: safeCount > 1 ? index : undefined,
      layoutTotal: safeCount > 1 ? safeCount : undefined,
    })
    points.push(point)
    occupied.push(centerToRect(point, size))
  }

  return points
}

/** 并行生成结果节点：右侧纵向或上方横向错位排布 */
export function computeOutgoingResultNodePoint(
  sourceNode: Node,
  size: { width: number; height: number },
  options: OutgoingResultLayoutOptions = {},
) {
  const bbox = sourceNode.getBBox()
  const placement = options.placement ?? 'right'
  const slot = options.layoutSlot ?? 0
  const total = options.layoutTotal
  const columnOffset = options.columnOffset ?? 0

  if (placement === 'above') {
    const centerX = bbox.x + bbox.width / 2
    const y = bbox.y - GEN_GAP - size.height / 2 - columnOffset * (size.height + GEN_GAP)
    const step = size.width + GEN_GAP

    if (typeof total === 'number' && total > 1) {
      const span = total * size.width + (total - 1) * GEN_GAP
      const startX = centerX - span / 2 + size.width / 2
      return { x: startX + slot * step, y }
    }

    if (slot === 0) {
      return { x: centerX, y }
    }

    const layer = Math.ceil(slot / 2)
    const direction = slot % 2 === 1 ? 1 : -1
    return { x: centerX + direction * layer * step, y }
  }

  const x =
    bbox.x +
    bbox.width +
    GEN_GAP +
    size.width / 2 +
    columnOffset * (size.width + GEN_GAP)
  const centerY = bbox.y + bbox.height / 2
  const step = size.height + GEN_GAP

  if (typeof total === 'number' && total > 1) {
    const span = total * size.height + (total - 1) * GEN_GAP
    const startY = centerY - span / 2 + size.height / 2
    return { x, y: startY + slot * step }
  }

  if (slot === 0) {
    return { x, y: centerY }
  }

  const layer = Math.ceil(slot / 2)
  const direction = slot % 2 === 1 ? 1 : -1
  return { x, y: centerY + direction * layer * step }
}

/** 为一批并行结果节点预留不重叠的列偏移（兼容旧调用） */
export function reserveOutgoingBatchColumnOffset(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  count: number,
  placement: ResultPlacement = 'right',
) {
  const occupied = collectGraphNodeRects(graph)
  for (let column = 0; column < 40; column += 1) {
    let fits = true
    for (let slot = 0; slot < count; slot += 1) {
      const point = computeOutgoingResultNodePoint(sourceNode, size, {
        placement,
        layoutSlot: slot,
        layoutTotal: count,
        columnOffset: column,
      })
      if (!isPointFree(point, size, occupied)) {
        fits = false
        break
      }
    }
    if (fits) return column
  }
  return 0
}

/** 解析不重叠的结果节点中心点，优先在原任务周边排布 */
export function resolveOutgoingResultNodePoint(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  options: OutgoingResultLayoutOptions = {},
) {
  const occupied = collectGraphNodeRects(graph)
  const placement = options.placement ?? 'right'
  const explicitSlot = options.layoutSlot

  return findFreePointNearSource(sourceNode, size, occupied, placement, {
    layoutSlot: explicitSlot,
    layoutTotal: options.layoutTotal,
    columnOffset: options.columnOffset,
  })
}

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

/** 图片生成失败、尚未成片的节点（可原地重试） */
export function isImageGenerationFailedNode(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.imageGenState === 'loading') return false

  const markedFailed = Boolean(
    data.title === '生成失败' ||
      data.generationTaskId ||
      (data.mode === 'editor' && data.generationTaskType === 'IMAGE'),
  )
  if (!markedFailed) return false

  if (!data.previewUrl?.trim()) return true
  return data.title === '生成失败'
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
  if (options.prompt) {
    data.genPrompt = options.prompt
  }

  const layoutSource = resolveImageGenerationLayoutSourceNode(node)
  const layout = resolveImageGenerationPlaceholderLayout(layoutSource)
  node.setData({ ...data, ...layout.data }, { overwrite: true })
  node.resize(layout.width, layout.height)
}

/** 无预览图的图生图上传占位节点（显示「点击或拖拽图片到此处上传」） */
export function isImageGenerationUploadPlaceholderNode(data: CanvasNodeData | undefined): boolean {
  if (!data || data.kind !== 'image') return false
  if (data.previewUrl?.trim()) return false
  if (data.uploadState === 'uploading' || data.imageGenState === 'loading') return false
  return data.mode === 'picker' || data.imageGenTask === 'picker' || data.imageGenTask === 'img2img'
}

/** 图生图对话提交：仅上传占位 / 失败重试节点原地生成；已有成片的节点新建子节点 */
export function shouldGenerateImageInPlaceOnNode(
  data: CanvasNodeData,
  options: { requestedCount: number; hasReferenceImages: boolean },
): boolean {
  if (options.requestedCount !== 1 || data.kind !== 'image') return false
  if (!options.hasReferenceImages) return false
  if (data.previewUrl?.trim() && !isImageGenerationFailedNode(data)) return false
  return isImageGenerationUploadPlaceholderNode(data) || isImageGenerationFailedNode(data)
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
