import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { getScroller } from './graph'

const START_X = 120
const START_Y = 120
const GAP_X = 100
const GAP_Y = 80
const TASK_BLOCK_GAP_Y = 140

type NodeBBox = { x: number; y: number; width: number; height: number }

function collectParentNodeIds(
  graph: Graph,
  node: Node,
  nodeMap: Map<string, Node>,
): string[] {
  const data = node.getData() as CanvasNodeData
  const parents = new Set<string>()

  const sourceId = data.sourceNodeId?.trim()
  if (sourceId && sourceId !== node.id && nodeMap.has(sourceId)) {
    parents.add(sourceId)
  }

  graph.getEdges().forEach((edge) => {
    if (edge.getTargetCellId() !== node.id) return
    const src = edge.getSourceCellId()
    if (src && src !== node.id && nodeMap.has(src)) parents.add(src)
  })

  return [...parents]
}

function pickLeftmostRootId(rootIds: string[], nodeMap: Map<string, Node>): string {
  return rootIds.reduce((best, rootId) => {
    const bestNode = nodeMap.get(best)
    const rootNode = nodeMap.get(rootId)
    if (!bestNode) return rootId
    if (!rootNode) return best

    const bestPos = bestNode.getPosition()
    const rootPos = rootNode.getPosition()
    if (rootPos.x < bestPos.x - 1) return rootId
    if (rootPos.x > bestPos.x + 1) return best
    return rootPos.y < bestPos.y ? rootId : best
  })
}

/** 追溯任务原节点：沿 sourceNodeId 与入边向上，直到无上游 */
function resolveTaskRootId(
  graph: Graph,
  node: Node,
  nodeMap: Map<string, Node>,
): string {
  function walk(current: Node, pathVisited: Set<string>): string {
    if (pathVisited.has(current.id)) return current.id
    pathVisited.add(current.id)

    const parents = collectParentNodeIds(graph, current, nodeMap)
    if (!parents.length) return current.id

    const rootIds = parents.map((parentId) => {
      const parent = nodeMap.get(parentId)
      if (!parent) return current.id
      return walk(parent, new Set(pathVisited))
    })

    return pickLeftmostRootId(rootIds, nodeMap)
  }

  return walk(node, new Set())
}

function resolveNodeClusterKey(
  graph: Graph,
  node: Node,
  nodeMap: Map<string, Node>,
): string {
  const data = node.getData() as CanvasNodeData
  if (data.groupId) return `__group__:${data.groupId}`
  return `__root__:${resolveTaskRootId(graph, node, nodeMap)}`
}

function getNodesBBox(nodes: Node[]): NodeBBox {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach((node) => {
    const { x, y } = node.getPosition()
    const { width, height } = node.getSize()
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  })

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function translateNodes(nodes: Node[], dx: number, dy: number) {
  if (dx === 0 && dy === 0) return
  nodes.forEach((node) => {
    const pos = node.getPosition()
    node.position(pos.x + dx, pos.y + dy)
  })
}

function getClusterAnchor(nodes: Node[]) {
  const bbox = getNodesBBox(nodes)
  return { x: bbox.x, y: bbox.y }
}

function clusterNodesByTaskRoot(graph: Graph, nodes: Node[]): Node[][] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const clusters = new Map<string, Node[]>()

  nodes.forEach((node) => {
    const key = resolveNodeClusterKey(graph, node, nodeMap)
    const bucket = clusters.get(key)
    if (bucket) bucket.push(node)
    else clusters.set(key, [node])
  })

  return [...clusters.values()].sort((a, b) => {
    const anchorA = getClusterAnchor(a)
    const anchorB = getClusterAnchor(b)
    if (Math.abs(anchorA.y - anchorB.y) < 80) return anchorA.x - anchorB.x
    return anchorA.y - anchorB.y
  })
}

function layoutClusterAt(graph: Graph, nodes: Node[], anchorX: number, anchorY: number): NodeBBox {
  tidyNodes(graph, nodes)
  const bbox = getNodesBBox(nodes)
  translateNodes(nodes, anchorX - bbox.x, anchorY - bbox.y)
  return getNodesBBox(nodes)
}

/** 按任务原节点分块整理画布：同一原节点衍生的节点聚为一组，组间留足间距 */
function layoutByTaskBlocks(graph: Graph, nodes: Node[]) {
  const clusters = clusterNodesByTaskRoot(graph, nodes)
  if (clusters.length <= 1) {
    tidyNodes(graph, nodes)
    return
  }

  let blockY = START_Y
  clusters.forEach((clusterNodes) => {
    const bbox = layoutClusterAt(graph, clusterNodes, START_X, blockY)
    blockY += bbox.height + TASK_BLOCK_GAP_Y
  })
}

function layoutGrid(nodes: Node[]) {
  const sorted = [...nodes].sort((a, b) => {
    const pa = a.getPosition()
    const pb = b.getPosition()
    if (Math.abs(pa.y - pb.y) < 48) return pa.x - pb.x
    return pa.y - pb.y
  })

  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)))
  let x = START_X
  let y = START_Y
  let rowMaxH = 0
  let col = 0

  sorted.forEach((node) => {
    const { width, height } = node.getSize()
    if (col >= cols) {
      col = 0
      x = START_X
      y += rowMaxH + GAP_Y
      rowMaxH = 0
    }
    node.position(x, y)
    x += width + GAP_X
    rowMaxH = Math.max(rowMaxH, height)
    col += 1
  })
}

function layoutByEdges(nodes: Node[], edges: ReturnType<Graph['getEdges']>) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const successors = new Map<string, string[]>()

  nodes.forEach((n) => {
    inDegree.set(n.id, 0)
    successors.set(n.id, [])
  })

  edges.forEach((edge) => {
    const src = edge.getSourceCellId()
    const tgt = edge.getTargetCellId()
    if (!src || !tgt || !nodeMap.has(src) || !nodeMap.has(tgt)) return
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1)
    successors.get(src)!.push(tgt)
  })

  let roots = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0)
  if (roots.length === 0) {
    roots = [...nodes].sort((a, b) => a.getPosition().x - b.getPosition().x)
  }

  const layers: string[][] = []
  const placed = new Set<string>()
  let frontier = roots.map((n) => n.id)

  while (frontier.length > 0) {
    const layer = frontier.filter((id) => !placed.has(id))
    if (layer.length === 0) break
    layers.push(layer)
    layer.forEach((id) => placed.add(id))

    const nextIds: string[] = []
    layer.forEach((id) => {
      successors.get(id)?.forEach((tid) => {
        if (!placed.has(tid)) nextIds.push(tid)
      })
    })
    frontier = [...new Set(nextIds)]
  }

  const remaining = nodes.filter((n) => !placed.has(n.id)).map((n) => n.id)
  if (remaining.length > 0) layers.push(remaining)

  let x = START_X
  layers.forEach((layerIds) => {
    const layerNodes = layerIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is Node => Boolean(n))
      .sort((a, b) => a.getPosition().y - b.getPosition().y)

    const maxW = Math.max(...layerNodes.map((n) => n.getSize().width), 0)
    let y = START_Y

    layerNodes.forEach((node) => {
      const { height } = node.getSize()
      node.position(x, y)
      y += height + GAP_Y
    })

    x += maxW + GAP_X
  })
}

/** 整理指定节点：仅处理选中子集内的连线关系 */
export function tidyNodes(graph: Graph, nodes: Node[]) {
  if (nodes.length === 0) return

  const idSet = new Set(nodes.map((node) => node.id))
  const edges = graph.getEdges().filter((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    return Boolean(sourceId && targetId && idSet.has(sourceId) && idSet.has(targetId))
  })

  if (edges.length > 0) {
    layoutByEdges(nodes, edges)
  } else {
    layoutGrid(nodes)
  }
}

export type GroupLayoutDirection = 'grid' | 'horizontal' | 'vertical'

const GROUP_GAP = 24

/** 组内整理：在组锚点处按宫格、水平或垂直方向排列节点 */
export function layoutNodesInGroup(
  nodes: Node[],
  direction: GroupLayoutDirection = 'horizontal',
) {
  if (nodes.length === 0) return

  const sorted = [...nodes].sort((a, b) => {
    const pa = a.getPosition()
    const pb = b.getPosition()
    if (direction === 'horizontal') {
      if (Math.abs(pa.y - pb.y) < 48) return pa.x - pb.x
      return pa.y - pb.y
    }
    if (direction === 'vertical') {
      if (Math.abs(pa.x - pb.x) < 48) return pa.y - pb.y
      return pa.x - pb.x
    }
    if (Math.abs(pa.y - pb.y) < 48) return pa.x - pb.x
    return pa.y - pb.y
  })

  const anchorX = Math.min(...nodes.map((node) => node.getPosition().x))
  const anchorY = Math.min(...nodes.map((node) => node.getPosition().y))

  if (direction === 'grid') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)))
    let x = anchorX
    let y = anchorY
    let rowMaxH = 0
    let col = 0

    sorted.forEach((node) => {
      const { width, height } = node.getSize()
      if (col >= cols) {
        col = 0
        x = anchorX
        y += rowMaxH + GROUP_GAP
        rowMaxH = 0
      }
      node.position(x, y)
      x += width + GROUP_GAP
      rowMaxH = Math.max(rowMaxH, height)
      col += 1
    })
    return
  }

  let x = anchorX
  let y = anchorY

  sorted.forEach((node) => {
    const { width, height } = node.getSize()
    node.position(x, y)
    if (direction === 'horizontal') {
      x += width + GROUP_GAP
    } else {
      y += height + GROUP_GAP
    }
  })
}

/** 整理画布：按任务原节点分块排列，块内按连线关系或网格整理 */
export function tidyCanvas(graph: Graph) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return

  layoutByTaskBlocks(graph, nodes)

  const scroller = getScroller(graph)
  scroller?.resize()
  scroller?.centerContent({ padding: 80 })
}
