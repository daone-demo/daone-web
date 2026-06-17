import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'

export const GROUP_BOX_PADDING = 20

export interface GroupSelection {
  groupId: string
  nodeIds: string[]
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
    const data = node.getData() as CanvasNodeData
    node.setData({ ...data, groupId })
  })
  return groupId
}

export function clearGroupId(graph: Graph, groupId: string) {
  getNodesInGroup(graph, groupId).forEach((node) => {
    const data = node.getData() as CanvasNodeData
    if (!data.groupId) return
    const { groupId: _removed, ...rest } = data
    node.setData(rest as CanvasNodeData, { overwrite: true })
  })
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
