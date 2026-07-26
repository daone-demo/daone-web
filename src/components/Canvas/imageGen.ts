import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData, ImageGenTask } from './constants'
import { addCanvasNode, getNodeSize } from './graph'
import { GRID_SPLIT_GAP, computeGridSplitContentOrigin } from './gridSplitUtils'

import { getFlowEdgeAttrs } from './edgeStyle'

const GEN_GAP = 56

type OutgoingResultLayoutOptions = {
  layoutSlot?: number
  layoutTotal?: number
}

function countOutgoingSlots(graph: Graph, sourceId: string) {
  return graph.getEdges().filter((edge) => edge.getSourceCellId() === sourceId).length
}

/** 并行生成结果节点：同列纵向错位排布，避免落在同一水平线 */
export function computeOutgoingResultNodePoint(
  sourceNode: Node,
  size: { width: number; height: number },
  options: OutgoingResultLayoutOptions = {},
) {
  const bbox = sourceNode.getBBox()
  const x = bbox.x + bbox.width + GEN_GAP + size.width / 2
  const centerY = bbox.y + bbox.height / 2
  const step = size.height + GEN_GAP
  const slot = options.layoutSlot ?? 0
  const total = options.layoutTotal

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
    fileName: sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png',
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: layout?.layoutTotal,
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
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: layout?.layoutTotal,
  })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
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
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
  const overrides: Partial<CanvasNodeData> = {
    kind: 'image',
    mode: 'editor',
    imageGenTask: 'picker',
    imageGenState: 'loading',
    imageGenProgress: 0,
    title: options.title,
    fileName: options.fileName || options.title,
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    sourceAssetId: sourceData.assetId,
    inputUpdated: Boolean(sourceData.previewUrl),
  }
  const size = getNodeSize('image', 'editor', overrides)
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
  })

  const node = addCanvasNode(graph, 'image', point, overrides)
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
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
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
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
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
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
  },
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const slot = options.layoutSlot ?? countOutgoingSlots(graph, sourceNode.id)
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
  }
  const size = getNodeSize('video', 'editor', overrides)
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
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
  const point = computeOutgoingResultNodePoint(sourceNode, size, {
    layoutSlot: slot,
    layoutTotal: options.layoutTotal,
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
