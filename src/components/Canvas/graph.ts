import { Graph, Shape, type Node, type TransformManager } from '@antv/x6'
import { Scroller } from '@antv/x6-plugin-scroller'
import '@antv/x6-plugin-scroller/es/index.css'
import { Selection } from '@antv/x6-plugin-selection'
import '@antv/x6-plugin-selection/es/index.css'
import { register } from '@antv/x6-vue-shape'
import { getDefaultEdgeStroke } from './canvasTheme'
import { bindFlowEdgeInteraction, FLOW_EDGE_COLOR, getFlowEdgeAttrs } from './edgeStyle'
import { canOpenConnectMenu } from './nodeConnect'
import '@antv/x6-vue-shape'
import TextNode from './nodes/TextNode.vue'
import ImageNode from './nodes/ImageNode.vue'
import ImageGenNode from './nodes/ImageGenNode.vue'
import VideoNode from './nodes/VideoNode.vue'
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  createEmptyNodeData,
  IMAGE_NODE_META_HEIGHT,
  PROMPT_BAR_TOP_GAP,
  VIDEO_GEN_PROMPT_TOP_GAP,
  KIND_LABEL,
  NODE_SIZE,
  type CanvasNodeData,
  type NodeKind,
  type NodeMode,
  isPortrait,
} from './constants'

type ScrollerImplLike = {
  localToBackgroundPoint(x: number, y: number): { x: number; y: number }
  clientToLocalPoint(x: number, y: number): { x: number; y: number }
  container: HTMLDivElement
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
 */
export function graphLocalToContainerOffset(
  graph: Graph,
  localX: number,
  localY: number,
  container: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect()
  const scroller = getScroller(graph)
  const scrollerImpl = scroller
    ? (scroller as unknown as { scrollerImpl?: ScrollerImplLike }).scrollerImpl
    : undefined

  if (scroller && scrollerImpl) {
    const bg = scrollerImpl.localToBackgroundPoint(localX, localY)
    const scrollEl = scroller.container
    const scrollRect = scrollEl.getBoundingClientRect()
    return {
      left: bg.x - scrollEl.scrollLeft + (scrollRect.left - containerRect.left),
      top: bg.y - scrollEl.scrollTop + (scrollRect.top - containerRect.top),
    }
  }

  const client = graph.localToClient(localX, localY)
  return {
    left: client.x - containerRect.left,
    top: client.y - containerRect.top,
  }
}

/** 节点在容器坐标系下的屏幕包围盒（缩放后真实像素） */
function getNodeScreenBox(graph: Graph, node: Node, container: HTMLElement) {
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
  __deleteCanvasNode?: (nodeId: string) => void
  __textEditorRegistry?: TextEditorRegistry
  __requestTextExpand?: (nodeId: string) => void
  __onTextPickerAction?: (key: string, nodeId: string) => void
  __onTextNodeEdgeLinked?: (textNodeId: string) => void
  __onNodeEdgeLinked?: (targetNodeId: string, sourceNodeId?: string) => void
  __notifyTextNodeUpdated?: () => void
  __notifyNodeDragMove?: () => void
  __notifyNodeDragEnd?: () => void
  __suppressBlankCloseForConnect?: boolean
  __connectPreviewEdgeId?: string
}

let shapesRegistered = false

const counters: Record<NodeKind, number> = {
  text: 0,
  image: 0,
  video: 0,
  audio: 0,
}

export function registerShapes() {
  if (shapesRegistered) return
  shapesRegistered = true

  register({ shape: 'text-node', width: 180, height: 270, component: TextNode })
  register({ shape: 'image-node', width: 180, height: 270, component: ImageNode })
  register({ shape: 'image-gen-node', width: 180, height: 270, component: ImageGenNode })
  register({ shape: 'video-node', width: 180, height: 270, component: VideoNode })
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
  if (kind === 'image' && data?.imageGenTask) return 'image-gen-node'
  return 'image-node'
}

export function getBaseNodeSize(
  kind: NodeKind,
  mode: NodeMode = 'picker',
  data?: Partial<CanvasNodeData>,
) {
  const w = data?.mediaWidth ?? 0
  const h = data?.mediaHeight ?? 0

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
    if (mode === 'picker' || !data?.previewUrl) return NODE_SIZE.video.picker
    return NODE_SIZE.video.media
  }
  if (kind === 'image') {
    if (data?.imageGenTask === 'picker') return NODE_SIZE.image.genPicker
    if (data?.imageGenTask === 'img2img') return NODE_SIZE.image.img2img
    if (data?.imageGenTask === 'hd') return NODE_SIZE.image.hd
    if (w && h && isPortrait(w, h)) return NODE_SIZE.image.portrait
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
  if (scale === 1) return base

  return {
    width: Math.max(120, Math.round(base.width * scale)),
    height: Math.max(120, Math.round(base.height * scale)),
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
    background: { color: '#141416' },
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
      connector: { name: 'smooth' },
      connectionPoint: 'boundary',
      router: { name: 'normal' },
      createEdge(this: Graph, args) {
        const source = args?.sourceCell
        const useFlow =
          source?.isNode() && canOpenConnectMenu(source)
        const stroke = useFlow ? FLOW_EDGE_COLOR : getDefaultEdgeStroke()

        return new Shape.Edge({
          attrs: useFlow ? getFlowEdgeAttrs(stroke) : {
            line: {
              stroke,
              strokeWidth: 2,
              targetMarker: { name: 'block', width: 10, height: 8 },
            },
          },
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
) {
  const data = { ...createDefaultNodeData(kind), ...overrides }
  const size = getNodeSize(kind, data.mode, data)
  const shape = getNodeShape(kind, data)

  return graph.addNode({
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
    syncNodeShapeFromData(node)
    const size = getNodeSize(data.kind, data.mode, data)
    node.resize(size.width, size.height)
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
    data.previewUrl
  ) {
    return bbox.y + IMAGE_NODE_META_HEIGHT
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

  const topLeft = graphLocalToContainerOffset(graph, minX - padding, minY - padding, container)
  const bottomRight = graphLocalToContainerOffset(graph, maxX + padding, maxY + padding, container)

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

export function getNodeToolbarPosition(graph: Graph, node: Node, container: HTMLElement) {
  const bbox = node.getBBox()
  const box = getNodeScreenBox(graph, node, container)
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
  const box = getNodeScreenBox(graph, node, container)
  const anchorOffset = graphLocalToContainerOffset(
    graph,
    bbox.x + bbox.width / 2,
    bbox.y,
    container,
  )

  return {
    left: box.centerX,
    top: anchorOffset.top - 10,
    width: Math.max(box.width, 638),
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
  const box = getNodeScreenBox(graph, node, container)

  return {
    left: box.centerX,
    top: box.bottom + 12,
    width: Math.max(box.width, 638),
  }
}

/** 文本/音频 picker 底部输入框：锚定在节点正下方水平居中 */
export function getNodePromptPosition(graph: Graph, node: Node, container: HTMLElement) {
  const box = getNodeScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(560, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + PROMPT_BAR_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 638)),
  }
}

/** 图生图底部对话框：相对节点水平居中，略宽于节点 */
export function getNodeImageGenPromptPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
) {
  const box = getNodeScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(720, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + PROMPT_BAR_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 638)),
  }
}

/** 文生视频底部面板：间距较图生图/文本提示栏更紧凑 */
export function getNodeVideoGenPromptPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
) {
  const box = getNodeScreenBox(graph, node, container)
  const containerRect = container.getBoundingClientRect()
  const maxWidth = Math.min(720, containerRect.width - 48)

  return {
    left: box.centerX,
    top: box.bottom + VIDEO_GEN_PROMPT_TOP_GAP,
    width: Math.min(maxWidth, Math.max(box.width, 638)),
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

export function getNodeCropOverlayPosition(
  graph: Graph,
  node: Node,
  container: HTMLElement,
  minWidth = 520,
  minHeight = 420,
) {
  const box = getNodeScreenBox(graph, node, container)
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

type VueShapeViewLike = {
  renderVueComponent?: () => void
}

/** 按当前数据重新计算并应用节点尺寸（用于历史记录恢复后的尺寸校正） */
export function syncAllNodeSizes(graph: Graph) {
  graph.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    const size = getNodeSize(data.kind, data.mode, data)
    node.resize(size.width, size.height)
  })
}

/** vue-shape 节点在独立 Vue 实例中，主题切换后强制重渲染 */
export function refreshCanvasNodeViews(graph: Graph) {
  graph.getNodes().forEach((node) => {
    const view = graph.findViewByCell(node) as VueShapeViewLike | null
    view?.renderVueComponent?.()
  })
}
