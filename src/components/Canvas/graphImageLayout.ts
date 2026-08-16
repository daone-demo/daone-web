import type { Graph, Node } from '@antv/x6'
import {
  formatDimensions,
  IMAGE_NODE_LAYOUT_BODY_BORDER,
  type CanvasNodeData,
} from './constants'
import { graphLocalToContainerOffset } from './graphCoords'
import { getBaseNodeSize } from './graphNodeSizing'
import { canResizeImageNode } from './lib/canResizeImageNode'

export { canResizeImageNode } from './lib/canResizeImageNode'

export const IMAGE_NODE_MIN_VIEW_SCALE = 0.35

export function getImageNodeResizeMinWidth(data?: Partial<CanvasNodeData>) {
  return data?.gridSplitTile ? 24 : 120
}

export function computeImageNodeResizeHeight(
  width: number,
  mediaWidth: number,
  mediaHeight: number,
  data?: Partial<CanvasNodeData>,
) {
  if (data?.gridSplitTile) {
    return Math.max(1, Math.round((width * mediaHeight) / mediaWidth))
  }
  return computeImageNodeHeight(width, mediaWidth, mediaHeight)
}

export function getImageNodeViewScale(node: Node) {
  const data = node.getData() as CanvasNodeData
  const baseSize = getBaseNodeSize(data.kind, data.mode, { ...data, viewScale: 1 })
  if (!baseSize.width) return data.viewScale ?? 1
  const scale = node.getSize().width / baseSize.width
  return Math.max(IMAGE_NODE_MIN_VIEW_SCALE, scale)
}

export function getImageNodeDisplayDimensions(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!canResizeImageNode(data)) return ''
  const scale = getImageNodeViewScale(node)
  return formatDimensions(
    Math.round(data.mediaWidth! * scale),
    Math.round(data.mediaHeight! * scale),
  )
}

export function computeImageNodeHeight(
  width: number,
  mediaWidth: number,
  mediaHeight: number,
) {
  const contentW = Math.max(1, width - IMAGE_NODE_LAYOUT_BODY_BORDER)
  return Math.max(120, IMAGE_NODE_LAYOUT_BODY_BORDER + Math.round(contentW * mediaHeight / mediaWidth))
}

/** 图片在图坐标系下的实际显示区域（按媒体宽高比，与 ImageNode 内 img 一致） */
export function getImageNodeMediaGraphBBox(node: Node) {
  const bbox = node.getBBox()
  const data = node.getData() as CanvasNodeData
  if (!data.mediaWidth || !data.mediaHeight || data.compactPreview || data.gridSplitTile) {
    return bbox
  }

  const mediaHeight = computeImageNodeHeight(bbox.width, data.mediaWidth, data.mediaHeight)
  if (mediaHeight <= bbox.height) {
    return {
      x: bbox.x,
      y: bbox.y + (bbox.height - mediaHeight) / 2,
      width: bbox.width,
      height: mediaHeight,
    }
  }

  return {
    x: bbox.x,
    y: bbox.y,
    width: bbox.width,
    height: mediaHeight,
  }
}

export function getImageNodeMediaScreenBox(graph: Graph, node: Node, container: HTMLElement) {
  const bbox = getImageNodeMediaGraphBBox(node)
  const topLeft = graphLocalToContainerOffset(graph, bbox.x, bbox.y, container)
  const bottomRight = graphLocalToContainerOffset(
    graph,
    bbox.x + bbox.width,
    bbox.y + bbox.height,
    container,
  )

  const left = Math.min(topLeft.left, bottomRight.left)
  const top = Math.min(topLeft.top, bottomRight.top)
  const right = Math.max(topLeft.left, bottomRight.left)
  const bottom = Math.max(topLeft.top, bottomRight.top)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    bottom,
  }
}

export function resizeNodeKeepBottomCenter(node: Node, width: number, height: number) {
  const pos = node.position()
  const oldSize = node.getSize()
  const bottomY = pos.y + oldSize.height
  const centerX = pos.x + oldSize.width / 2
  node.resize(width, height)
  node.position(centerX - width / 2, bottomY - height)
}

export function syncImageNodeSizeToMediaAspect(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!data.mediaWidth || !data.mediaHeight) return
  if (data.compactPreview && !data.gridSplitTile) return
  if (data.editorWidth && data.editorHeight && (data.viewScale ?? 1) === 1 && !data.gridSplitTile) return

  const width = node.getSize().width
  const expectedHeight = computeImageNodeResizeHeight(width, data.mediaWidth, data.mediaHeight, data)
  if (Math.abs(node.getSize().height - expectedHeight) <= 1) return
  node.resize(width, expectedHeight)
}

export function syncImageNodeViewScaleFromSize(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!canResizeImageNode(data)) return

  syncImageNodeSizeToMediaAspect(node)

  const nextScale = getImageNodeViewScale(node)
  const current = node.getData() as CanvasNodeData
  if (Math.abs((current.viewScale ?? 1) - nextScale) < 0.001) return

  node.setData({ ...current, viewScale: nextScale })
}

export type ImageResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

export function startImageNodeCornerResize(
  graph: Graph,
  node: Node,
  event: MouseEvent,
  corner: ImageResizeCorner = 'se',
  onResize?: () => void,
) {
  event.preventDefault()
  event.stopPropagation()

  const data = node.getData() as CanvasNodeData
  if (!canResizeImageNode(data)) return

  const startScale = data.viewScale ?? 1
  const baseSize = getBaseNodeSize(data.kind, data.mode, { ...data, viewScale: 1 })
  const startPos = node.position()
  const startSize = node.getSize()
  const startX = event.clientX
  const startY = event.clientY
  const zoom = graph.zoom() || 1

  function onMove(e: MouseEvent) {
    const dx = (e.clientX - startX) / zoom
    const dy = (e.clientY - startY) / zoom
    let delta = (dx + dy) / 2
    if (corner === 'sw') delta = (-dx + dy) / 2
    else if (corner === 'ne') delta = (dx - dy) / 2
    else if (corner === 'nw') delta = (-dx - dy) / 2

    const nextScale = Math.max(
      IMAGE_NODE_MIN_VIEW_SCALE,
      startScale + delta / baseSize.width,
    )

    const minWidth = getImageNodeResizeMinWidth(data)
    const newWidth = Math.max(minWidth, Math.round(baseSize.width * nextScale))
    const newHeight = computeImageNodeResizeHeight(newWidth, data.mediaWidth!, data.mediaHeight!, data)
    let nextX = startPos.x
    let nextY = startPos.y

    if (corner === 'sw' || corner === 'nw') {
      nextX = startPos.x + (startSize.width - newWidth)
    }
    if (corner === 'nw' || corner === 'ne') {
      nextY = startPos.y + (startSize.height - newHeight)
    }

    node.position(nextX, nextY)
    node.resize(newWidth, newHeight)
    onResize?.()
  }

  function onUp() {
    syncImageNodeViewScaleFromSize(node)
    onResize?.()
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
