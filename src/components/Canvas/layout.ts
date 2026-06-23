import type { Graph, Node } from '@antv/x6'
import { getScroller } from './graph'

const START_X = 120
const START_Y = 120
const GAP_X = 100
const GAP_Y = 80

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

/** 整理画布：按连线关系分层排列，无连线时网格排列 */
export function tidyCanvas(graph: Graph) {
  const nodes = graph.getNodes()
  if (nodes.length === 0) return

  tidyNodes(graph, nodes)

  const scroller = getScroller(graph)
  scroller?.resize()
  scroller?.centerContent({ padding: 80 })
}
