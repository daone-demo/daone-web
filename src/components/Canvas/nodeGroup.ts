import type { Graph, Node } from '@antv/x6'
import { isAiGeneratedCanvasNode, type CanvasNodeData } from './constants'

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

/** 该节点是否衍生出 AI 任务结果节点（出边目标 / sourceNodeId 指向自己的 AI 节点） */
export function hasDerivedAiTaskNodes(graph: Graph, nodeId: string): boolean {
  for (const edge of graph.getEdges()) {
    if (edge.getSourceCellId() !== nodeId) continue
    const targetId = edge.getTargetCellId()
    if (!targetId) continue
    const target = graph.getCellById(targetId)
    if (!target?.isNode()) continue
    if (isAiGeneratedCanvasNode(target.getData() as CanvasNodeData)) return true
  }

  for (const node of graph.getNodes()) {
    if (node.id === nodeId) continue
    const data = node.getData() as CanvasNodeData
    if (data.sourceNodeId !== nodeId) continue
    if (isAiGeneratedCanvasNode(data)) return true
  }

  return false
}

/** 拖出打组区域时是否应保留在组内（AI 节点，或有 AI 衍生节点的源节点） */
export function shouldRetainGroupMembershipOnLeave(graph: Graph, node: Node): boolean {
  const data = node.getData() as CanvasNodeData
  if (isAiGeneratedCanvasNode(data)) return true
  return hasDerivedAiTaskNodes(graph, node.id)
}

/**
 * 组内节点单独拖拽结束后的成员同步：
 * - 仍与其余成员选区相交 → 留在组内
 * - 拖出选区且为 AI / 有 AI 衍生 → 留在组内（组框自动扩大覆盖）
 * - 拖出选区且为无衍生的非 AI 节点 → 移出打组；剩余 ≤1 则解散
 */
function isGroupDerivedNode(data: CanvasNodeData, memberIdSet: Set<string>): boolean {
  if (data.sourceNodeId && memberIdSet.has(data.sourceNodeId)) return true
  return isAiGeneratedCanvasNode(data)
}

/** 组成员衍生的 AI 结果节点（连线或 sourceNodeId，不计入组成员数但参与组框包围） */
export function getDerivedAiNodesForGroup(graph: Graph, groupId: string): Node[] {
  const members = getNodesInGroup(graph, groupId)
  const memberIdSet = new Set(members.map((item) => item.id))
  const derived: Node[] = []
  const seen = new Set<string>()

  members.forEach((member) => {
    graph.getEdges().forEach((edge) => {
      if (edge.getSourceCellId() !== member.id) return
      const targetId = edge.getTargetCellId()
      if (!targetId || seen.has(targetId)) return
      const target = graph.getCellById(targetId)
      if (!target?.isNode()) return
      const data = target.getData() as CanvasNodeData
      if (!isGroupDerivedNode(data, memberIdSet)) return
      seen.add(targetId)
      derived.push(target as Node)
    })
  })

  graph.getNodes().forEach((node) => {
    if (seen.has(node.id) || memberIdSet.has(node.id)) return
    const data = node.getData() as CanvasNodeData
    if (!isGroupDerivedNode(data, memberIdSet)) return
    seen.add(node.id)
    derived.push(node)
  })

  return derived
}

/** 拖拽过程中预览组成员（非 AI 拖出时实时缩小计数与包围盒） */
export function resolveGroupMemberIdsForDragPreview(graph: Graph, draggingNode: Node): string[] {
  const data = draggingNode.getData() as CanvasNodeData
  const groupId = data.groupId
  if (!groupId) return []

  const members = getNodesInGroup(graph, groupId)
  const others = members.filter((item) => item.id !== draggingNode.id)
  if (!others.length) return members.map((item) => item.id)

  const othersBox = getGroupGraphBBox(
    graph,
    others.map((item) => item.id),
  )
  const stillCovered = boxesIntersect(draggingNode.getBBox(), othersBox)
  if (stillCovered || shouldRetainGroupMembershipOnLeave(graph, draggingNode)) {
    return members.map((item) => item.id)
  }

  return others.map((item) => item.id)
}

/** 组框应包围的节点：组成员 + 衍生 AI 节点 */
export function getGroupBoxNodeIds(
  graph: Graph,
  groupId: string,
  draggingMember?: Node | null,
): string[] {
  const memberIds =
    draggingMember && (draggingMember.getData() as CanvasNodeData).groupId === groupId
      ? resolveGroupMemberIdsForDragPreview(graph, draggingMember)
      : getNodesInGroup(graph, groupId).map((item) => item.id)

  const derivedIds = getDerivedAiNodesForGroup(graph, groupId).map((item) => item.id)
  return [...new Set([...memberIds, ...derivedIds])]
}

/** 组标签显示的节点数（仅统计组成员，不含衍生 AI） */
export function getGroupDisplayMemberCount(
  graph: Graph,
  groupId: string,
  draggingMember?: Node | null,
): number {
  if (draggingMember && (draggingMember.getData() as CanvasNodeData).groupId === groupId) {
    return resolveGroupMemberIdsForDragPreview(graph, draggingMember).length
  }
  return getNodesInGroup(graph, groupId).length
}

export function reconcileGroupMembershipAfterNodeMove(graph: Graph, node: Node): {
  removed: boolean
  groupId: string
  remainingIds: string[]
} | null {
  const data = node.getData() as CanvasNodeData
  const groupId = data.groupId
  if (!groupId) return null

  const members = getNodesInGroup(graph, groupId)
  if (members.length < 2) return null

  const others = members.filter((item) => item.id !== node.id)
  if (!others.length) return null

  const othersBox = getGroupGraphBBox(
    graph,
    others.map((item) => item.id),
  )
  const stillCovered = boxesIntersect(node.getBBox(), othersBox)
  if (stillCovered) {
    return {
      removed: false,
      groupId,
      remainingIds: members.map((item) => item.id),
    }
  }

  if (shouldRetainGroupMembershipOnLeave(graph, node)) {
    return {
      removed: false,
      groupId,
      remainingIds: members.map((item) => item.id),
    }
  }

  clearNodeGroupId(node)
  const remaining = getNodesInGroup(graph, groupId)
  if (remaining.length <= 1) {
    clearGroupId(graph, groupId)
    return {
      removed: true,
      groupId,
      remainingIds: [],
    }
  }

  return {
    removed: true,
    groupId,
    remainingIds: remaining.map((item) => item.id),
  }
}
