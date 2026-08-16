import { Graph, Shape, NodeView, type Node, type TransformManager } from '@antv/x6'
import { Scroller } from '@antv/x6-plugin-scroller'
import '@antv/x6-plugin-scroller/es/index.css'
import { Selection } from '@antv/x6-plugin-selection'
import '@antv/x6-plugin-selection/es/index.css'
import { register as registerHtmlShape, HTMLShapeView } from 'x6-html-shape'
import createVueRender from 'x6-html-shape/dist/vue'
import { defineAsyncComponent, type Component } from 'vue'
import { getDefaultEdgeStroke } from './canvasTheme'
import { bindFlowEdgeInteraction, getFlowEdgeAttrs, getPreviewEdgeAttrs, registerCanvasEdgeDefaults } from './edgeStyle'
import { canOpenConnectMenu } from './nodeConnect'
import { resolveImageNaturalSize, resolveVideoNaturalSize } from './upload'
import TextNode from './nodes/TextNode.vue'
import ImageNode from './nodes/ImageNode.vue'
import ImageGenNode from './nodes/ImageGenNode.vue'
import VideoNode from './nodes/VideoNode.vue'
import {
  clientPointToGraphLocal,
  getViewportCenterLocal,
  graphLocalToContainerOffset,
} from './graphCoords'

export {
  IMAGE_NODE_MIN_VIEW_SCALE,
  canResizeImageNode,
  getImageNodeResizeMinWidth,
  computeImageNodeResizeHeight,
  getImageNodeViewScale,
  getImageNodeDisplayDimensions,
  computeImageNodeHeight,
  getImageNodeMediaGraphBBox,
  getImageNodeMediaScreenBox,
  resizeNodeKeepBottomCenter,
  syncImageNodeSizeToMediaAspect,
  syncImageNodeViewScaleFromSize,
  startImageNodeCornerResize,
  type ImageResizeCorner,
} from './graphImageLayout'
export {
  getNodeOverlayScreenBox,
  getGroupScreenBox,
  getGroupScreenBoxFromGraphBox,
  getMultiSelectionToolbarPosition,
  getImageMarkHintPosition,
  getNodeToolbarPosition,
  getNodeTextFormatToolbarPosition,
  getNodeTextDownloadPosition,
  getNodeDialoguePosition,
  getNodePromptPosition,
  getNodeImageGenPromptPosition,
  getNodeVideoGenPromptPosition,
  getNodeSidePanelPosition,
  IMAGE_EXPAND_TOOLBAR_HEIGHT,
  IMAGE_EXPAND_TOOLBAR_GAP,
  getImageExpandOverlayLayout,
  getNodeCropOverlayPosition,
  type ImageExpandOverlayLayout,
} from './graphOverlayPositions'
import {
  computeImageNodeResizeHeight,
  getImageNodeResizeMinWidth,
  syncImageNodeViewScaleFromSize,
  resizeNodeKeepBottomCenter,
  type ImageResizeCorner,
} from './graphImageLayout'
export {
  clientPointToGraphLocal,
  getEdgeDeleteButtonPosition,
  getEdgeMidpointLocal,
  getViewportCenterLocal,
  graphLocalToContainerOffset,
} from './graphCoords'

/** 延迟加载 three / GLTFLoader，仅在渲染 3D 节点时进入产物首屏之外的独立 chunk */
const Model3DNode = defineAsyncComponent(() => import('./nodes/Model3DNode.vue'))
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  createEmptyNodeData,
  KIND_LABEL,
  type CanvasNodeData,
  type NodeKind,
  type NodeMode,
} from './constants'
import { getBaseNodeSize } from './graphNodeSizing'

export { getBaseNodeSize } from './graphNodeSizing'

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
  __requestCanvasUpload?: (nodeId: string) => void
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

/** 按当前数据重新计算并应用节点尺寸（用于历史记录恢复后的尺寸校正） */
export function syncAllNodeSizes(graph: Graph) {
  graph.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    const size = getNodeSize(data.kind, data.mode, data)
    node.resize(size.width, size.height)
  })
}

/** html-shape 节点同步 DOM 位置/矩阵（Safari 首帧、缩放平移、加载后校正） */
export function refreshCanvasNodeViews(graph: Graph) {
  syncHtmlShapeViews(graph)
}

/** 强制重渲染单个 html-shape 节点视图 */
export function refreshCanvasNodeView(graph: Graph, node: Node) {
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
