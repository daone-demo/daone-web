import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { connectGenEdge } from './imageGen'
import {
  bindGenerationTaskId,
  findNodeByGenerationTaskId,
  followModelGenerationTaskOnNode,
  isGenerationProgressTitle,
  startImageGenerationTaskFollow,
  startTextGenerationTaskFollow,
  startVideoGenerationTaskFollow,
  updateGenerationTaskNodeTitleByTaskId,
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
  /** 画布上游节点 ID，用于自动连线（多个时逗号分隔） */
  parentNodeId?: string
  /** 发起流式请求时的项目，用于切项目后丢弃迟到事件 */
  projectId?: string
  /** 仅补齐父节点连线，不重新绑定任务轮询 */
  relinkParentsOnly?: boolean
}

/** 对话 SSE task_status / task_progress 携带的任务名更新 */
export type ChatTaskUpdatedPayload = {
  taskId: string | number
  taskName: string
  /** 发起流式请求时的项目，用于切项目后丢弃迟到事件 */
  projectId?: string
}

const CHAT_TASK_CAPABILITY_TITLES: Record<string, string> = {
  IMAGE_REMOVE_BG: '抠图',
  IMAGE_PROMPT_REVERSE: '提示词反推',
  IMAGE_TO_3D: '图生3D',
  IMAGE_INPAINT: '局部修改',
  IMAGE_EDIT_TEXT: '编辑文字',
  IMAGE_EXPAND: '扩图',
  IMAGE_CROP: '裁剪',
  IMAGE_GENERAL_V1: '文生图',
  TEXT_COPY_V1: '文案生成',
  VIDEO_GENERAL_V1: '文生视频',
}

/** 对话任务节点标题：优先 taskName，其次 capabilityCode 映射，最后才是进行中占位 */
export function resolveChatTaskTitle(
  payload: Pick<ChatTaskCreatedPayload, 'taskName' | 'capabilityCode'>,
) {
  const taskName = String(payload.taskName ?? '').trim()
  if (taskName && !isGenerationProgressTitle(taskName)) return taskName

  const capabilityCode = String(payload.capabilityCode ?? '').trim()
  if (capabilityCode && CHAT_TASK_CAPABILITY_TITLES[capabilityCode]) {
    return CHAT_TASK_CAPABILITY_TITLES[capabilityCode]
  }

  return '生成中'
}

/** 根据 taskId 回写节点任务名（来自 SSE task_status / task_progress） */
export function updateChatTaskNodeTitle(graph: Graph, payload: ChatTaskUpdatedPayload) {
  const taskId = String(payload.taskId ?? '').trim()
  const taskName = String(payload.taskName ?? '').trim()
  if (!taskId || !taskName) return
  updateGenerationTaskNodeTitleByTaskId(graph, taskId, taskName)
}

export function normalizeChatTaskType(raw?: string): GenerationTaskType {
  const type = String(raw || 'IMAGE').trim().toUpperCase()
  if (type === 'VIDEO') return 'VIDEO'
  if (type === 'TEXT') return 'TEXT'
  if (type === 'MODEL' || type === 'MODEL3D' || type === '3D') return 'MODEL'
  return 'IMAGE'
}

export function normalizeCanvasNodeId(raw?: string) {
  const nodeId = String(raw ?? '').trim()
  // 逗号拼接表示父节点列表，不能当作单个结果节点 ID
  if (!nodeId || nodeId === '字符串值' || nodeId.includes(',')) return ''
  return nodeId
}

/** 解析逗号分隔的画布节点 ID 列表（去重、保序） */
export function parseChatNodeIdList(raw?: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const part of String(raw ?? '').split(',')) {
    const id = part.trim()
    if (!id || id === '字符串值' || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

/**
 * 创建任务时解析父节点：
 * - 服务端明确给 1 个 parent → 信任（并行任务一一对应）
 * - 多个 parent / 仅有请求 nodeId 列表 → 先按 taskIndex 取 1 个，避免并行任务交叉连线；
 *   若整轮最终只有 1 个任务，再在 finalize 时扩成多对一
 */
export function resolveChatTaskParentNodeIds(input: {
  serverParentNodeId?: string
  requestNodeIds?: string
  taskIndex: number
}): string[] {
  const serverIds = parseChatNodeIdList(input.serverParentNodeId)
  const requestIds = parseChatNodeIdList(input.requestNodeIds)

  if (serverIds.length === 1) return serverIds

  const pool = serverIds.length > 0 ? serverIds : requestIds
  if (!pool.length) return []
  if (pool.length === 1) return pool

  const index = Math.max(0, Math.floor(Number(input.taskIndex) || 0))
  const picked = pool[Math.min(index, pool.length - 1)]
  return picked ? [picked] : []
}

/**
 * 流结束后定稿父节点：
 * - 单任务 + 多源 → 全部连接（多对一，如换脸）
 * - 多任务 → 按序号一一对应
 * - 服务端明确单 parent → 仍信任
 */
export function finalizeChatTaskParentNodeIds(input: {
  serverParentNodeId?: string
  requestNodeIds?: string
  taskIndex: number
  taskCount: number
}): string[] {
  const serverIds = parseChatNodeIdList(input.serverParentNodeId)
  const requestIds = parseChatNodeIdList(input.requestNodeIds)
  const taskCount = Math.max(1, Math.floor(Number(input.taskCount) || 1))

  if (serverIds.length === 1) return serverIds

  const pool = serverIds.length > 0 ? serverIds : requestIds
  if (!pool.length) return []
  if (pool.length === 1) return pool

  if (taskCount === 1) return pool

  const index = Math.max(0, Math.floor(Number(input.taskIndex) || 0))
  const picked = pool[Math.min(index, pool.length - 1)]
  return picked ? [picked] : []
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
  const title = resolveChatTaskTitle(payload)
  const { onError, onComplete, toHtml } = options

  bindGenerationTaskId(node, taskId, taskType)
  if (!isGenerationProgressTitle(title)) {
    const data = { ...(node.getData() as CanvasNodeData), title, generationTaskName: title }
    node.setData(data)
  }

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

/** 将结果节点与 parentNodeId 连线（支持逗号分隔多父节点），并写入主溯源 */
export function linkChatTaskNodeToParent(
  graph: Graph,
  targetNode: Node,
  parentNodeIdRaw?: string,
) {
  const parentIds = parseChatNodeIdList(parentNodeIdRaw)
  if (!parentIds.length) return

  const targetDataSnapshot = targetNode.getData() as CanvasNodeData
  let primarySourceSet = Boolean(String(targetDataSnapshot.sourceNodeId ?? '').trim())

  for (const parentNodeId of parentIds) {
    if (parentNodeId === targetNode.id) continue

    const parentCell = graph.getCellById(parentNodeId)
    if (!parentCell?.isNode()) continue

    const exists = graph.getEdges().some(
      (edge) =>
        edge.getSourceCellId() === parentNodeId
        && edge.getTargetCellId() === targetNode.id,
    )
    if (!exists) {
      connectGenEdge(graph, parentNodeId, targetNode.id)
    }

    if (primarySourceSet) continue

    const parentData = parentCell.getData() as CanvasNodeData
    const targetData = { ...(targetNode.getData() as CanvasNodeData) }
    targetData.sourceNodeId = parentNodeId
    targetData.sourcePreviewUrl = parentData.previewUrl ?? targetData.sourcePreviewUrl ?? ''
    targetData.sourceFileName = parentData.fileName ?? targetData.sourceFileName ?? ''
    if (parentData.assetId && !targetData.sourceAssetId) {
      targetData.sourceAssetId = parentData.assetId
    }
    targetData.inputUpdated = Boolean(parentData.previewUrl)
    targetNode.setData(targetData)
    primarySourceSet = true
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
