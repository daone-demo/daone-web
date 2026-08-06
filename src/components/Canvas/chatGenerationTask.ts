import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { connectGenEdge } from './imageGen'
import {
  bindGenerationTaskId,
  findNodeByGenerationTaskId,
  followModelGenerationTaskOnNode,
  startImageGenerationTaskFollow,
  startTextGenerationTaskFollow,
  startVideoGenerationTaskFollow,
  type GenerationTaskType,
} from './generationTask'

/** 对话 SSE task_created 事件载荷 */
export type ChatTaskCreatedPayload = {
  taskId: string | number
  taskType?: string
  taskName?: string
  prompt?: string
  capabilityCode?: string
  /** 服务端预分配的画布节点 ID */
  nodeId?: string
  /** 画布上游节点 ID，用于自动连线 */
  parentNodeId?: string
}

export function normalizeChatTaskType(raw?: string): GenerationTaskType {
  const type = String(raw || 'IMAGE').trim().toUpperCase()
  if (type === 'VIDEO') return 'VIDEO'
  if (type === 'TEXT') return 'TEXT'
  if (type === 'MODEL' || type === 'MODEL3D' || type === '3D') return 'MODEL'
  return 'IMAGE'
}

function normalizeCanvasNodeId(raw?: string) {
  const nodeId = String(raw ?? '').trim()
  if (!nodeId || nodeId === '字符串值') return ''
  return nodeId
}

/** 按 taskId / nodeId 查找画布上已存在的任务节点 */
export function resolveChatTaskTargetNode(
  graph: Graph,
  payload: ChatTaskCreatedPayload,
): Node | null {
  const taskId = String(payload.taskId ?? '').trim()
  if (taskId) {
    const byTask = findNodeByGenerationTaskId(graph, taskId)
    if (byTask) return byTask
  }

  const nodeId = normalizeCanvasNodeId(payload.nodeId)
  if (nodeId) {
    const cell = graph.getCellById(nodeId)
    if (cell?.isNode()) return cell as Node
  }

  return null
}

/** 绑定 taskId 并按任务类型轮询 getGenerationTask，回写节点结果 */
export function followChatGenerationTaskOnNode(
  node: Node,
  payload: ChatTaskCreatedPayload,
  options: {
    onError?: (message: string) => void
    onComplete?: () => void
    toHtml?: (text: string) => string
  } = {},
) {
  const taskId = String(payload.taskId ?? '').trim()
  if (!taskId) return

  const taskType = normalizeChatTaskType(payload.taskType)
  const title = String(payload.taskName || '').trim() || '生成中'
  const { onError, onComplete, toHtml } = options

  bindGenerationTaskId(node, taskId, taskType)

  if (taskType === 'VIDEO') {
    startVideoGenerationTaskFollow(node, taskId, {
      title,
      fileName: `${title}.mp4`,
      onError,
      onComplete: () => onComplete?.(),
    })
    return
  }

  if (taskType === 'TEXT') {
    startTextGenerationTaskFollow(node, taskId, {
      title,
      toHtml,
      onError,
      onComplete: () => onComplete?.(),
    })
    return
  }

  if (taskType === 'MODEL') {
    void followModelGenerationTaskOnNode(node, taskId, {
      title,
      onError,
    }).finally(() => onComplete?.())
    return
  }

  startImageGenerationTaskFollow(node, taskId, {
    title,
    fileName: `${title}.png`,
    onError,
    onComplete: () => onComplete?.(),
  })
}

/** 将 SSE 返回的结果节点与 parentNodeId 连线，并写入溯源信息 */
export function linkChatTaskNodeToParent(
  graph: Graph,
  targetNode: Node,
  parentNodeIdRaw?: string,
) {
  const parentNodeId = String(parentNodeIdRaw ?? '').trim()
  if (!parentNodeId || parentNodeId === targetNode.id) return

  const parentCell = graph.getCellById(parentNodeId)
  if (!parentCell?.isNode()) return

  const exists = graph.getEdges().some(
    (edge) =>
      edge.getSourceCellId() === parentNodeId
      && edge.getTargetCellId() === targetNode.id,
  )
  if (!exists) {
    connectGenEdge(graph, parentNodeId, targetNode.id)
  }

  const parentData = parentCell.getData() as CanvasNodeData
  const targetData = { ...(targetNode.getData() as CanvasNodeData) }
  if (!targetData.sourceNodeId) {
    targetData.sourceNodeId = parentNodeId
    targetData.sourcePreviewUrl = parentData.previewUrl ?? targetData.sourcePreviewUrl ?? ''
    targetData.sourceFileName = parentData.fileName ?? targetData.sourceFileName ?? ''
    if (parentData.assetId && !targetData.sourceAssetId) {
      targetData.sourceAssetId = parentData.assetId
    }
    targetData.inputUpdated = Boolean(parentData.previewUrl)
    targetNode.setData(targetData)
  }
}

/** 在已有节点上绑定 taskId 并启动轮询 */
export function attachChatTaskToNode(
  graph: Graph,
  node: Node,
  payload: ChatTaskCreatedPayload,
  options: {
    onError?: (message: string) => void
    onComplete?: () => void
    toHtml?: (text: string) => string
  } = {},
) {
  followChatGenerationTaskOnNode(node, payload, options)
  linkChatTaskNodeToParent(graph, node, payload.parentNodeId)
}
