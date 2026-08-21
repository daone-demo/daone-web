import type { Graph, Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { useUserInfo } from '@stores/useUserInfo'
import type {
  GenerationTaskDetail,
  GenerationTaskResult,
  GenerationTaskType,
  ImageGenerationOnNodeResult,
} from './generationTaskTypes'
import { isGenerationProgressTitle } from './generationTaskTitles'
import {
  isGenerationTaskTerminal,
  normalizeGenerationTaskDetail,
  pickImageGenerationResults,
} from './generationTaskNormalize'
import { setNodeData, isNodeOnGraph } from './generationTaskApply'

const userInfoStore = useUserInfo()
export let generationPollEpoch = 0
let lastPointAccountQueryAt = 0
/** taskId → 当前 follow 的 owner token；finally 仅在 owner 仍匹配时删除，避免旧轮询清掉新登记 */
export const activePollingTaskOwners = new Map<string, string>()
export const resumedTaskIds = new Set<string>()

export function cancelAllGenerationTaskPolling() {
  generationPollEpoch += 1
  resumedTaskIds.clear()
  activePollingTaskOwners.clear()
}

export async function getGenerationTaskDetail<T = GenerationTaskDetail>(
  taskId: string,
): Promise<T> {
  const result = await api.getGenerationTask<T>(taskId)
  const task = normalizeGenerationTaskDetail(result)
  if (isGenerationTaskTerminal(task.status)) {
    const now = Date.now()
    if (now - lastPointAccountQueryAt > 2000) {
      lastPointAccountQueryAt = now
      void userInfoStore.queryPointAccount()
    }
  }
  return result
}
function buildImageGenerationSuccessResult(
  task: GenerationTaskDetail,
): ImageGenerationOnNodeResult {
  const allResults = pickImageGenerationResults(task)
  return {
    success: true,
    allResults,
    extraResults: allResults.slice(1),
    resultCount: Math.max(1, allResults.length),
  }
}

let onGenerationTaskSucceeded: ((task: GenerationTaskDetail) => void) | null = null
let onGenerationTaskSettled: (() => void) | null = null

export function setGenerationTaskSucceededHandler(
  handler: ((task: GenerationTaskDetail) => void) | null,
) {
  onGenerationTaskSucceeded = handler
}

export function setGenerationTaskSettledHandler(handler: (() => void) | null) {
  onGenerationTaskSettled = handler
}

export function notifyGenerationTaskSettled() {
  onGenerationTaskSettled?.()
}

export function notifyGenerationTaskSucceeded(task: GenerationTaskDetail) {
  if (task.status !== 'SUCCEEDED') return
  onGenerationTaskSucceeded?.(task)
  notifyGenerationTaskSettled()
}

export function buildSucceededImageGenerationResult(
  task: GenerationTaskDetail,
): ImageGenerationOnNodeResult {
  notifyGenerationTaskSucceeded(task)
  return buildImageGenerationSuccessResult(task)
}

export function findNodesByGenerationTaskId(graph: Graph, taskId: string): Node[] {
  const trimmed = taskId.trim()
  if (!trimmed) return []

  const nodes: Node[] = []
  for (const cell of graph.getNodes()) {
    if (!cell.isNode()) continue
    const data = cell.getData() as CanvasNodeData
    if (String(data.generationTaskId ?? '').trim() === trimmed) {
      nodes.push(cell as Node)
    }
  }

  return nodes.sort(
    (a, b) =>
      readGenerationResultIndex(a.getData() as CanvasNodeData) -
      readGenerationResultIndex(b.getData() as CanvasNodeData),
  )
}

export function findNodeByGenerationTaskId(graph: Graph, taskId: string): Node | null {
  return findNodesByGenerationTaskId(graph, taskId)[0] ?? null
}

/** 根据 taskId 回写节点任务名（SSE task_status / 轮询中间态） */
export function updateGenerationTaskNodeTitleByTaskId(
  graph: Graph,
  taskId: string,
  taskName: string,
) {
  const nodes = findNodesByGenerationTaskId(graph, taskId.trim())
  if (!nodes.length) return

  const normalized = String(taskName ?? '').trim()
  if (!normalized || isGenerationProgressTitle(normalized)) return

  for (const node of nodes) {
    const data = { ...(node.getData() as CanvasNodeData) }
    data.generationTaskName = normalized

    const shouldUpdateTitle =
      data.imageGenState === 'loading' ||
      data.textGenState === 'loading' ||
      data.uploadState === 'uploading' ||
      isGenerationProgressTitle(data.title)

    if (shouldUpdateTitle) {
      data.title = normalized
    }

    setNodeData(node, data)
  }
}

export function resolveTaskNode(graph: Graph | null, fallback: Node, taskId: string): Node | null {
  if (graph) {
    const found = findNodeByGenerationTaskId(graph, taskId)
    if (found) return found
  }
  return isNodeOnGraph(fallback) ? fallback : null
}

/** 同一 taskId 下全部结果节点（按 generationResultIndex 排序）；无图时回退到 fallback */
export function resolveSharedImageTaskNodes(
  graph: Graph | null,
  fallback: Node,
  taskId: string,
): Node[] {
  if (graph) {
    const found = findNodesByGenerationTaskId(graph, taskId)
    if (found.length) return found
  }
  return isNodeOnGraph(fallback) ? [fallback] : []
}

export function bindGenerationTaskId(
  node: Node,
  taskId: string,
  taskType?: GenerationTaskType,
  resultIndex?: number,
) {
  if (!isNodeOnGraph(node) || !taskId.trim()) return
  const data = { ...(node.getData() as CanvasNodeData), generationTaskId: taskId.trim() }
  if (taskType) {
    data.generationTaskType = taskType
  }
  if (resultIndex !== undefined && Number.isFinite(resultIndex)) {
    data.generationResultIndex = Math.max(0, Math.round(resultIndex))
  } else if (data.generationResultIndex === undefined) {
    data.generationResultIndex = 0
  }
  setNodeData(node, data)
}

/** 将同一 taskId 绑定到多个结果节点，并写入各自的 resultIndex */
export function bindSharedGenerationTaskId(
  nodes: Array<{ node: Node; resultIndex: number }>,
  taskId: string,
  taskType?: GenerationTaskType,
) {
  const trimmed = taskId.trim()
  if (!trimmed || !nodes.length) return
  for (const item of nodes) {
    if (!item.node) continue
    bindGenerationTaskId(item.node, trimmed, taskType, item.resultIndex)
  }
}

export function readGenerationResultIndex(data?: CanvasNodeData | null): number {
  const raw = data?.generationResultIndex
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.round(raw)
  }
  return 0
}

export async function pollGenerationTask(
  taskId: string,
  options: {
    intervalMs?: number
    onProgress?: (task: GenerationTaskDetail) => void
    shouldContinue?: () => boolean
  } = {},
): Promise<GenerationTaskDetail> {
  const intervalMs = options.intervalMs ?? 2000
  const maxAttempts = 450
  const epoch = generationPollEpoch
  let lastTask: GenerationTaskDetail | null = null

  const canContinue = () =>
    epoch === generationPollEpoch && (options.shouldContinue ? options.shouldContinue() : true)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!canContinue()) {
      return lastTask ?? { id: taskId, status: 'CANCELED' }
    }

    const raw = await getGenerationTaskDetail<GenerationTaskDetail>(taskId)
    const task = normalizeGenerationTaskDetail(raw)
    lastTask = task
    options.onProgress?.(task)

    if (isGenerationTaskTerminal(task.status)) {
      return task
    }

    if (!canContinue()) {
      return lastTask
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }

  throw new Error('生成任务超时，请稍后在任务列表中查看')
}

type AssetPreviewDetail = {
  id?: string
  previewUrl?: string
  url?: string
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  fileName?: string
}

/** 将生成结果中的 assetId 解析为可展示的 previewUrl */
export async function resolveGenerationResultPreview(
  result: GenerationTaskResult,
): Promise<GenerationTaskResult | null> {
  const directUrl = result.previewUrl?.trim() || result.url?.trim()
  if (directUrl) {
    return { ...result, previewUrl: directUrl }
  }

  const assetId = String(result.assetId ?? '').trim()
  if (!assetId) return null

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const raw = await api.getAsset<AssetPreviewDetail>(assetId)
      const asset =
        raw && typeof raw === 'object' && 'data' in raw
          ? ((raw as { data?: AssetPreviewDetail }).data ?? {})
          : raw
      const previewUrl = String(asset.previewUrl ?? asset.url ?? '').trim()
      if (previewUrl) {
        return {
          ...result,
          assetId: String(result.assetId || asset.id || assetId),
          previewUrl,
          width: result.width ?? asset.width ?? undefined,
          height: result.height ?? asset.height ?? undefined,
          durationSeconds: result.durationSeconds ?? asset.durationSeconds ?? undefined,
          fileName: result.fileName || asset.fileName,
        }
      }
    } catch {
      // asset 可能尚未就绪，稍后重试
    }

    if (attempt < 3) {
      await new Promise((resolve) => window.setTimeout(resolve, 600))
    }
  }

  return null
}
