import type { Graph, Node } from '@antv/x6'
import { isAiGeneratedCanvasNode, type CanvasNodeData } from './constants'
import { isGridSplitDerivedImageData } from './gridSplitUtils'
import { isCropDerivedImageData } from './imageGen'

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
  if (!data.groupId && !data.groupSelectionBox && !data.groupTitle) return
  const { groupId: _removed, groupSelectionBox: _box, groupTitle: _title, ...rest } = data
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

function boxIntersectionArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x
  const height = Math.min(a.y + a.height, b.y + b.height) - y
  if (width <= 0 || height <= 0) return 0
  return width * height
}

function detachNodeFromGroup(graph: Graph, node: Node) {
  const data = node.getData() as CanvasNodeData
  const groupId = data.groupId
  if (!groupId) return

  clearNodeGroupId(node)
  const remaining = getNodesInGroup(graph, groupId)
  if (remaining.length <= 1) {
    clearGroupId(graph, groupId)
  }
}

export function getNodesInGroup(graph: Graph, groupId: string): Node[] {
  return graph
    .getNodes()
    .filter((node) => (node.getData() as CanvasNodeData).groupId === groupId)
}

/**
 * 组内源图：图片节点且在组内无来自同组成员的入边 / sourceNodeId。
 * 用于控制打组后仅源图可重新上传。
 */
export function isGroupSourceImageNode(graph: Graph, node: Node): boolean {
  const data = node.getData() as CanvasNodeData
  const groupId = String(data.groupId ?? '').trim()
  if (!groupId || data.kind !== 'image') return false
  if (isGridSplitDerivedImageData(data)) return false
  if (isCropDerivedImageData(data)) return false
  if (isAiGeneratedCanvasNode(data)) return false

  const memberIds = new Set(getNodesInGroup(graph, groupId).map((member) => member.id))
  if (!memberIds.has(node.id)) return false

  const sourceNodeId = String(data.sourceNodeId ?? '').trim()
  if (sourceNodeId) return false

  for (const edge of graph.getEdges()) {
    if (edge.getTargetCellId() !== node.id) continue
    const src = edge.getSourceCellId()
    if (src && memberIds.has(src)) return false
  }

  return true
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
  minBox?: GroupGraphBox,
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

  const resized = { x, y, width, height }
  if (!minBox) return resized
  return clampGroupGraphBoxToContain(resized, minBox)
}

/** 组框至少需完整包含成员占位（含 padding） */
export function clampGroupGraphBoxToContain(box: GroupGraphBox, minBox: GroupGraphBox): GroupGraphBox {
  let { x, y, width, height } = box
  const minRight = minBox.x + minBox.width
  const minBottom = minBox.y + minBox.height

  if (x > minBox.x) {
    width += x - minBox.x
    x = minBox.x
  }
  if (y > minBox.y) {
    height += y - minBox.y
    y = minBox.y
  }
  if (x + width < minRight) {
    width = minRight - x
  }
  if (y + height < minBottom) {
    height = minBottom - y
  }

  width = Math.max(width, GROUP_BOX_MIN_SIZE, minBox.width)
  height = Math.max(height, GROUP_BOX_MIN_SIZE, minBox.height)

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

export function getStoredGroupSelectionBox(graph: Graph, groupId: string): GroupGraphBox | null {
  for (const member of getNodesInGroup(graph, groupId)) {
    const box = (member.getData() as CanvasNodeData).groupSelectionBox
    if (box && box.width > 0 && box.height > 0) return { ...box }
  }
  return null
}

export function setStoredGroupSelectionBox(graph: Graph, groupId: string, box: GroupGraphBox) {
  const snapshot = { ...box }
  getNodesInGroup(graph, groupId).forEach((node) => {
    const data = node.getData() as CanvasNodeData
    node.setData({ ...data, groupSelectionBox: snapshot })
  })
}

/** 组内排列后：将组框收紧为刚好包含全部成员（含 padding） */
export function fitStoredGroupSelectionBoxToMembers(graph: Graph, groupId: string) {
  const memberIds = getNodesInGroup(graph, groupId).map((node) => node.id)
  if (memberIds.length < 2) return
  setStoredGroupSelectionBox(graph, groupId, getGroupGraphBBox(graph, memberIds))
}

/** 组框：有手动保存的选区时以选区为准，否则按成员占位自适应 */
export function resolveGroupGraphBBox(graph: Graph, groupId: string, nodeIds: string[]): GroupGraphBox {
  const stored = getStoredGroupSelectionBox(graph, groupId)
  if (stored) return stored
  return getGroupGraphBBox(graph, nodeIds)
}

/** 调整组框后仅保存范围，不改变组成员；最小范围需包含全部成员 */
export function applyGroupSelectionBoxResize(
  graph: Graph,
  groupId: string,
  box: GroupGraphBox,
): string[] {
  const memberIds = getNodesInGroup(graph, groupId).map((node) => node.id)
  const minBox = getGroupGraphBBox(graph, memberIds)
  setStoredGroupSelectionBox(graph, groupId, clampGroupGraphBoxToContain(box, minBox))
  return memberIds
}

export function getGroupTitle(graph: Graph, groupId: string): string {
  for (const member of getNodesInGroup(graph, groupId)) {
    const title = (member.getData() as CanvasNodeData).groupTitle?.trim()
    if (title) return title
  }
  return ''
}

export function setGroupTitle(graph: Graph, groupId: string, title: string) {
  const trimmed = title.trim()
  getNodesInGroup(graph, groupId).forEach((node) => {
    const data = node.getData() as CanvasNodeData
    if (!trimmed) {
      const { groupTitle: _removed, ...rest } = data
      node.setData(rest as CanvasNodeData, { overwrite: true })
      return
    }
    node.setData({ ...data, groupTitle: trimmed })
  })
}

export function resolveGroupDisplayTitle(graph: Graph, groupId: string, nodeCount: number): string {
  const custom = getGroupTitle(graph, groupId)
  if (custom) return custom
  return `分组 ${nodeCount} 个节点`
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

/** 拖拽过程中预览组成员（非 AI 拖出时实时缩小计数与包围盒） */
export function resolveGroupMemberIdsForDragPreview(graph: Graph, draggingNode: Node): string[] {
  const data = draggingNode.getData() as CanvasNodeData
  const groupId = data.groupId
  if (!groupId) return []

  const members = getNodesInGroup(graph, groupId)
  const others = members.filter((item) => item.id !== draggingNode.id)
  if (!others.length) return members.map((item) => item.id)

  const groupFrame = resolveGroupGraphBBox(
    graph,
    groupId,
    others.map((item) => item.id),
  )
  const stillCovered = boxesIntersect(draggingNode.getBBox(), groupFrame)
  if (stillCovered) {
    return members.map((item) => item.id)
  }

  return others.map((item) => item.id)
}

/**
 * 组内节点单独拖拽结束后的成员同步：
 * - 仍在组选区（其余成员占位 + 已保存选区）内 → 留在组内
 * - 拖出选区 → 移出打组；剩余 ≤1 则解散
 */

/** 组框应包围的节点：仅包含实际打组成员 */
export function getGroupBoxNodeIds(
  graph: Graph,
  groupId: string,
  draggingMember?: Node | null,
): string[] {
  if (draggingMember && (draggingMember.getData() as CanvasNodeData).groupId === groupId) {
    return resolveGroupMemberIdsForDragPreview(graph, draggingMember)
  }
  return getNodesInGroup(graph, groupId).map((item) => item.id)
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

/**
 * 节点拖拽结束后，若落入某个打组选区则编入该组。
 * 已在目标组内、或未与任何组框相交时不做变更。
 */
export function tryAdoptNodeIntoIntersectingGroup(graph: Graph, node: Node): {
  added: boolean
  groupId: string
  memberIds: string[]
} | null {
  const nodeBox = node.getBBox()
  const data = node.getData() as CanvasNodeData

  const candidates = listCanvasGroups(graph)
    .map(({ groupId, nodeIds }) => ({
      groupId,
      box: resolveGroupGraphBBox(graph, groupId, nodeIds),
    }))
    .filter(({ box }) => boxesIntersect(nodeBox, box))

  if (!candidates.length) return null
  if (data.groupId && candidates.some((item) => item.groupId === data.groupId)) return null

  const target = candidates
    .slice()
    .sort((a, b) => boxIntersectionArea(nodeBox, b.box) - boxIntersectionArea(nodeBox, a.box))[0]

  detachNodeFromGroup(graph, node)
  setNodeGroupId(node, target.groupId)

  const memberIds = getNodesInGroup(graph, target.groupId).map((item) => item.id)
  return {
    added: true,
    groupId: target.groupId,
    memberIds,
  }
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

  const groupFrame = resolveGroupGraphBBox(
    graph,
    groupId,
    others.map((item) => item.id),
  )
  const stillCovered = boxesIntersect(node.getBBox(), groupFrame)
  if (stillCovered) {
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
