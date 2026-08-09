import { Graph, Shape, NodeView, type Edge, type Node, type TransformManager } from '@antv/x6'
import { Scroller } from '@antv/x6-plugin-scroller'
import '@antv/x6-plugin-scroller/es/index.css'
import { Selection } from '@antv/x6-plugin-selection'
import '@antv/x6-plugin-selection/es/index.css'
import { register as registerHtmlShape, HTMLShapeView } from 'x6-html-shape'
import createVueRender from 'x6-html-shape/dist/vue'
import type { Component } from 'vue'
import { getDefaultEdgeStroke } from './canvasTheme'
import { bindFlowEdgeInteraction, getFlowEdgeAttrs, getPreviewEdgeAttrs, registerCanvasEdgeDefaults } from './edgeStyle'
import { canOpenConnectMenu } from './nodeConnect'
import { resolveImageNaturalSize, resolveVideoNaturalSize } from './upload'
import TextNode from './nodes/TextNode.vue'
import ImageNode from './nodes/ImageNode.vue'
import ImageGenNode from './nodes/ImageGenNode.vue'
import VideoNode from './nodes/VideoNode.vue'
import Model3DNode from './nodes/Model3DNode.vue'
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  createEmptyNodeData,
  formatDimensions,
  IMAGE_NODE_LAYOUT_META_HEIGHT,
  IMAGE_NODE_LAYOUT_BODY_BORDER,
  PROMPT_BAR_TOP_GAP,
  VIDEO_GEN_PROMPT_TOP_GAP,
  KIND_LABEL,
  NODE_SIZE,
  type CanvasNodeData,
  type NodeKind,
  type NodeMode,
  getImageAdaptiveNodeSize,
  shouldAdaptImageGenerationPlaceholder,
  shouldAdaptImageNodeHeight,
  getVideoAdaptiveNodeSize,
  shouldAdaptVideoNodeHeight,
  computeVideoNodeSizeByAspectRatio,
} from './constants'

export const IMAGE_NODE_MIN_VIEW_SCALE = 0.35

export function canResizeImageNode(data?: Partial<CanvasNodeData>) {
  if (!data || data.kind !== 'image') return false
  if (data.mode !== 'editor') return false
  if (!data.previewUrl?.trim()) return false
  if (data.compactPreview && !data.gridSplitTile) return false
  if (data.uploadState === 'uploading') return false
  if (data.imageGenState === 'loading') return false
  if (!data.mediaWidth || !data.mediaHeight) return false
  return true
}

function getImageNodeResizeMinWidth(data?: Partial<CanvasNodeData>) {
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

type ScrollerImplLike = {
  localToBackgroundPoint(x: number, y: number): { x: number; y: number }
  clientToLocalPoint(x: number, y: number): { x: number; y: number }
  container: HTMLDivElement
}

type SelectionCancelApi = {
  selectionImpl?: {
    undelegateDocumentEvents: () => void
    hideRubberband: () => void
    container: HTMLElement
  }
}

/** 取消 X6 框选残留的 document 监听，避免自定义拖拽后画布无法交互 */
export function cancelActiveRubberband(graph: Graph) {
  const selection = graph.getPlugin('selection') as SelectionCancelApi | null
  const impl = selection?.selectionImpl
  if (!impl) return
  impl.undelegateDocumentEvents()
  impl.hideRubberband()
  impl.container.removeAttribute('style')
}

/**
 * 当前可视视口中心对应的图坐标。
 * scroller 模式下必须用 scrollerImpl.clientToLocalPoint（已计入 scrollLeft/padding/缩放），
 * 直接用 graph.clientToLocal 会忽略滚动偏移，导致新建节点落点偏移很大。
 */
export function clientPointToGraphLocal(
  graph: Graph,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const scroller = getScroller(graph)
  const impl = scroller
    ? (scroller as unknown as { scrollerImpl?: ScrollerImplLike }).scrollerImpl
    : undefined

  if (scroller && impl) {
    const p = impl.clientToLocalPoint(clientX, clientY)
    return { x: p.x, y: p.y }
  }

  return graph.clientToLocal(clientX, clientY)
}

export function getViewportCenterLocal(graph: Graph): { x: number; y: number } {
  const scroller = getScroller(graph)
  if (scroller) {
    const el = scroller.container
    const rect = el.getBoundingClientRect()
    return clientPointToGraphLocal(
      graph,
      rect.left + el.clientWidth / 2,
      rect.top + el.clientHeight / 2,
    )
  }

  const rect = graph.container.getBoundingClientRect()
  return clientPointToGraphLocal(
    graph,
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  )
}

/**
 * 图坐标 → 浮层定位容器（.canvas）内的像素偏移。
 * 须使用不随 Scroller 滚动的容器；勿用 graph.container（会随内容滚动）。
 * 统一走 graph.localToClient，缩放/滚动时与节点视觉位置保持同步。
 */
export function graphLocalToContainerOffset(
  graph: Graph,
  localX: number,
  localY: number,
  container: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect()
  const client = graph.localToClient(localX, localY)
  return {
    left: client.x - containerRect.left,
    top: client.y - containerRect.top,
  }
}

type EdgeViewLike = {
  getPointAtRatio?: (ratio: number) => { x: number; y: number }
}

/** 连线几何中点（图坐标），优先取路径 50% 位置 */
export function getEdgeMidpointLocal(graph: Graph, edge: Edge) {
  const view = graph.findViewByCell(edge) as EdgeViewLike | null
  if (view?.getPointAtRatio) {
    return view.getPointAtRatio(0.5)
  }
  return edge.getBBox().getCenter()
}

/** 连线删除按钮在 .canvas 容器内的定位 */
export function getEdgeDeleteButtonPosition(
  graph: Graph,
  edge: Edge,
  container: HTMLElement,
) {
  const mid = getEdgeMidpointLocal(graph, edge)
  return graphLocalToContainerOffset(graph, mid.x, mid.y, container)
}

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

/** 当前可视区域内是否存在至少一个节点（与屏幕有交集） */
export function hasVisibleNodesInViewport(graph: Graph, overlayRoot: HTMLElement) {
  const nodes = graph.getNodes()
  if (!nodes.length) return false

  const scroller = getScroller(graph)
  if (!scroller) return true

  const scrollRect = scroller.container.getBoundingClientRect()
  const containerRect = overlayRoot.getBoundingClientRect()
  const viewLeft = scrollRect.left - containerRect.left
  const viewTop = scrollRect.top - containerRect.top
  const viewRight = viewLeft + scrollRect.width
  const viewBottom = viewTop + scrollRect.height

  return nodes.some((node) => {
    const bbox = node.getBBox()
    const topLeft = graphLocalToContainerOffset(graph, bbox.x, bbox.y, overlayRoot)
    const bottomRight = graphLocalToContainerOffset(
      graph,
      bbox.x + bbox.width,
      bbox.y + bbox.height,
      overlayRoot,
    )
    const nodeLeft = Math.min(topLeft.left, bottomRight.left)
    const nodeTop = Math.min(topLeft.top, bottomRight.top)
    const nodeRight = Math.max(topLeft.left, bottomRight.left)
    const nodeBottom = Math.max(topLeft.top, bottomRight.top)

    return (
      nodeRight > viewLeft &&
      nodeLeft < viewRight &&
      nodeBottom > viewTop &&
      nodeTop < viewBottom
    )
  })
}

/** 将画布内容居中到当前视窗 */
export function centerGraphContent(
  graph: Graph,
  options?: {
    animate?: boolean
    duration?: string
    onComplete?: () => void
  },
) {
  const scroller = getScroller(graph)
  if (!scroller || graph.getNodes().length === 0) return

  if (options?.animate) {
    const center = graph.getContentArea().getCenter()
    scroller.transitionToPoint(center.x, center.y, {
      duration: options.duration ?? '320ms',
      timing: 'ease-in-out',
      onTransitionEnd: () => {
        options.onComplete?.()
      },
    })
    return
  }

  scroller.centerContent()
}

export type ConnectMenuOpener = (
  nodeId: string,
  releasePoint: { x: number; y: number },
) => void

import type { TextEditorApi } from './nodes/useTextEditorRegistry'

export type TextEditorRegistry = {
  register: (nodeId: string, api: TextEditorApi) => void
  unregister: (nodeId: string) => void
  get: (nodeId: string) => TextEditorApi | undefined
}

export type CanvasGraph = Graph & {
  __scroller?: Scroller
  __openConnectMenu?: ConnectMenuOpener
  __openImageDialogue?: (nodeId: string) => void
  __openImageContextMenu?: (nodeId: string, clientX: number, clientY: number) => void
  __openMediaContextMenu?: (nodeId: string, clientX: number, clientY: number) => void
  __removeImageElementMark?: (markId: string) => void
  __selectImageElementMark?: (markId: string) => void
  __openVideoDialogue?: (nodeId: string) => void
  __deleteCanvasNode?: (nodeId: string) => void
  __uploadFileToCanvasNode?: (nodeId: string, file: File) => void
  __textEditorRegistry?: TextEditorRegistry
  __requestTextExpand?: (nodeId: string) => void
  __onTextPickerAction?: (key: string, nodeId: string) => void
  __onVideoPickerAction?: (key: string, nodeId: string) => void
  __onTextNodeEdgeLinked?: (textNodeId: string) => void
  __onNodeEdgeLinked?: (targetNodeId: string, sourceNodeId?: string) => void
  __notifyTextNodeUpdated?: () => void
  __focusCanvasNode?: (nodeId: string) => void
  __onTextEditorFocus?: (nodeId: string) => void
  __deactivateTextEditorToolbar?: () => void
  __notifyNodeDragMove?: () => void
  __notifyNodeDragEnd?: () => void
  __startImageNodeCornerResize?: (event: MouseEvent, corner: ImageResizeCorner) => void
  __primarySelectedNodeId?: () => string
  __suppressBlankCloseForConnect?: boolean
  __connectPreviewEdgeId?: string
}

let shapesRegistered = false
let htmlShapeSyncPatched = false

const LEGACY_VUE_SHAPE_VIEW = 'vue-shape-view'
const HTML_SHAPE_VIEW = 'html-shape-view'

/** 兼容历史画布：将 vue-shape-view 映射到 html-shape-view */
function ensureHtmlShapeViewCompat() {
  if (!NodeView.registry.exist(LEGACY_VUE_SHAPE_VIEW)) {
    NodeView.registry.register(LEGACY_VUE_SHAPE_VIEW, HTMLShapeView, true)
  }
}

/** 迁移持久化画布 JSON 中的旧 view 名称（localStorage / 接口快照） */
export function migrateGraphJsonForHtmlShape(
  graphJson: ReturnType<Graph['toJSON']>,
): ReturnType<Graph['toJSON']> {
  const cells = graphJson.cells
  if (!cells?.length) return graphJson

  let changed = false
  const nextCells = cells.map((cell) => {
    if (!cell || typeof cell !== 'object') return cell
    const record = cell as Record<string, unknown>
    if (record.view === LEGACY_VUE_SHAPE_VIEW) {
      changed = true
      return { ...cell, view: HTML_SHAPE_VIEW }
    }
    return cell
  })

  return changed ? { ...graphJson, cells: nextCells } : graphJson
}

const counters: Record<NodeKind, number> = {
  text: 0,
  image: 0,
  video: 0,
  audio: 0,
  model3d: 0,
}

/**
 * x6-html-shape 首次挂载不会同步 HTML 层位置/矩阵，Safari 上节点需拖拽后才可见。
 * 在 onMounted 中补一次 updateContainerStyle + updateHtmlContainerSize。
 */
function patchHtmlShapeViewSync() {
  if (htmlShapeSyncPatched) return
  htmlShapeSyncPatched = true

  const proto = HTMLShapeView.prototype as HTMLShapeView & {
    onMounted: () => void
  }
  const originalOnMounted = proto.onMounted
  proto.onMounted = function patchedHtmlShapeOnMounted(this: HTMLShapeView) {
    originalOnMounted.call(this)
    this.updateContainerStyle()
    this.updateHtmlContainerSize()
  }
}

/** 同步 html-shape 节点 DOM 位置与画布 transform（新建节点 / 缩放 / 平移后调用） */
export function syncHtmlShapeViews(graph: Graph, node?: Node) {
  const cells = node ? [node] : graph.getNodes()
  cells.forEach((cell) => {
    const view = graph.findViewByCell(cell) as HTMLShapeView | null
    if (!view?.updateContainerStyle) return
    view.updateContainerStyle()
    view.updateHtmlContainerSize()
  })
}

function bindHtmlShapeSync(graph: Graph) {
  patchHtmlShapeViewSync()

  const scheduleSync = (target?: Node) => {
    requestAnimationFrame(() => {
      syncHtmlShapeViews(graph, target)
      // Safari 首帧 layout 偶发未完成，再补一帧确保可见
      requestAnimationFrame(() => syncHtmlShapeViews(graph, target))
    })
  }

  graph.on('node:added', ({ node }) => scheduleSync(node))
  graph.on('node:change:position', ({ node }) => syncHtmlShapeViews(graph, node))
  graph.on('node:change:size', ({ node }) => syncHtmlShapeViews(graph, node))
  graph.on('scale', () => syncHtmlShapeViews(graph))
  graph.on('translate', () => syncHtmlShapeViews(graph))
  graph.on('resize', () => scheduleSync())
}

function registerVueNode(
  shape: string,
  component: Component,
  width: number,
  height: number,
) {
  registerHtmlShape({
    shape,
    render: createVueRender(component),
    width,
    height,
  })
}

export function registerShapes() {
  ensureHtmlShapeViewCompat()
  if (shapesRegistered) return
  shapesRegistered = true

  registerCanvasEdgeDefaults()

  // x6-html-shape：用 HTML 层渲染节点，规避 Safari foreignObject + position 兼容问题
  registerVueNode('text-node', TextNode, 180, 270)
  registerVueNode('image-node', ImageNode, 180, 270)
  registerVueNode('image-gen-node', ImageGenNode, 180, 270)
  registerVueNode('video-node', VideoNode, 350, 200)
  registerVueNode('model3d-node', Model3DNode, 320, 360)
}

export function createDefaultNodeData(kind: NodeKind): CanvasNodeData {
  counters[kind] += 1
  const base = createEmptyNodeData()
  return {
    ...base,
    kind,
    title: `${KIND_LABEL[kind]} ${counters[kind]}`,
    mode: kind === 'text' || kind === 'audio' || kind === 'video' ? 'picker' : 'editor',
  }
}

export function getNodeShape(kind: NodeKind, data?: Partial<CanvasNodeData>) {
  if (kind === 'text' || kind === 'audio') return 'text-node'
  if (kind === 'video') return 'video-node'
  if (kind === 'model3d') return 'model3d-node'
  if (kind === 'image' && data?.imageGenTask) return 'image-gen-node'
  return 'image-node'
}

export function getBaseNodeSize(
  kind: NodeKind,
  mode: NodeMode = 'picker',
  data?: Partial<CanvasNodeData>,
) {
  if (kind === 'text' || kind === 'audio') {
    if (mode === 'editor') {
      const base = NODE_SIZE.text.editor
      return {
        width: data?.editorWidth ?? base.width,
        height: data?.editorHeight ?? base.height,
      }
    }
    return NODE_SIZE.text.picker
  }
  if (kind === 'video') {
    const hasPreview = Boolean(data?.previewUrl?.trim())
    const isGenerating =
      data?.uploadState === 'uploading' &&
      (data?.generationTaskType === 'VIDEO' || Boolean(data?.generationTaskId))
    const ratio = data?.videoGenAspectRatio

    if (ratio && ratio !== 'auto' && (!hasPreview || isGenerating || data.videoGenAspectRatio)) {
      return computeVideoNodeSizeByAspectRatio(ratio)
    }
    if (data && shouldAdaptVideoNodeHeight(data)) {
      return getVideoAdaptiveNodeSize(data)
    }
    if (mode === 'picker' || !hasPreview) return NODE_SIZE.video.picker
    return NODE_SIZE.video.media
  }
  if (kind === 'model3d') {
    return NODE_SIZE.model3d.editor
  }
  if (kind === 'image') {
    if (data && shouldAdaptImageGenerationPlaceholder(data)) {
      return getImageAdaptiveNodeSize(data)
    }
    if (data?.editorWidth && data?.editorHeight) {
      return {
        width: data.editorWidth,
        height: data.editorHeight,
      }
    }
    if (data && shouldAdaptImageNodeHeight(data)) {
      return getImageAdaptiveNodeSize(data)
    }
    if (data?.imageGenTask === 'picker') return NODE_SIZE.image.genPicker
    if (data?.imageGenTask === 'img2img') return NODE_SIZE.image.img2img
    if (data?.imageGenTask === 'hd') return NODE_SIZE.image.hd
    return NODE_SIZE.image.landscape
  }
  return NODE_SIZE.image.landscape
}

export function getNodeSize(
  kind: NodeKind,
  mode: NodeMode = 'picker',
  data?: Partial<CanvasNodeData>,
) {
  const base = getBaseNodeSize(kind, mode, data)
  const scale = data?.viewScale ?? 1

  if (
    kind === 'image' &&
    scale !== 1 &&
    data?.mediaWidth &&
    data?.mediaHeight &&
    (!data.compactPreview || data.gridSplitTile)
  ) {
    const width = Math.max(getImageNodeResizeMinWidth(data), Math.round(base.width * scale))
    return {
      width,
      height: computeImageNodeResizeHeight(width, data.mediaWidth, data.mediaHeight, data),
    }
  }

  if (scale === 1) return base
  return {
    width: Math.max(120, Math.round(base.width * scale)),
    height: Math.max(120, Math.round(base.height * scale)),
  }
}

/** 当前可视区域内的随机图坐标（用于点击添加节点，避免每次都落在正中心） */
export function getRandomViewportLocalPoint(
  graph: Graph,
  options: { kind?: NodeKind; mode?: NodeMode } = {},
) {
  const kind = options.kind ?? 'image'
  const mode = options.mode ?? 'editor'
  const { width, height } = getNodeSize(kind, mode)
  const padX = width / 2 + 24
  const padY = height / 2 + 24

  const scroller = getScroller(graph)
  const el = scroller?.container ?? graph.container
  const rect = el.getBoundingClientRect()

  const topLeft = clientPointToGraphLocal(graph, rect.left, rect.top)
  const bottomRight = clientPointToGraphLocal(graph, rect.right, rect.bottom)

  const minX = Math.min(topLeft.x, bottomRight.x) + padX
  const maxX = Math.max(topLeft.x, bottomRight.x) - padX
  const minY = Math.min(topLeft.y, bottomRight.y) + padY
  const maxY = Math.max(topLeft.y, bottomRight.y) - padY

  if (minX >= maxX || minY >= maxY) {
    const center = getViewportCenterLocal(graph)
    return {
      x: center.x + (Math.random() - 0.5) * 120,
      y: center.y + (Math.random() - 0.5) * 90,
    }
  }

  return {
    x: minX + Math.random() * (maxX - minX),
    y: minY + Math.random() * (maxY - minY),
  }
}

export function createPorts(stroke = '#8b8b95') {
  return {
    groups: {
      left: {
        position: { name: 'left' },
        attrs: {
          circle: {
            r: 12,
            magnet: false,
            stroke,
            strokeWidth: 1.5,
            fill: '#2a2a30',
            cursor: 'crosshair',
            style: { visibility: 'hidden' },
          },
          plus: {
            text: '+',
            fontSize: 14,
            fill: '#d1d5db',
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            pointerEvents: 'none',
            style: { visibility: 'hidden' },
          },
        },
        markup: [
          { tagName: 'circle', selector: 'circle' },
          { tagName: 'text', selector: 'plus' },
        ],
      },
      right: {
        position: { name: 'right' },
        attrs: {
          circle: {
            r: 12,
            magnet: false,
            stroke,
            strokeWidth: 1.5,
            fill: '#2a2a30',
            cursor: 'crosshair',
            style: { visibility: 'hidden' },
          },
          plus: {
            text: '+',
            fontSize: 14,
            fill: '#d1d5db',
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            pointerEvents: 'none',
            style: { visibility: 'hidden' },
          },
        },
        markup: [
          { tagName: 'circle', selector: 'circle' },
          { tagName: 'text', selector: 'plus' },
        ],
      },
    },
    items: [
      { id: 'left', group: 'left' },
      { id: 'right', group: 'right' },
    ],
  }
}

export function setPortsVisible(node: Node, visible: boolean) {
  const visibility = visible ? 'visible' : 'hidden'
  node.getPorts().forEach((port) => {
    if (!port.id) return
    node.setPortProp(port.id, 'attrs/circle/style/visibility', visibility)
    node.setPortProp(port.id, 'attrs/plus/style/visibility', visibility)
  })
}

export function getScroller(graph: Graph): Scroller | null {
  return graph.getPlugin<Scroller>('scroller') ?? null
}

/** 无限画布：最小可滚动区域（像素，未乘缩放），足够大以营造"无限"拖拽体验 */
const INFINITE_CANVAS_MIN_SIZE = 12000

function getInfiniteCanvasResizeOptions(
  scroller: { container: HTMLElement },
): TransformManager.FitToContentFullOptions {
  const { clientWidth, clientHeight } = scroller.container
  const vw = clientWidth || 800
  const vh = clientHeight || 600
  const padX = Math.max(2400, vw)
  const padY = Math.max(2400, vh)

  return {
    allowNewOrigin: 'any',
    minWidth: INFINITE_CANVAS_MIN_SIZE,
    minHeight: INFINITE_CANVAS_MIN_SIZE,
    padding: { top: padY, bottom: padY, left: padX, right: padX },
  }
}

/**
 * 扩展 Scroller 可滚动区域。
 * resize() 会触发 fitToContent（allowNewOrigin:'any'）重算原点并平移视图，
 * 因此默认在 resize 前后保持可视中心不变，避免新建/移动节点时视图突然跳动、节点被甩到角落。
 * 首次初始化传 recenter:true 时主动居中（有内容→内容居中，空画布→原点居中）。
 */
export function ensureInfiniteCanvasArea(
  graph: Graph,
  options?: { recenter?: boolean },
) {
  const scroller = getScroller(graph)
  if (!scroller) return

  if (options?.recenter) {
    scroller.resize()
    if (graph.getNodes().length > 0) {
      scroller.centerContent()
    } else {
      scroller.centerPoint(0, 0)
    }
    return
  }

  const before = getViewportCenterLocal(graph)
  scroller.resize()
  scroller.centerPoint(before.x, before.y)
}

export function createGraph(container: HTMLElement): CanvasGraph {
  registerShapes()

  const graph = new Graph({
    container,
    autoResize: true,
    background: { color: 'transparent' },
    grid: {
      visible: true,
      size: 16,
      type: 'dot',
      args: { color: '#2a2a30', thickness: 1.2 },
    },
    panning: false,
    clickThreshold: 5,
    mousewheel: {
      enabled: true,
      modifiers: null,
      factor: 1.08,
      minScale: CANVAS_MIN_ZOOM,
      maxScale: CANVAS_MAX_ZOOM,
      zoomAtMousePosition: true,
    },
    interacting: {
      nodeMovable: true,
      edgeMovable: true,
      magnetConnectable: true,
    },
    connecting: {
      snap: true,
      allowBlank: (args) => {
        const source = args.sourceCell
        if (!source?.isNode()) return false
        return canOpenConnectMenu(source)
      },
      allowLoop: false,
      allowMulti: false,
      highlight: true,
      connector: { name: 'smooth', args: { direction: 'H' } },
      connectionPoint: 'boundary',
      router: { name: 'normal' },
      createEdge(this: Graph, args) {
        const source = args?.sourceCell
        const usePreview =
          source?.isNode() && canOpenConnectMenu(source)

        return new Shape.Edge({
          attrs: usePreview ? getPreviewEdgeAttrs() : getFlowEdgeAttrs(getDefaultEdgeStroke()),
          zIndex: 0,
        })
      },
      validateConnection({ sourceCell, targetCell }) {
        if (!sourceCell || !targetCell) return false
        return sourceCell.id !== targetCell.id
      },
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: { attrs: { fill: '#6b7cff', stroke: '#6b7cff' } },
      },
    },
  }) as CanvasGraph

  const scroller = new Scroller({
    enabled: true,
    pannable: false,
    pageVisible: false,
    pageBreak: false,
    autoResize: true,
    autoResizeOptions(scroller) {
      return getInfiniteCanvasResizeOptions(scroller)
    },
    padding: { top: 80, bottom: 80, left: 120, right: 120 },
  })

  graph.use(scroller)
  graph.__scroller = scroller

  graph.use(
    new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      rubberNode: true,
      rubberEdge: false,
      modifiers: null,
      multipleSelectionModifiers: ['ctrl', 'meta'],
      showNodeSelectionBox: true,
      pointerEvents: 'none',
    }),
  )

  bindHtmlShapeSync(graph)

  return graph
}

export function syncNodeShapeFromData(node: Node) {
  const data = node.getData() as CanvasNodeData
  const shape = getNodeShape(data.kind, data)
  if (node.shape !== shape) {
    node.setProp('shape', shape)
  }
}

export function addCanvasNode(
  graph: Graph,
  kind: NodeKind,
  point: { x: number; y: number },
  overrides: Partial<CanvasNodeData> = {},
  options?: { id?: string },
) {
  const data = { ...createDefaultNodeData(kind), ...overrides }
  const size = getNodeSize(kind, data.mode, data)
  const shape = getNodeShape(kind, data)

  return graph.addNode({
    ...(options?.id ? { id: options.id } : {}),
    shape,
    x: point.x - size.width / 2,
    y: point.y - size.height / 2,
    width: size.width,
    height: size.height,
    ports: createPorts('#6b7280'),
    data,
  })
}

export function bindGraphInteraction(graph: Graph) {
  bindFlowEdgeInteraction(graph)

  let infiniteResizeRaf = 0
  const scheduleInfiniteResize = () => {
    if (infiniteResizeRaf) cancelAnimationFrame(infiniteResizeRaf)
    infiniteResizeRaf = requestAnimationFrame(() => {
      infiniteResizeRaf = 0
      // 保持可视中心不变地扩展区域，避免新建节点后视图跳动/节点偏移
      ensureInfiniteCanvasArea(graph)
    })
  }

  graph.on('node:change:data', ({ node }) => {
    const data = node.getData() as CanvasNodeData
    node.prop('movable', !data.nodeLocked)
    syncNodeShapeFromData(node)
    const size = getNodeSize(data.kind, data.mode, data)
    const current = node.getSize()
    if (
      Math.abs(current.width - size.width) <= 1 &&
      Math.abs(current.height - size.height) <= 1
    ) {
      return
    }
    const ratio = data.videoGenAspectRatio
    if (
      data.kind === 'video' &&
      ratio &&
      ratio !== 'auto'
    ) {
      resizeNodeKeepBottomCenter(node, size.width, size.height)
      return
    }
    node.resize(size.width, size.height)
  })

  graph.on('node:resized', ({ node }: { node: Node }) => {
    syncImageNodeViewScaleFromSize(node)
  })

  graph.on('node:added', scheduleInfiniteResize)
  graph.on('node:removed', scheduleInfiniteResize)
  graph.on('node:moved', scheduleInfiniteResize)
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

/** 按当前数据重新计算并应用节点尺寸（用于历史记录恢复后的尺寸校正） */
export function syncAllNodeSizes(graph: Graph) {
  graph.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    const size = getNodeSize(data.kind, data.mode, data)
    node.resize(size.width, size.height)
  })
}

/** html-shape 节点在独立 Vue 实例中，主题切换后强制重渲染 */
export function refreshCanvasNodeViews(graph: Graph) {
  graph.getNodes().forEach((node) => {
    refreshCanvasNodeView(graph, node)
  })
  syncHtmlShapeViews(graph)
}

/** 强制重渲染单个 html-shape 节点视图 */
export function refreshCanvasNodeView(graph: Graph, node: Node) {
  const view = graph.findViewByCell(node) as HTMLShapeView | null
  if (!view) return

  if (typeof view.mounted === 'function') {
    view.mounted()
    view.mounted = undefined
    view.update()
  }
  syncHtmlShapeViews(graph, node)
}

function needsImageDimensionHydration(data: CanvasNodeData) {
  return (
    data.kind === 'image' &&
    Boolean(data.previewUrl?.trim()) &&
    !(data.mediaWidth > 0 && data.mediaHeight > 0)
  )
}

export async function hydrateImageNodeDimensions(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!needsImageDimensionHydration(data)) {
    return data.mediaWidth > 0 && data.mediaHeight > 0
  }

  try {
    const { width, height } = await resolveImageNaturalSize(data.previewUrl)
    const current = { ...(node.getData() as CanvasNodeData) }
    if (current.previewUrl !== data.previewUrl) return false
    current.mediaWidth = width
    current.mediaHeight = height
    node.setData(current)
    syncNodeShapeFromData(node)
    const size = getNodeSize(current.kind, current.mode, current)
    node.resize(size.width, size.height)
    return true
  } catch {
    return false
  }
}

function needsVideoDimensionHydration(data: CanvasNodeData) {
  return (
    data.kind === 'video' &&
    Boolean(data.previewUrl?.trim()) &&
    !(data.mediaWidth! > 0 && data.mediaHeight! > 0)
  )
}

export async function hydrateVideoNodeDimensions(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!needsVideoDimensionHydration(data)) {
    return data.mediaWidth! > 0 && data.mediaHeight! > 0
  }

  try {
    const meta = await resolveVideoNaturalSize(data.previewUrl)
    const current = { ...(node.getData() as CanvasNodeData) }
    if (current.previewUrl !== data.previewUrl) return false
    current.mediaWidth = meta.width
    current.mediaHeight = meta.height
    if (meta.durationSeconds) {
      current.durationSeconds = meta.durationSeconds
    }
    node.setData(current)
    syncNodeShapeFromData(node)
    const size = getNodeSize(current.kind, current.mode, current)
    node.resize(size.width, size.height)
    return true
  } catch {
    return false
  }
}

/** 画布恢复后，为缺失尺寸的图片节点补全 mediaWidth/mediaHeight */
export async function hydrateMissingImageNodeDimensions(graph: Graph) {
  const nodes = graph.getNodes().filter((node) => {
    const data = node.getData() as CanvasNodeData
    return needsImageDimensionHydration(data) || needsVideoDimensionHydration(data)
  })
  await Promise.allSettled(
    nodes.map((node) => {
      const data = node.getData() as CanvasNodeData
      if (data.kind === 'video') return hydrateVideoNodeDimensions(node)
      return hydrateImageNodeDimensions(node)
    }),
  )
}
