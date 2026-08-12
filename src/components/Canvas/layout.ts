import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { getScroller } from './graph'
import { fitStoredGroupSelectionBoxToMembers, listCanvasGroups } from './nodeGroup'

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
    const box = node.getBBox()
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
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
/** 多个源图上下排列时的最小间距（底边到顶边） */
const SOURCE_MIN_GAP_Y = 100

function sortNodesForLayout(nodes: Node[], direction: GroupLayoutDirection): Node[] {
  return [...nodes].sort((a, b) => {
    const pa = a.getBBox()
    const pb = b.getBBox()
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
}

/** 将节点外框左上角对齐到锚点（兼容端口导致的 position/bbox 偏移） */
function placeNodeLayoutBoxAt(node: Node, boxX: number, boxY: number) {
  const box = node.getBBox()
  const pos = node.getPosition()
  node.position(boxX - (box.x - pos.x), boxY - (box.y - pos.y))
}

function placeNodesAtAnchor(
  sorted: Node[],
  direction: GroupLayoutDirection,
  anchorX: number,
  anchorY: number,
) {
  if (direction === 'grid') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)))
    let x = anchorX
    let y = anchorY
    let rowMaxH = 0
    let col = 0

    sorted.forEach((node) => {
      const box = node.getBBox()
      if (col >= cols) {
        col = 0
        x = anchorX
        y += rowMaxH + GROUP_GAP
        rowMaxH = 0
      }
      placeNodeLayoutBoxAt(node, x, y)
      x += box.width + GROUP_GAP
      rowMaxH = Math.max(rowMaxH, box.height)
      col += 1
    })
    return
  }

  let x = anchorX
  let y = anchorY
  sorted.forEach((node) => {
    const box = node.getBBox()
    placeNodeLayoutBoxAt(node, x, y)
    if (direction === 'horizontal') {
      x += box.width + GROUP_GAP
    } else {
      y += box.height + GROUP_GAP
    }
  })
}

function boxesOverlap(a: NodeBBox, b: NodeBBox, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  )
}

/** 布局后消除节点重叠；pinnedIds 中的节点保持不动 */
function resolveOverlapsAmongNodes(
  nodes: Node[],
  options?: { minGap?: number; pinnedIds?: Set<string> },
) {
  if (nodes.length < 2) return

  const minGap = options?.minGap ?? GROUP_GAP
  const pinnedIds = options?.pinnedIds ?? new Set<string>()
  const maxPasses = nodes.length * nodes.length

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let moved = false

    for (let i = 0; i < nodes.length; i += 1) {
      const nodeA = nodes[i]
      const boxA = getNodesBBox([nodeA])

      for (let j = i + 1; j < nodes.length; j += 1) {
        const nodeB = nodes[j]
        const boxB = getNodesBBox([nodeB])
        if (!boxesOverlap(boxA, boxB, minGap)) continue

        const pushDown = boxA.y + boxA.height + minGap - boxB.y
        const pushRight = boxA.x + boxA.width + minGap - boxB.x
        const pushUp = boxB.y + boxB.height + minGap - boxA.y
        const pushLeft = boxB.x + boxB.width + minGap - boxA.x

        const candidates: { node: Node; dx: number; dy: number; cost: number }[] = []

        const addCandidate = (node: Node, dx: number, dy: number) => {
          if (dx === 0 && dy === 0) return
          candidates.push({ node, dx, dy, cost: Math.abs(dx) + Math.abs(dy) })
        }

        if (!pinnedIds.has(nodeB.id)) {
          if (pushDown > 0) addCandidate(nodeB, 0, pushDown)
          if (pushRight > 0) addCandidate(nodeB, pushRight, 0)
          if (pushUp > 0) addCandidate(nodeB, 0, -pushUp)
          if (pushLeft > 0) addCandidate(nodeB, -pushLeft, 0)
        }
        if (!pinnedIds.has(nodeA.id)) {
          if (pushDown > 0) addCandidate(nodeA, 0, -pushDown)
          if (pushRight > 0) addCandidate(nodeA, -pushRight, 0)
          if (pushUp > 0) addCandidate(nodeA, 0, pushUp)
          if (pushLeft > 0) addCandidate(nodeA, pushLeft, 0)
        }

        if (!candidates.length) continue

        const best = candidates.reduce((pick, item) => (item.cost < pick.cost ? item : pick))
        translateNodes([best.node], best.dx, best.dy)
        moved = true
        break
      }
      if (moved) break
    }

    if (!moved) break
  }
}

function measureBlocksRightEdge(sources: Node[], clusters: Map<string, Node[]>): number {
  let maxRight = 0
  sources.forEach((source) => {
    const block = [source, ...(clusters.get(source.id) ?? [])]
    const bbox = getNodesBBox(block)
    maxRight = Math.max(maxRight, bbox.x + bbox.width)
  })
  return maxRight
}

/** 沿 sourceNodeId / 入边向上，找到选中集合中的源图根节点 */
function resolveSourceImageId(
  nodeId: string,
  sourceIds: Set<string>,
  nodeMap: Map<string, Node>,
  graph: Graph | undefined,
): string | null {
  const visited = new Set<string>()

  function walk(currentId: string): string | null {
    if (visited.has(currentId)) return null
    visited.add(currentId)
    if (sourceIds.has(currentId)) return currentId

    const current = nodeMap.get(currentId)
    if (current) {
      const sid = String((current.getData() as CanvasNodeData).sourceNodeId ?? '').trim()
      if (sid) {
        const hit = walk(sid)
        if (hit) return hit
      }
    }

    if (!graph) return null
    for (const edge of graph.getEdges()) {
      if (edge.getTargetCellId() !== currentId) continue
      const src = edge.getSourceCellId()
      if (!src) continue
      const hit = walk(src)
      if (hit) return hit
    }
    return null
  }

  return walk(nodeId)
}

/**
 * 选中集合内的源图：图片根节点（选中范围内无入边 / sourceNodeId），
 * 且至少带有一个选中的下游节点。不依赖是否 AI 生成。
 */
function findSourceImageRoots(nodes: Node[], graph: Graph | undefined): Node[] {
  if (nodes.length < 2) return []

  const idSet = new Set(nodes.map((node) => node.id))
  const hasIncoming = new Set<string>()

  nodes.forEach((node) => {
    const sid = String((node.getData() as CanvasNodeData).sourceNodeId ?? '').trim()
    if (sid && idSet.has(sid)) hasIncoming.add(node.id)
  })

  if (graph) {
    graph.getEdges().forEach((edge) => {
      const src = edge.getSourceCellId()
      const tgt = edge.getTargetCellId()
      if (!src || !tgt || !idSet.has(src) || !idSet.has(tgt)) return
      hasIncoming.add(tgt)
    })
  }

  const roots = nodes.filter((node) => {
    if (hasIncoming.has(node.id)) return false
    return (node.getData() as CanvasNodeData).kind === 'image'
  })
  if (!roots.length) return []

  const rootIds = new Set(roots.map((node) => node.id))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const rootsWithChildren = roots.filter((root) =>
    nodes.some((node) => {
      if (rootIds.has(node.id)) return false
      return resolveSourceImageId(node.id, new Set([root.id]), nodeMap, graph) === root.id
    }),
  )

  return rootsWithChildren
}

/** 无源图时：全部节点参与排列（原逻辑） */
function layoutAllNodesInGroup(nodes: Node[], direction: GroupLayoutDirection) {
  const sorted = sortNodesForLayout(nodes, direction)
  const bbox = getNodesBBox(nodes)
  placeNodesAtAnchor(sorted, direction, bbox.x, bbox.y)
  resolveOverlapsAmongNodes(nodes, { minGap: GROUP_GAP })
}

/** 将子节点块垂直居中对齐到源图 */
function alignClusterToSourceCenter(cluster: Node[], source: Node) {
  if (cluster.length === 0) return
  const sourceBox = source.getBBox()
  const clusterBox = getNodesBBox(cluster)
  const dy = sourceBox.y + sourceBox.height / 2 - (clusterBox.y + clusterBox.height / 2)
  if (Math.abs(dy) < 1) return
  translateNodes(cluster, 0, dy)
}

/**
 * 排序时：相邻源图块（源图 + 其下游簇）上下间距不足 100px 则拉开。
 * 下移下方整块，避免仅按源图高度计算导致子节点簇重叠。
 */
function ensureSourceBlocksMinVerticalGap(
  sources: Node[],
  clusters: Map<string, Node[]>,
) {
  if (sources.length < 2) return

  const ordered = [...sources].sort((a, b) => {
    const ay = a.getBBox().y
    const by = b.getBBox().y
    if (Math.abs(ay - by) < 1) return a.getBBox().x - b.getBBox().x
    return ay - by
  })

  for (let i = 1; i < ordered.length; i += 1) {
    const upperBlock = [ordered[i - 1], ...(clusters.get(ordered[i - 1].id) ?? [])]
    const lowerBlock = [ordered[i], ...(clusters.get(ordered[i].id) ?? [])]
    const upperBBox = getNodesBBox(upperBlock)
    const lowerBBox = getNodesBBox(lowerBlock)
    const gap = lowerBBox.y - upperBBox.y - upperBBox.height
    if (gap >= SOURCE_MIN_GAP_Y) continue

    const dy = SOURCE_MIN_GAP_Y - gap
    translateNodes(lowerBlock, 0, dy)
  }
}

/**
 * 有源图时：源图固定；下游节点按源图分簇，排到各自源图右侧并垂直居中
 * （垂直=右侧纵列，水平=右侧横排，宫格=右侧宫格）
 * 多个源图时保证上下间距至少 100px
 */
function layoutNodesBesideSourceImages(
  nodes: Node[],
  sources: Node[],
  direction: GroupLayoutDirection,
  graph: Graph | undefined,
) {
  const sourceIds = new Set(sources.map((node) => node.id))
  const others = nodes.filter((node) => !sourceIds.has(node.id))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const clusters = new Map<string, Node[]>()
  const orphans: Node[] = []

  others.forEach((node) => {
    const sourceId = resolveSourceImageId(node.id, sourceIds, nodeMap, graph)
    if (!sourceId) {
      orphans.push(node)
      return
    }
    const bucket = clusters.get(sourceId)
    if (bucket) bucket.push(node)
    else clusters.set(sourceId, [node])
  })

  sources.forEach((source) => {
    const cluster = clusters.get(source.id)
    if (!cluster?.length) return
    const sorted = sortNodesForLayout(cluster, direction)
    const box = source.getBBox()
    placeNodesAtAnchor(sorted, direction, box.x + box.width + GROUP_GAP, box.y)
    alignClusterToSourceCenter(sorted, source)
    clusters.set(source.id, sorted)
  })

  if (orphans.length) {
    const sorted = sortNodesForLayout(orphans, direction)
    const rightEdge = measureBlocksRightEdge(sources, clusters)
    const anchorY = Math.min(...sources.map((source) => source.getBBox().y))
    placeNodesAtAnchor(sorted, direction, rightEdge + GROUP_GAP, anchorY)
    orphans.splice(0, orphans.length, ...sorted)
  }

  ensureSourceBlocksMinVerticalGap(sources, clusters)
  resolveOverlapsAmongNodes(nodes, {
    minGap: GROUP_GAP,
    pinnedIds: new Set(sources.map((source) => source.id)),
  })
}

/**
 * 组内 / 多选整理：按宫格、水平或垂直排列。
 * - 选中含源图根节点时：源图不参与，其余排到源图右侧（见图示）
 * - 无源图时：全部节点参与，保持原行为
 */
export function layoutNodesInGroup(
  nodes: Node[],
  direction: GroupLayoutDirection = 'horizontal',
) {
  if (nodes.length === 0) return

  const graph = (nodes[0]?.model?.graph ?? undefined) as Graph | undefined
  const sources = findSourceImageRoots(nodes, graph)
  if (sources.length > 0) {
    layoutNodesBesideSourceImages(nodes, sources, direction, graph)
    return
  }

  layoutAllNodesInGroup(nodes, direction)
}

/** 整理画布：按任务原节点分块排列，块内按连线关系或网格整理 */
export function tidyCanvas(graph: Graph) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return

  layoutByTaskBlocks(graph, nodes)

  // 节点位置已变，组框按成员包围盒自适应，避免组内节点溢出到打组框外
  listCanvasGroups(graph).forEach((group) => {
    fitStoredGroupSelectionBoxToMembers(graph, group.groupId)
  })

  const scroller = getScroller(graph)
  scroller?.resize()
  scroller?.centerContent({ padding: 80 })
}
