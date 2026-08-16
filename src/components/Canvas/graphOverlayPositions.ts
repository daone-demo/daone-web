import type { Graph, Node } from '@antv/x6'
import {
  IMAGE_NODE_LAYOUT_META_HEIGHT,
  PROMPT_BAR_TOP_GAP,
  VIDEO_GEN_PROMPT_TOP_GAP,
  type CanvasNodeData,
} from './constants'
import { graphLocalToContainerOffset } from './graphCoords'
import { getImageNodeMediaScreenBox } from './graphImageLayout'

/** 节点在容器坐标系下的屏幕包围盒（缩放后真实像素） */
export function getNodeOverlayScreenBox(graph: Graph, node: Node, container: HTMLElement) {
  const bbox = node.getBBox()
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

function getNodeToolbarAnchorY(node: Node) {
  const bbox = node.getBBox()
  const data = node.getData() as CanvasNodeData
  if (
    data.kind === 'image' &&
    data.mode === 'editor' &&
    !data.imageGenTask &&
    !data.compactPreview &&
    data.previewUrl
  ) {
    return bbox.y - IMAGE_NODE_LAYOUT_META_HEIGHT - 6
  }
  return bbox.y
}

export function getGroupScreenBox(
  graph: Graph,
  nodeIds: string[],
  container: HTMLElement,
  padding = 20,
) {
  const cells = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())

  if (!cells.length) {
    return { left: 0, top: 0, width: 0, height: 0, centerX: 0, anchorTop: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  cells.forEach((node) => {
    const bbox = node.getBBox()
    minX = Math.min(minX, bbox.x)
    minY = Math.min(minY, bbox.y)
    maxX = Math.max(maxX, bbox.x + bbox.width)
    maxY = Math.max(maxY, bbox.y + bbox.height)
  })

  return getGroupScreenBoxFromGraphBox(
    graph,
    {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    },
    container,
  )
}

export function getGroupScreenBoxFromGraphBox(
  graph: Graph,
  box: { x: number; y: number; width: number; height: number },
  container: HTMLElement,
) {
  const topLeft = graphLocalToContainerOffset(graph, box.x, box.y, container)
  const bottomRight = graphLocalToContainerOffset(
    graph,
    box.x + box.width,
    box.y + box.height,
    container,
  )

  return {
    left: topLeft.left,
    top: topLeft.top,
    width: Math.max(0, bottomRight.left - topLeft.left),
    height: Math.max(0, bottomRight.top - topLeft.top),
    centerX: (topLeft.left + bottomRight.left) / 2,
    anchorTop: topLeft.top,
  }
}

export function getMultiSelectionToolbarPosition(
  graph: Graph,
  nodeIds: string[],
  container: HTMLElement,
) {
  const cells = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())

  if (!cells.length) {
    return { left: 0, top: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity

  cells.forEach((node) => {
    const bbox = node.getBBox()
    minX = Math.min(minX, bbox.x)
    minY = Math.min(minY, bbox.y)
    maxX = Math.max(maxX, bbox.x + bbox.width)
  })

  const centerX = (minX + maxX) / 2
  const anchorOffset = graphLocalToContainerOffset(graph, centerX, minY, container)

  return {
    left: anchorOffset.left,
    top: anchorOffset.top - 10,
  }
}

/** 图片标记提示：节点左上角上方 */
export function getImageMarkHintPosition(graph: Graph, node: Node, container: HTMLElement) {
  const bbox = node.getBBox()
  const offset = graphLocalToContainerOffset(graph, bbox.x, bbox.y, container)
  return {
    left: offset.left + 20,
    top: offset.top - 65,
  }
}

export function getNodeToolbarPosition(graph: Graph, node: Node, container: HTMLElement) {
  const bbox = node.getBBox()
  const box = getNodeOverlayScreenBox(graph, node, container)
  const anchorY = getNodeToolbarAnchorY(node)
  const anchorOffset = graphLocalToContainerOffset(
    graph,
    bbox.x + bbox.width / 2,
    anchorY,
    container,
  )

  return {
    left: box.centerX,
    top: anchorOffset.top - 8,
  }
}

export function getNodeTextFormatToolbarPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
) {
  const bbox = node.getBBox()
  const box = getNodeOverlayScreenBox(graph, node, container)
  const anchorOffset = graphLocalToContainerOffset(
    graph,
    bbox.x + bbox.width / 2,
    bbox.y,
    container,
  )

  return {
    left: box.centerX,
    top: anchorOffset.top - 10,
    width: Math.max(box.width, 680),
  }
}

export function getNodeTextDownloadPosition(graph: Graph, node: Node, container: HTMLElement) {
  const formatPos = getNodeTextFormatToolbarPosition(graph, node, container)
  return {
    left: formatPos.left,
    top: formatPos.top - 44,
  }
}

export function getNodeDialoguePosition(graph: Graph, node: Node, container: HTMLElement) {
  const box = getNodeOverlayScreenBox(graph, node, container)

  return {
    left: box.centerX,
    top: box.bottom + 12,
    width: Math.max(box.width, 680),
  }
}

/** 文本/音频 picker 底部输入框：锚定在节点正下方水平居中 */
export function getNodePromptPosition(graph: Graph, node: Node, container: HTMLElement) {
  const box = getNodeOverlayScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(560, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + PROMPT_BAR_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 680)),
  }
}

/** 图生图底部对话框：相对节点水平居中，略宽于节点 */
export function getNodeImageGenPromptPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
) {
  const box = getNodeOverlayScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(720, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + PROMPT_BAR_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 680)),
  }
}

/** 文生视频底部面板：间距较图生图/文本提示栏更紧凑 */
export function getNodeVideoGenPromptPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
) {
  const box = getNodeOverlayScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(720, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + VIDEO_GEN_PROMPT_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 680)),
  }
}

export function getNodeSidePanelPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
  panelWidth = 320,
  panelHeight = 260,
) {
  const bbox = node.getBBox()
  const topRight = graphLocalToContainerOffset(graph, bbox.x + bbox.width, bbox.y, container)
  const rect = container.getBoundingClientRect()

  return {
    left: Math.max(12, Math.min(topRight.left + 16, rect.width - panelWidth - 12)),
    top: Math.max(60, Math.min(topRight.top, rect.height - panelHeight - 12)),
    width: panelWidth,
  }
}

export const IMAGE_EXPAND_TOOLBAR_HEIGHT = 44
export const IMAGE_EXPAND_TOOLBAR_GAP = 10

export interface ImageExpandOverlayLayout {
  left: number
  top: number
  width: number
  height: number
  padX: number
  padY: number
  mediaWidth: number
  mediaHeight: number
}

/** 扩图浮层：锚定在图片媒体区域上，四周留出可扩展空间 */
export function getImageExpandOverlayLayout(
  graph: Graph,
  node: Node,
  container: HTMLElement,
): ImageExpandOverlayLayout {
  const box = getImageNodeMediaScreenBox(graph, node, container)
  const padX = Math.max(Math.round(box.width), 120)
  const padY = Math.max(Math.round(box.height), 120)
  const toolbarOffset = IMAGE_EXPAND_TOOLBAR_HEIGHT + IMAGE_EXPAND_TOOLBAR_GAP

  return {
    left: box.left - padX,
    top: box.top - padY - toolbarOffset,
    width: box.width + padX * 2,
    height: box.height + padY * 2 + toolbarOffset,
    padX,
    padY,
    mediaWidth: box.width,
    mediaHeight: box.height,
  }
}

export function getNodeCropOverlayPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
  minWidth = 520,
  minHeight = 420,
) {
  const box = getNodeOverlayScreenBox(graph, node, container)
  const rect = container.getBoundingClientRect()
  const width = Math.max(box.width, minWidth)
  const height = Math.max(box.height + 48, minHeight)

  return {
    left: Math.max(
      12,
      Math.min(box.left - (width - box.width) / 2, rect.width - width - 12),
    ),
    top: Math.max(60, Math.min(box.top, rect.height - height - 12)),
    width,
    height,
  }
}
