import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'

export const GROUP_BOX_PADDING = 20
export const GROUP_BOX_MIN_SIZE = 48

export type GroupResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface GroupSelection {
  groupId: string
  nodeIds: string[]
}

export interface GroupGraphBox {
  x: number
  y: number
  width: number
  height: number
}

export interface GroupScreenBox {
  left: number
  top: number
  width: number
  height: number
  labelLeft: number
  labelTop: number
}

function createGroupId() {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function clearNodeGroupId(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (!data.groupId) return
  const { groupId: _removed, ...rest } = data
  node.setData(rest as CanvasNodeData, { overwrite: true })
}

function setNodeGroupId(node: Node, groupId: string) {
  const data = node.getData() as CanvasNodeData
  if (data.groupId === groupId) return
  node.setData({ ...data, groupId })
}

function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function getNodesInGroup(graph: Graph, groupId: string): Node[] {
  return graph
    .getNodes()
    .filter((node) => (node.getData() as CanvasNodeData).groupId === groupId)
}

export function assignGroupId(graph: Graph, nodeIds: string[]): string | null {
  const nodes = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())

  if (nodes.length < 2) return null

  const groupId = createGroupId()
  nodes.forEach((node) => {
    setNodeGroupId(node, groupId)
  })
  return groupId
}

export function clearGroupId(graph: Graph, groupId: string) {
  getNodesInGroup(graph, groupId).forEach((node) => {
    clearNodeGroupId(node)
  })
}

export function getGroupSelectionForNodeIds(
  graph: Graph,
  selectedIds: string[],
): GroupSelection | null {
  if (!selectedIds.length) return null

  const complete = getCompleteGroupSelection(graph, selectedIds)
  if (complete) return complete

  for (const id of selectedIds) {
    const node = graph.getCellById(id)
    if (!node?.isNode()) continue
    const groupId = (node.getData() as CanvasNodeData).groupId
    if (!groupId) continue
    const members = getNodesInGroup(graph, groupId)
    if (members.length < 2) continue
    return { groupId, nodeIds: members.map((item) => item.id) }
  }

  return null
}

/** 列出画布上所有有效分组（成员 ≥ 2） */
export function listCanvasGroups(graph: Graph): GroupSelection[] {
  const seen = new Set<string>()
  const groups: GroupSelection[] = []

  graph.getNodes().forEach((node) => {
    const groupId = (node.getData() as CanvasNodeData).groupId
    if (!groupId || seen.has(groupId)) return
    seen.add(groupId)
    const members = getNodesInGroup(graph, groupId)
    if (members.length < 2) return
    groups.push({ groupId, nodeIds: members.map((item) => item.id) })
  })

  return groups
}

export function findNodesIntersectingBox(graph: Graph, box: GroupGraphBox): Node[] {
  if (box.width <= 0 || box.height <= 0) return []
  return graph.getNodes().filter((node) => boxesIntersect(node.getBBox(), box))
}

export function resizeGroupGraphBox(
  start: GroupGraphBox,
  handle: GroupResizeHandle,
  dx: number,
  dy: number,
): GroupGraphBox {
  let { x, y, width, height } = start
  const min = GROUP_BOX_MIN_SIZE

  if (handle.includes('w')) {
    const nextX = Math.min(x + dx, x + width - min)
    width = width + (x - nextX)
    x = nextX
  }
  if (handle.includes('e')) {
    width = Math.max(min, width + dx)
  }
  if (handle.includes('n')) {
    const nextY = Math.min(y + dy, y + height - min)
    height = height + (y - nextY)
    y = nextY
  }
  if (handle.includes('s')) {
    height = Math.max(min, height + dy)
  }

  return { x, y, width, height }
}

/** 按选区覆盖同步组成员：框内节点加入，框外成员移出；不足 2 个时解散 */
export function syncGroupBySelectionBox(
  graph: Graph,
  groupId: string,
  box: GroupGraphBox,
): string[] {
  const covered = findNodesIntersectingBox(graph, box)
  const coveredIds = new Set(covered.map((node) => node.id))
  const previous = getNodesInGroup(graph, groupId)

  previous.forEach((node) => {
    if (!coveredIds.has(node.id)) clearNodeGroupId(node)
  })

  covered.forEach((node) => {
    const data = node.getData() as CanvasNodeData
    if (data.groupId && data.groupId !== groupId) {
      const otherMembers = getNodesInGroup(graph, data.groupId).filter((item) => item.id !== node.id)
      clearNodeGroupId(node)
      if (otherMembers.length <= 1) {
        otherMembers.forEach((item) => clearNodeGroupId(item))
      }
    }
    setNodeGroupId(node, groupId)
  })

  const nextMembers = getNodesInGroup(graph, groupId)
  if (nextMembers.length <= 1) {
    clearGroupId(graph, groupId)
    return nextMembers.map((node) => node.id)
  }

  return nextMembers.map((node) => node.id)
}

export function ungroupSelection(graph: Graph, nodeIds: string[]) {
  const groupIds = new Set<string>()
  nodeIds.forEach((id) => {
    const node = graph.getCellById(id)
    if (!node?.isNode()) return
    const groupId = (node.getData() as CanvasNodeData).groupId
    if (groupId) groupIds.add(groupId)
  })
  groupIds.forEach((groupId) => clearGroupId(graph, groupId))
}

export function mergeStoryboardGroup(graph: Graph, nodeIds: string[]) {
  const ids = nodeIds.filter((id) => {
    const node = graph.getCellById(id)
    return node?.isNode()
  })
  if (ids.length < 2) return null

  const touchedGroupIds = new Set<string>()
  ids.forEach((id) => {
    const node = graph.getCellById(id)
    if (!node?.isNode()) return
    const groupId = (node.getData() as CanvasNodeData).groupId
    if (groupId) touchedGroupIds.add(groupId)
  })
  touchedGroupIds.forEach((groupId) => clearGroupId(graph, groupId))
  return assignGroupId(graph, ids)
}

export function getCompleteGroupSelection(
  graph: Graph,
  selectedIds: string[],
): GroupSelection | null {
  if (selectedIds.length < 2) return null

  const first = graph.getCellById(selectedIds[0])
  if (!first?.isNode()) return null

  const groupId = (first.getData() as CanvasNodeData).groupId
  if (!groupId) return null

  const groupNodeIds = getNodesInGroup(graph, groupId).map((node) => node.id)
  if (groupNodeIds.length < 2) return null

  const selectedSet = new Set(selectedIds)
  if (selectedSet.size !== groupNodeIds.length) return null
  return groupNodeIds.every((id) => selectedSet.has(id))
    ? { groupId, nodeIds: groupNodeIds }
    : null
}

export function expandSelectionToGroup(graph: Graph, nodeIds: string[]): string[] {
  if (nodeIds.length !== 1) return nodeIds

  const node = graph.getCellById(nodeIds[0])
  if (!node?.isNode()) return nodeIds

  const groupId = (node.getData() as CanvasNodeData).groupId
  if (!groupId) return nodeIds

  const members = getNodesInGroup(graph, groupId)
  return members.length >= 2 ? members.map((item) => item.id) : nodeIds
}

export function getGroupGraphBBox(graph: Graph, nodeIds: string[]) {
  const nodes = nodeIds
    .map((id) => graph.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())

  if (!nodes.length) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  nodes.forEach((node) => {
    const bbox = node.getBBox()
    minX = Math.min(minX, bbox.x)
    minY = Math.min(minY, bbox.y)
    maxX = Math.max(maxX, bbox.x + bbox.width)
    maxY = Math.max(maxY, bbox.y + bbox.height)
  })

  return {
    x: minX - GROUP_BOX_PADDING,
    y: minY - GROUP_BOX_PADDING,
    width: maxX - minX + GROUP_BOX_PADDING * 2,
    height: maxY - minY + GROUP_BOX_PADDING * 2,
  }
}

export function normalizeGroupMembership(graph: Graph, removedNodeId: string) {
  const node = graph.getCellById(removedNodeId)
  if (!node?.isNode()) return

  const groupId = (node.getData() as CanvasNodeData).groupId
  if (!groupId) return

  const remaining = getNodesInGroup(graph, groupId).filter((item) => item.id !== removedNodeId)
  if (remaining.length <= 1) {
    clearGroupId(graph, groupId)
  }
}
