import type { Graph, Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import type {
  GenerationTaskDetail,
  GenerationTaskType,
  ImageGenerationOnNodeResult,
} from './generationTaskTypes'
import {
  isGenerationTaskTerminal,
  normalizeGenerationTaskDetail,
  readResultField,
} from './generationTaskNormalize'
import {
  isNodeOnGraph,
  updateTextGenerationNodeProgress,
  updateVideoGenerationNodeProgress,
  updateGenerationNodeProgress,
  markGenerationNodeFailed,
  type GenerationProgressSyncOptions,
} from './generationTaskApply'
export {
  updateTextGenerationNodeProgress,
  applyTextGenerationResultToNode,
  markTextGenerationNodeFailed,
  updateVideoGenerationNodeProgress,
  applyVideoGenerationResultToNode,
  markVideoGenerationNodeFailed,
  applyModelGenerationResultToNode,
  updateGenerationNodeProgress,
  applyGenerationResultToNode,
  markGenerationNodeFailed,
} from './generationTaskApply'

export type {
  GenerationTaskDetail,
  GenerationTaskResult,
  GenerationTaskType,
  ImageGenerationOnNodeResult,
} from './generationTaskTypes'
export {
  isGenerationProgressTitle,
  pickGenerationTaskName,
  resolveGenerationResultTitle,
  resolveGenerationResultTitleWithFallback,
} from './generationTaskTitles'
export {
  countImageGenerationResults,
  isGenerationTaskTerminal,
  normalizeGenerationTaskDetail,
  pickImageGenerationResults,
  pickModelGenerationResult,
  pickPrimaryGenerationResult,
  pickTextGenerationResult,
  pickVideoGenerationResult,
} from './generationTaskNormalize'

export {
  cancelAllGenerationTaskPolling,
  setGenerationTaskSucceededHandler,
  setGenerationTaskSettledHandler,
  findNodeByGenerationTaskId,
  findNodesByGenerationTaskId,
  updateGenerationTaskNodeTitleByTaskId,
  bindGenerationTaskId,
  bindSharedGenerationTaskId,
  readGenerationResultIndex,
  pollGenerationTask,
  resolveGenerationResultPreview,
} from './generationTaskState'

export {
  scheduleGenerationTaskFollow,
  startVideoGenerationTaskFollow,
  startTextGenerationTaskFollow,
  startImageGenerationTaskFollow,
  followImageGenerationTaskOnNode,
  followTextGenerationTaskOnNode,
  followModelGenerationTaskOnNode,
  followVideoGenerationTaskOnNode,
} from './generationTaskFollow'

import {
  cancelAllGenerationTaskPolling,
  getGenerationTaskDetail,
  notifyGenerationTaskSettled,
  resumedTaskIds,
  bindGenerationTaskId,
} from './generationTaskState'
import {
  scheduleGenerationTaskFollow,
  startVideoGenerationTaskFollow,
  startTextGenerationTaskFollow,
  startImageGenerationTaskFollow,
  followModelGenerationTaskOnNode,
  pollAndApplyImageTaskOnNode,
} from './generationTaskFollow'

export function resetResumedGenerationTaskCache() {
  cancelAllGenerationTaskPolling()
}

function shouldResumeNode(data: CanvasNodeData) {
  const taskId = String(data.generationTaskId ?? '').trim()
  if (!taskId || resumedTaskIds.has(taskId)) return false

  const imageLoading = data.imageGenState === 'loading'
  const textLoading = data.textGenState === 'loading'
  const videoLoading = data.kind === 'video' && data.uploadState === 'uploading'
  if (!imageLoading && !textLoading && !videoLoading) return false

  if (data.kind === 'image' && imageLoading) return true
  if (data.kind === 'text' && textLoading) return true
  if (data.kind === 'model3d' && imageLoading) return true
  if (data.kind === 'video' && videoLoading) return true

  return false
}

function isNodeAwaitingGenerationResume(data: CanvasNodeData) {
  const taskId = String(data.generationTaskId ?? '').trim()
  const imageLoading = data.imageGenState === 'loading'
  const textLoading = data.textGenState === 'loading'
  const videoLoading = data.kind === 'video' && data.uploadState === 'uploading'

  if (taskId && (imageLoading || textLoading || videoLoading)) return true

  if (data.kind === 'image' && imageLoading && !data.previewUrl) return true
  if (data.kind === 'text' && textLoading && !String(data.content || '').trim()) return true
  if (data.kind === 'model3d' && imageLoading && !data.previewUrl) return true
  if (data.kind === 'video' && videoLoading && !data.previewUrl) return true

  return false
}

function inferGenerationTaskType(
  raw: unknown,
  data: CanvasNodeData,
): GenerationTaskType | undefined {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const type = String(record?.taskType ?? record?.task_type ?? '')
    .trim()
    .toUpperCase()
  if (type === 'IMAGE' || type === 'TEXT' || type === 'VIDEO' || type === 'MODEL') {
    return type
  }
  if (data.kind === 'video') return 'VIDEO'
  if (data.kind === 'text') return 'TEXT'
  if (data.kind === 'model3d') return 'MODEL'
  if (data.kind === 'image') return 'IMAGE'
  return undefined
}

function applyTaskProgressFromDetail(
  node: Node,
  task: GenerationTaskDetail,
  options: GenerationProgressSyncOptions = {},
) {
  if (isGenerationTaskTerminal(task.status)) return

  const progress = task.progress ?? 0
  const data = node.getData() as CanvasNodeData

  if (data.imageGenState === 'loading') {
    updateGenerationNodeProgress(node, progress, options)
    return
  }
  if (data.textGenState === 'loading') {
    updateTextGenerationNodeProgress(node, progress, options)
    return
  }
  if (data.kind === 'video' && data.uploadState === 'uploading') {
    updateVideoGenerationNodeProgress(node, progress, options)
  }
}

/** 为缺少 taskId 的进行中节点，从服务端 RUNNING 任务恢复绑定并同步进度 */
export async function recoverOrphanedGenerationTasks(
  graph: Graph,
  projectId: string,
  options: {
    onTaskBound?: () => void
  } = {},
) {
  const trimmedProjectId = projectId.trim()
  if (!trimmedProjectId) return

  let records: unknown[] = []
  try {
    const res = await api.getGenerationTasks({ projectId: trimmedProjectId, status: 'RUNNING', pageSize: 100 })
    records = res.records ?? []
  } catch {
    return
  }

  for (const raw of records) {
    const task = normalizeGenerationTaskDetail(raw)
    const taskId = task.id.trim()
    if (!taskId || isGenerationTaskTerminal(task.status)) continue

    const nodeId = String(
      readResultField<unknown>(raw as Record<string, unknown>, 'nodeId', 'node_id') ?? '',
    ).trim()
    if (!nodeId) continue

    const cell = graph.getCellById(nodeId)
    if (!cell?.isNode()) continue

    const node = cell as Node
    const data = node.getData() as CanvasNodeData
    if (!isNodeAwaitingGenerationResume(data)) continue

    const existingTaskId = String(data.generationTaskId ?? '').trim()
    if (!existingTaskId) {
      bindGenerationTaskId(node, taskId, inferGenerationTaskType(raw, data))
      options.onTaskBound?.()
    }

    applyTaskProgressFromDetail(node, task, { forceRefreshView: true })
  }
}

type ResumePendingGenerationTasksOptions = {
  toHtml?: (text: string) => string
  onError?: (message: string) => void
  onTaskBound?: () => void
  onTaskComplete?: () => void
  onVideoGenerationComplete?: (nodeId: string, success: boolean) => void
}

function resumeGenerationTaskFollow(
  node: Node,
  data: CanvasNodeData,
  taskId: string,
  options: ResumePendingGenerationTasksOptions,
  initialTask?: GenerationTaskDetail,
) {
  const notifyComplete = () => {
    notifyGenerationTaskSettled()
    options.onTaskComplete?.()
  }

  if (data.kind === 'image' && data.imageGenState === 'loading') {
    startImageGenerationTaskFollow(node, taskId, {
      title: data.title || '生成结果',
      fileName: data.fileName || data.title || '生成结果.png',
      onError: options.onError,
      initialTask,
      onComplete: () => notifyComplete(),
    })
    return
  }

  if (data.kind === 'text' && data.textGenState === 'loading') {
    startTextGenerationTaskFollow(node, taskId, {
      title: data.title,
      toHtml: options.toHtml,
      onError: options.onError,
      onComplete: notifyComplete,
    })
    return
  }

  if (data.kind === 'model3d' && data.imageGenState === 'loading') {
    scheduleGenerationTaskFollow(taskId, () =>
      followModelGenerationTaskOnNode(node, taskId, {
        title: data.title || '3D 模型',
        onError: options.onError,
      }).finally(() => notifyComplete()),
    )
    return
  }

  if (data.kind === 'video' && data.uploadState === 'uploading') {
    startVideoGenerationTaskFollow(node, taskId, {
      title: data.title || '文生视频',
      fileName: data.fileName || '文生视频.mp4',
      onError: options.onError,
      onComplete: (success) => {
        notifyComplete()
        options.onVideoGenerationComplete?.(node.id, success)
      },
    })
  }
}

/** 画布加载后，恢复所有带 taskId 且仍在生成中的节点（同 taskId 只轮询一次，结果按 index 分发） */
export async function resumePendingGenerationTasks(
  graph: Graph,
  options: ResumePendingGenerationTasksOptions = {},
) {
  const nodesToResume: Array<{ node: Node; data: CanvasNodeData; taskId: string }> = []

  graph.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    if (!shouldResumeNode(data)) return

    const taskId = String(data.generationTaskId).trim()
    resumedTaskIds.add(taskId)
    options.onTaskBound?.()
    // 优先用 resultIndex 最小的节点作为轮询入口，便于按索引分发
    nodesToResume.push({ node, data, taskId })
  })

  // 同 taskId 可能扫到多个 loading 节点，但 shouldResumeNode 已保证每个 taskId 只入队一次
  await Promise.all(
    nodesToResume.map(async ({ node, data, taskId }) => {
      let initialTask: GenerationTaskDetail | undefined
      try {
        initialTask = normalizeGenerationTaskDetail(
          await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
        )
        applyTaskProgressFromDetail(node, initialTask, { forceRefreshView: true })
      } catch {
        // ignore prime failure and continue following
      }

      resumeGenerationTaskFollow(node, data, taskId, options, initialTask)
    }),
  )
}

/** 创建图片任务后立即返回，后台按 taskId 回写对应节点 */
export async function startImageGenerationOnNode(
  node: Node,
  options: {
    title: string
    fileName: string
    createTask: () => Promise<GenerationTaskDetail | unknown>
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
    onTaskCreated?: (task: GenerationTaskDetail) => void
    onComplete?: (result: ImageGenerationOnNodeResult) => void
  },
): Promise<{ started: boolean; taskId?: string }> {
  if (!isNodeOnGraph(node)) return { started: false }

  let created: GenerationTaskDetail
  try {
    created = normalizeGenerationTaskDetail(await options.createTask())
  } catch (error) {
    markGenerationNodeFailed(node)
    options.onError?.(error instanceof Error ? error.message : '创建生成任务失败')
    notifyGenerationTaskSettled()
    return { started: false }
  }

  const taskId = String(created.id ?? '').trim()
  if (!taskId) {
    markGenerationNodeFailed(node, '创建生成任务失败')
    options.onError?.('创建生成任务失败')
    notifyGenerationTaskSettled()
    return { started: false }
  }

  // 先绑定 taskId，再触发 onTaskCreated，便于多张结果节点立刻共享同一任务并同步进度
  bindGenerationTaskId(node, taskId, 'IMAGE')
  options.onTaskBound?.(taskId)
  options.onTaskCreated?.(created)

  startImageGenerationTaskFollow(node, taskId, {
    title: options.title,
    fileName: options.fileName,
    onError: options.onError,
    initialTask: created,
    onComplete: options.onComplete,
  })

  return { started: true, taskId }
}

/** 在单个结果节点上创建任务、绑定 taskId 并回写图片生成结果（阻塞直到完成） */
export async function runImageGenerationOnNode(
  node: Node,
  options: {
    title: string
    fileName: string
    createTask: () => Promise<GenerationTaskDetail>
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
    onProgress?: (progress: number, task: GenerationTaskDetail) => void
  },
): Promise<ImageGenerationOnNodeResult> {
  if (!isNodeOnGraph(node)) return { success: false }

  let created: GenerationTaskDetail
  try {
    created = normalizeGenerationTaskDetail(await options.createTask())
  } catch (error) {
    markGenerationNodeFailed(node)
    options.onError?.(error instanceof Error ? error.message : '创建生成任务失败')
    notifyGenerationTaskSettled()
    return { success: false }
  }

  const taskId = created.id
  if (!taskId) {
    markGenerationNodeFailed(node, '创建生成任务失败')
    options.onError?.('创建生成任务失败')
    notifyGenerationTaskSettled()
    return { success: false }
  }

  const result = await pollAndApplyImageTaskOnNode(node, taskId, {
    title: options.title,
    fileName: options.fileName,
    onError: options.onError,
    onTaskBound: options.onTaskBound,
    onProgress: options.onProgress,
    initialTask: created,
  })
  if (!result.success) notifyGenerationTaskSettled()
  return result
}
