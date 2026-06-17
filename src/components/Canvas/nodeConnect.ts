import type { Graph, Node } from '@antv/x6'
import { createEmptyNodeData, NODE_SPAWN_GAP_X, NODE_SPAWN_GAP_Y, type CanvasNodeData, type ConnectMenuKey, type NodeKind } from './constants'
import {
  connectGenEdge,
  spawnImageGenNode,
  spawnImageGenNodeAtPoint,
  spawnText2ImgNode,
} from './imageGen'
import { addCanvasNode, getNodeSize, graphLocalToContainerOffset } from './graph'

export const CONNECT_MENU_WIDTH = 200
export const CONNECT_MENU_HEIGHT = 360

export function canOpenConnectMenu(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (data.imageGenTask === 'img2img' || data.imageGenTask === 'hd') return true
  if (data.imageGenTask === 'picker') return true
  if (data.kind === 'image' && !data.imageGenTask) return true
  if (data.kind === 'video' || data.kind === 'text' || data.kind === 'audio') return true
  return false
}

/** @deprecated 使用操作组选择后创建 */
export function canSpawnFromPlus(node: Node) {
  return canOpenConnectMenu(node)
}

export function getConnectPreviewStroke(node: Node) {
  return canOpenConnectMenu(node) ? '#6b7cff' : null
}

/** 图片占位/生成类节点可作为入连线目标，接收上游节点图片作为输入源 */
export function canImageNodeAcceptIncoming(data: CanvasNodeData) {
  if (data.kind !== 'image') return false
  if (
    data.imageGenTask === 'picker' ||
    data.imageGenTask === 'img2img' ||
    data.imageGenTask === 'hd'
  ) {
    return true
  }
  return data.mode === 'picker'
}

function buildSourceRef(sourceNode: Node, sourceData: CanvasNodeData): Partial<CanvasNodeData> {
  return {
    sourceNodeId: sourceNode.id,
    sourcePreviewUrl: sourceData.previewUrl ?? '',
    sourceFileName: sourceData.fileName ?? '',
    inputUpdated: Boolean(sourceData.previewUrl),
  }
}

function spawnLinkedNode(
  graph: Graph,
  sourceNode: Node,
  point: { x: number; y: number },
  kind: NodeKind,
  overrides: Partial<CanvasNodeData> = {},
) {
  const sourceData = sourceNode.getData() as CanvasNodeData
  const node = addCanvasNode(graph, kind, point, {
    ...buildSourceRef(sourceNode, sourceData),
    ...overrides,
  })
  connectGenEdge(graph, sourceNode.id, node.id)
  return node
}

export function createNodeFromConnectMenu(
  graph: Graph,
  sourceNode: Node,
  point: { x: number; y: number },
  menuKey: ConnectMenuKey,
) {
  const sourceData = sourceNode.getData() as CanvasNodeData

  switch (menuKey) {
    case 'text': {
      const overrides: Partial<CanvasNodeData> = { mode: 'picker' }
      // 由图片节点连线生成的文本节点 → 图生提示词模式，提示栏展示来源图片
      if (sourceData.kind === 'image' && sourceData.previewUrl) {
        overrides.textPickerTask = 'img2prompt'
        overrides.textGenState = 'idle'
      }
      return spawnLinkedNode(graph, sourceNode, point, 'text', overrides)
    }
    case 'image':
      if (sourceData.kind === 'image' && !sourceData.imageGenTask) {
        return spawnImageGenNodeAtPoint(graph, sourceNode, point)
      }
      return spawnText2ImgNode(graph, sourceNode, point)
    case 'video':
      return spawnLinkedNode(graph, sourceNode, point, 'video', { mode: 'picker' })
    case 'compose':
      return spawnLinkedNode(graph, sourceNode, point, 'video', {
        mode: 'picker',
        title: '视频合成',
      })
    case 'director':
      return spawnLinkedNode(graph, sourceNode, point, 'text', {
        mode: 'picker',
        title: '导演台',
      })
    case 'audio':
      return spawnLinkedNode(graph, sourceNode, point, 'audio', { mode: 'picker' })
    case 'script':
      return spawnLinkedNode(graph, sourceNode, point, 'text', {
        mode: 'picker',
        title: '脚本',
      })
    case 'reference':
      return null
    default:
      return null
  }
}

/** 在源节点右侧/下方生成目标节点时的中心坐标（间距为边到边） */
export function getAdjacentSpawnPoint(
  sourceNode: Node,
  targetSize: { width: number; height: number },
  direction: 'right' | 'bottom' = 'right',
) {
  const bbox = sourceNode.getBBox()
  if (direction === 'bottom') {
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height + NODE_SPAWN_GAP_Y + targetSize.height / 2,
    }
  }
  return {
    x: bbox.x + bbox.width + NODE_SPAWN_GAP_X + targetSize.width / 2,
    y: bbox.y + bbox.height / 2,
  }
}

export function getLinkedSpawnPoint(
  sourceNode: Node,
  targetKind: NodeKind,
  overrides: Partial<CanvasNodeData> = {},
) {
  const data = { ...createEmptyNodeData(), kind: targetKind, ...overrides }
  const size = getNodeSize(targetKind, data.mode, data)
  return getAdjacentSpawnPoint(sourceNode, size)
}

/** 点击节点 + 时，在默认位置打开菜单（与拖线落点菜单一致） */
export function getDefaultConnectPoint(sourceNode: Node) {
  return getLinkedSpawnPoint(sourceNode, 'video', { mode: 'picker' })
}

export function getConnectSourceAnchor(sourceNode: Node) {
  const bbox = sourceNode.getBBox()
  return {
    x: bbox.x + bbox.width,
    y: bbox.y + bbox.height / 2,
  }
}

function getConnectSpawnConfig(
  sourceNode: Node,
  menuKey: ConnectMenuKey,
): { kind: NodeKind; overrides: Partial<CanvasNodeData> } | null {
  const sourceData = sourceNode.getData() as CanvasNodeData

  switch (menuKey) {
    case 'text':
      return { kind: 'text', overrides: { mode: 'picker' } }
    case 'image':
      if (sourceData.kind === 'image' && !sourceData.imageGenTask) {
        return {
          kind: 'image',
          overrides: { mode: 'picker', imageGenTask: 'picker' },
        }
      }
      return {
        kind: 'image',
        overrides: { mode: 'editor', imageGenTask: 'picker', imageGenState: 'idle' },
      }
    case 'video':
      return { kind: 'video', overrides: { mode: 'picker' } }
    case 'compose':
      return { kind: 'video', overrides: { mode: 'picker', title: '视频合成' } }
    case 'director':
      return { kind: 'text', overrides: { mode: 'picker', title: '导演台' } }
    case 'audio':
      return { kind: 'audio', overrides: { mode: 'picker' } }
    case 'script':
      return { kind: 'text', overrides: { mode: 'picker', title: '脚本' } }
    case 'reference':
      return null
    default:
      return null
  }
}

/** 新节点中心对齐操作菜单左上角（与预览连线落点一致） */
export function resolveConnectSpawnPoint(
  graph: Graph,
  container: HTMLElement,
  sourceNode: Node,
  menuPos: { left: number; top: number },
  menuKey: ConnectMenuKey,
) {
  const config = getConnectSpawnConfig(sourceNode, menuKey)
  if (!config) return null

  const data = { ...createEmptyNodeData(), kind: config.kind, ...config.overrides }
  const size = getNodeSize(config.kind, data.mode, data)
  const rect = container.getBoundingClientRect()
  const topLeft = graph.clientToLocal(
    rect.left + menuPos.left,
    rect.top + menuPos.top,
  )

  return {
    x: topLeft.x + size.width / 2,
    y: topLeft.y + size.height / 2,
  }
}

/** 引用节点生成菜单：左上角对齐松手落点（连线接到菜单左上角） */
export function getConnectMenuPosition(
  graph: Graph,
  _sourceNode: Node,
  container: HTMLElement,
  releasePoint: { x: number; y: number },
) {
  const offset = graphLocalToContainerOffset(
    graph,
    releasePoint.x,
    releasePoint.y,
    container,
  )
  const rect = container.getBoundingClientRect()

  return {
    left: Math.max(
      12,
      Math.min(offset.left, rect.width - CONNECT_MENU_WIDTH - 12),
    ),
    top: Math.max(
      60,
      Math.min(offset.top, rect.height - CONNECT_MENU_HEIGHT - 12),
    ),
  }
}

/** 清理源节点上未连接到目标的预览连线，保证同时只有一条 */
export function removeSourcePreviewEdges(graph: Graph, sourceId: string, keepEdgeId?: string) {
  graph.getEdges().forEach((edge) => {
    if (edge.id === keepEdgeId) return
    if (edge.getSourceCellId() !== sourceId) return
    const target = edge.getTarget()
    if (target && typeof target === 'object' && 'cell' in target && target.cell) return
    graph.removeEdge(edge.id)
  })
}

export function handlePlusConnect(graph: Graph, sourceNode: Node) {
  if (!canOpenConnectMenu(sourceNode)) return null
  const sourceData = sourceNode.getData() as CanvasNodeData
  if (sourceData.kind === 'image' && !sourceData.imageGenTask) {
    return spawnImageGenNode(graph, sourceNode, 'picker')
  }
  if (sourceData.kind === 'video' && sourceData.mode === 'editor') {
    return spawnLinkedNode(graph, sourceNode, getDefaultConnectPoint(sourceNode), 'video', {
      mode: 'picker',
    })
  }
  return null
}
