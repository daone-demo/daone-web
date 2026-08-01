import type { Graph, Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { parseVideoAspectRatioValue } from './constants'
import { resolveImageNaturalSizeCached } from './imageDisplayUrl'
import { syncNodeShapeFromData, getNodeSize, refreshCanvasNodeView } from './graph'
import { resolveVideoNaturalSize } from './upload'
import { useUserInfo } from '@stores/useUserInfo';

export type GenerationTaskResult = {
  assetId?: string
  type?: string
  previewUrl?: string
  url?: string
  content?: string
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
  fileName?: string
}

export type GenerationTaskDetail = {
  id: string
  status: string
  progress?: number
  results?: GenerationTaskResult[]
  error?: { code?: string; message?: string } | null
}

export type GenerationTaskType = 'IMAGE' | 'TEXT' | 'MODEL' | 'VIDEO'

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])

export function isGenerationTaskTerminal(status: string) {
  return TERMINAL_STATUSES.has(status)
}
const userInfoStore = useUserInfo();

async function getGenerationTaskDetail<T = GenerationTaskDetail>(taskId: string): Promise<T> {
  const result = await api.getGenerationTask<T>(taskId)
  const task = normalizeGenerationTaskDetail(result)
  if (isGenerationTaskTerminal(task.status)) {
    void userInfoStore.queryPointAccount()
  }
  return result
}
function setNodeData(node: Node, data: CanvasNodeData) {
  node.setData(data, { overwrite: true })
}

function readResultField<T>(item: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const value = item[key]
    if (value !== undefined && value !== null && value !== '') {
      return value as T
    }
  }
  return undefined
}

function normalizeGenerationTaskResult(raw: unknown): GenerationTaskResult | null {
  if (!raw || typeof raw !== 'object') return null

  const item = raw as Record<string, unknown>
  const nestedAsset =
    item.asset && typeof item.asset === 'object' ? (item.asset as Record<string, unknown>) : null

  const assetId = String(
    readResultField<unknown>(item, 'assetId', 'asset_id', 'id') ??
      readResultField<unknown>(nestedAsset ?? {}, 'id', 'assetId', 'asset_id') ??
      '',
  ).trim()

  const previewUrl = String(
    readResultField<unknown>(item, 'previewUrl', 'preview_url', 'url', 'imageUrl', 'image_url') ??
      readResultField<unknown>(nestedAsset ?? {}, 'previewUrl', 'preview_url', 'url') ??
      '',
  ).trim()

  const type = String(readResultField<unknown>(item, 'type') ?? nestedAsset?.type ?? '').trim()
  const content = String(readResultField<unknown>(item, 'content') ?? '').trim()
  const fileName = String(
    readResultField<unknown>(item, 'fileName', 'file_name') ??
      readResultField<unknown>(nestedAsset ?? {}, 'fileName', 'file_name') ??
      '',
  ).trim()

  const width =
    readResultField<number | null>(item, 'width', 'videoWidth', 'video_width') ??
    readResultField<number | null>(nestedAsset ?? {}, 'width', 'videoWidth', 'video_width')
  const height =
    readResultField<number | null>(item, 'height', 'videoHeight', 'video_height') ??
    readResultField<number | null>(nestedAsset ?? {}, 'height', 'videoHeight', 'video_height')
  const durationSeconds =
    readResultField<number | null>(item, 'durationSeconds', 'duration_seconds', 'duration') ??
    readResultField<number | null>(nestedAsset ?? {}, 'durationSeconds', 'duration_seconds', 'duration')

  if (!previewUrl && !assetId && !content) return null

  return {
    assetId: assetId || undefined,
    type: type || undefined,
    previewUrl: previewUrl || undefined,
    url: previewUrl || undefined,
    content: content || undefined,
    width,
    height,
    durationSeconds,
    fileName: fileName || undefined,
  }
}

function unwrapGenerationTaskRecord(raw: Record<string, unknown>) {
  const nestedData = raw.data
  if (!nestedData || typeof nestedData !== 'object' || Array.isArray(nestedData)) {
    return raw
  }

  const nested = nestedData as Record<string, unknown>
  if (readResultField<unknown>(raw, 'status', 'id', 'progress') != null) {
    return raw
  }
  if (readResultField<unknown>(nested, 'status', 'id', 'progress') == null) {
    return raw
  }

  return nested
}

function parseGenerationTaskProgress(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const progressNum = Number(raw)
  if (!Number.isFinite(progressNum)) return undefined
  return Math.max(0, Math.min(100, Math.round(progressNum)))
}

export function normalizeGenerationTaskDetail(raw: unknown): GenerationTaskDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: '', status: 'FAILED' }
  }

  const task = unwrapGenerationTaskRecord(raw as Record<string, unknown>)
  const resultsRaw = Array.isArray(task.results)
    ? task.results
    : Array.isArray(task.resultThumbnails)
      ? task.resultThumbnails
      : []
  const results = resultsRaw
    .map((item) => normalizeGenerationTaskResult(item))
    .filter((item): item is GenerationTaskResult => Boolean(item))

  return {
    id: String(readResultField<unknown>(task, 'id') ?? ''),
    status: String(readResultField<unknown>(task, 'status', 'taskStatus') ?? '').toUpperCase(),
    progress: parseGenerationTaskProgress(readResultField<unknown>(task, 'progress', 'taskProgress')),
    results,
    error: (task.error as GenerationTaskDetail['error']) ?? null,
  }
}

export function pickImageGenerationResults(task: GenerationTaskDetail): GenerationTaskResult[] {
  return task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
}

export function countImageGenerationResults(task: GenerationTaskDetail | unknown): number {
  const normalized = normalizeGenerationTaskDetail(task)
  return Math.max(1, pickImageGenerationResults(normalized).length)
}

export type ImageGenerationOnNodeResult = {
  success: boolean
  extraResults?: GenerationTaskResult[]
  allResults?: GenerationTaskResult[]
  resultCount?: number
}

function buildImageGenerationSuccessResult(task: GenerationTaskDetail): ImageGenerationOnNodeResult {
  const allResults = pickImageGenerationResults(task)
  return {
    success: true,
    allResults,
    extraResults: allResults.slice(1),
    resultCount: Math.max(1, allResults.length),
  }
}

export function pickPrimaryGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  return pickImageGenerationResults(task)[0] ?? null
}

export function pickModelGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
  if (!results.length) return null

  const byType = results.find((item) => String(item.type || '').toUpperCase() === 'MODEL')
  if (byType) return byType

  const byExt = results.find((item) => /\.glb(\?|$)/i.test(item.previewUrl || item.url || ''))
  if (byExt) return byExt

  return results[0] ?? null
}

/** 优先取 type=VIDEO 的结果；否则回退到视频扩展名 URL */
export function pickVideoGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId || item.url) ?? []
  if (!results.length) return null

  const byType = results.find((item) => String(item.type || '').toUpperCase() === 'VIDEO')
  if (byType) return byType

  const byExt = results.find((item) => /\.(mp4|webm|mov)(\?|$)/i.test(item.previewUrl || item.url || ''))
  return byExt ?? results[0] ?? null
}

/** 优先取 type=TEXT 且带 content 的结果（如图片反推提示词） */
export function pickTextGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results ?? []
  if (!results.length) return null

  const byType = results.find(
    (item) => String(item.type || '').toUpperCase() === 'TEXT' && String(item.content || '').trim(),
  )
  if (byType) return byType

  const withContent = results.find((item) => String(item.content || '').trim())
  return withContent ?? null
}

function isNodeOnGraph(node: Node) {
  return Boolean(node.model?.graph)
}

const activePollingTaskIds = new Set<string>()

let onGenerationTaskSucceeded: ((task: GenerationTaskDetail) => void) | null = null

export function setGenerationTaskSucceededHandler(
  handler: ((task: GenerationTaskDetail) => void) | null,
) {
  onGenerationTaskSucceeded = handler
}

function notifyGenerationTaskSucceeded(task: GenerationTaskDetail) {
  if (task.status !== 'SUCCEEDED') return
  onGenerationTaskSucceeded?.(task)
}

function buildSucceededImageGenerationResult(
  task: GenerationTaskDetail,
): ImageGenerationOnNodeResult {
  notifyGenerationTaskSucceeded(task)
  return buildImageGenerationSuccessResult(task)
}

/** 通过节点上绑定的 generationTaskId 查找对应节点 */
export function findNodeByGenerationTaskId(graph: Graph, taskId: string): Node | null {
  const trimmed = taskId.trim()
  if (!trimmed) return null

  for (const cell of graph.getNodes()) {
    const data = cell.getData() as CanvasNodeData
    if (String(data.generationTaskId ?? '').trim() === trimmed) {
      return cell as Node
    }
  }

  return null
}

function getNodeGraph(node: Node): Graph | null {
  return (node.model?.graph as Graph | undefined) ?? null
}

/** 轮询过程中优先按 taskId 定位节点，避免并行任务互相覆盖 */
function resolveTaskNode(graph: Graph | null, fallback: Node, taskId: string): Node | null {
  if (graph) {
    const found = findNodeByGenerationTaskId(graph, taskId)
    if (found) return found
  }
  return isNodeOnGraph(fallback) ? fallback : null
}

function scheduleGenerationTaskFollow(taskId: string, follow: () => Promise<unknown>) {
  const key = taskId.trim()
  if (!key || activePollingTaskIds.has(key)) return false

  activePollingTaskIds.add(key)
  void Promise.resolve()
    .then(follow)
    .finally(() => {
      activePollingTaskIds.delete(key)
    })
  return true
}

export function startVideoGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title?: string
    fileName?: string
    onError?: (message: string) => void
    onComplete?: (success: boolean) => void
  } = {},
) {
  const { onComplete, ...followOptions } = options
  scheduleGenerationTaskFollow(taskId, () =>
    followVideoGenerationTaskOnNode(node, taskId, followOptions).then((success) => {
      onComplete?.(success)
      return success
    }),
  )
}

export function startTextGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title?: string
    toHtml?: (text: string) => string
    onError?: (message: string) => void
    onComplete?: (success: boolean) => void
  } = {},
) {
  const { onComplete, ...followOptions } = options
  scheduleGenerationTaskFollow(taskId, () =>
    followTextGenerationTaskOnNode(node, taskId, followOptions).then((success) => {
      onComplete?.(success)
      return success
    }),
  )
}

export function startImageGenerationTaskFollow(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
    onComplete?: (result: ImageGenerationOnNodeResult) => void
    initialTask?: GenerationTaskDetail
  },
) {
  options.onTaskBound?.(taskId)
  scheduleGenerationTaskFollow(taskId, () =>
    pollAndApplyImageTaskOnNode(node, taskId, options).then((result) => {
      options.onComplete?.(result)
      return result
    }),
  )
}

/** 将 taskId 绑定到节点，随画布快照一并持久化 */
export function bindGenerationTaskId(
  node: Node,
  taskId: string,
  taskType?: GenerationTaskType,
) {
  if (!isNodeOnGraph(node) || !taskId.trim()) return
  const data = { ...(node.getData() as CanvasNodeData), generationTaskId: taskId.trim() }
  if (taskType) {
    data.generationTaskType = taskType
  }
  setNodeData(node, data)
}

export function updateTextGenerationNodeProgress(
  node: Node,
  progress: number,
  options: GenerationProgressSyncOptions = {},
) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.textGenState !== 'loading') return
  data.textGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  setNodeData(node, data)
  refreshGenerationNodeView(node, options.forceRefreshView)
}

export function applyTextGenerationResultToNode(
  node: Node,
  content: string,
  options: { title?: string; toHtml?: (text: string) => string } = {},
) {
  const text = content.trim()
  if (!text) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  data.kind = 'text'
  data.mode = 'editor'
  data.textGenState = 'done'
  data.textGenProgress = 100
  data.textPickerTask = ''
  data.title = options.title || data.title || '反推提示词'
  data.content = options.toHtml ? options.toHtml(text) : text
  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function markTextGenerationNodeFailed(node: Node, errorMessage?: string) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.textGenState = 'idle'
  data.textGenProgress = 0
  if (errorMessage) data.title = '生成失败'
  setNodeData(node, data)
}

export function updateVideoGenerationNodeProgress(
  node: Node,
  progress: number,
  options: GenerationProgressSyncOptions = {},
) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.uploadState !== 'uploading') return
  data.uploadProgress = Math.max(0, Math.min(100, Math.round(progress)))
  setNodeData(node, data)
  refreshGenerationNodeView(node, options.forceRefreshView)
}

export async function applyVideoGenerationResultToNode(
  node: Node,
  result: GenerationTaskResult,
  options: { title?: string; fileName?: string } = {},
) {
  const previewUrl = String(result.previewUrl ?? result.url ?? '').trim()
  if (!previewUrl) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  data.kind = 'video'
  data.mode = 'editor'
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.title = options.title || data.title || '文生视频'
  data.fileName = options.fileName || result.fileName || data.fileName || '文生视频.mp4'
  delete data.generationTaskType
  delete data.generationTaskId
  if (result.assetId) data.assetId = String(result.assetId)

  if (result.width && result.height) {
    data.mediaWidth = result.width
    data.mediaHeight = result.height
    if (result.durationSeconds && result.durationSeconds > 0) {
      data.durationSeconds = result.durationSeconds
    }
  } else {
    try {
      const meta = await resolveVideoNaturalSize(previewUrl)
      data.mediaWidth = meta.width
      data.mediaHeight = meta.height
      if (meta.durationSeconds) {
        data.durationSeconds = meta.durationSeconds
      }
    } catch {
      const ratio =
        data.videoGenAspectRatio ||
        data.videoDialogueSettings?.aspectRatio
      const aspect = parseVideoAspectRatioValue(ratio)
      if (aspect) {
        const baseWidth = 350
        data.mediaWidth = baseWidth
        data.mediaHeight = Math.max(120, Math.round(baseWidth / aspect))
      }
    }
  }

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function markVideoGenerationNodeFailed(node: Node, errorMessage?: string) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.uploadState = 'idle'
  data.uploadProgress = 0
  delete data.generationTaskType
  delete data.generationTaskId
  if (errorMessage) data.title = '生成失败'
  setNodeData(node, data)
}

export function applyModelGenerationResultToNode(
  node: Node,
  result: GenerationTaskResult,
  options: { title?: string; fileName?: string } = {},
) {
  const previewUrl = result.previewUrl?.trim()
  if (!previewUrl) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  data.kind = 'model3d'
  data.imageGenState = 'done'
  data.imageGenProgress = 100
  data.mode = 'editor'
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.assetId = result.assetId
  data.title = options.title || data.title || '3D 模型'
  data.fileName =
    options.fileName ||
    result.fileName ||
    data.fileName ||
    (previewUrl.split('/').pop()?.split('?')[0] || 'model.glb')
  data.mediaWidth = data.mediaWidth || 320
  data.mediaHeight = data.mediaHeight || 360

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

type GenerationProgressSyncOptions = {
  forceRefreshView?: boolean
}

function refreshGenerationNodeView(node: Node, forceRefreshView?: boolean) {
  if (!forceRefreshView) return
  const graph = getNodeGraph(node)
  if (graph) refreshCanvasNodeView(graph, node)
}

export function updateGenerationNodeProgress(
  node: Node,
  progress: number,
  options: GenerationProgressSyncOptions = {},
) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.imageGenState !== 'loading') return
  data.imageGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  setNodeData(node, data)
  refreshGenerationNodeView(node, options.forceRefreshView)
}

export async function applyGenerationResultToNode(
  node: Node,
  result: GenerationTaskResult,
  options: { title?: string; fileName?: string } = {},
) {
  const previewUrl = result.previewUrl?.trim()
  if (!previewUrl) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenState = 'done'
  data.imageGenProgress = 100
  delete data.imageGenTask
  data.mode = 'editor'
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.assetId = result.assetId
  data.title = options.title || data.title || '生成结果'
  data.fileName = options.fileName || result.fileName || data.fileName || '生成结果.png'

  if (result.width && result.height) {
    data.mediaWidth = result.width
    data.mediaHeight = result.height
  } else {
    try {
      const size = await resolveImageNaturalSizeCached(previewUrl)
      data.mediaWidth = size.width
      data.mediaHeight = size.height
    } catch {
      // ignore
    }
  }

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)

  return true
}

export function markGenerationNodeFailed(node: Node, errorMessage?: string) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenState = 'idle'
  data.imageGenProgress = 0
  data.title = errorMessage ? `生成失败` : data.title
  setNodeData(node, data)
}

export async function pollGenerationTask(
  taskId: string,
  options: {
    intervalMs?: number
    onProgress?: (task: GenerationTaskDetail) => void
  } = {},
): Promise<GenerationTaskDetail> {
  const intervalMs = options.intervalMs ?? 2000
  const maxAttempts = 180

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const raw = await getGenerationTaskDetail<GenerationTaskDetail>(taskId)
    const task = normalizeGenerationTaskDetail(raw)
    options.onProgress?.(task)

    if (isGenerationTaskTerminal(task.status)) {
      return task
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }

  throw new Error('生成任务超时，请稍后在任务列表中查看')
}

function pickReadyImageResult(task: GenerationTaskDetail, resultIndex = 0) {
  return pickImageGenerationResults(task)[resultIndex] ?? null
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

async function applyResolvedImageResultToNode(
  node: Node,
  raw: GenerationTaskResult | null,
  options: { title: string; fileName: string },
): Promise<boolean> {
  if (!raw || !isNodeOnGraph(node)) return false
  const resolved = await resolveGenerationResultPreview(raw)
  if (!resolved?.previewUrl?.trim()) return false
  return await applyGenerationResultToNode(node, resolved, options)
}

function isImageResultApplied(node: Node) {
  const data = node.getData() as CanvasNodeData
  return Boolean(data.previewUrl?.trim()) && data.imageGenState !== 'loading'
}

function isTextResultApplied(node: Node) {
  const data = node.getData() as CanvasNodeData
  return data.textGenState === 'done' && Boolean(String(data.content || '').trim())
}

async function pollAndApplyImageTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    initialTask?: GenerationTaskDetail
    onTaskBound?: (taskId: string) => void
  },
): Promise<ImageGenerationOnNodeResult> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return { success: false }

  bindGenerationTaskId(current, taskId, 'IMAGE')
  options.onTaskBound?.(taskId)

  let appliedDuringPoll = false
  let resolvingResult = false
  const applyOptions = { title: options.title, fileName: options.fileName }

  const tryApplyDuringPoll = (task: GenerationTaskDetail) => {
    const target = resolveNode()
    if (!target || appliedDuringPoll || resolvingResult || !isGenerationTaskTerminal(task.status)) return
    const raw = pickReadyImageResult(task)
    if (!raw) return

    resolvingResult = true
    void applyResolvedImageResultToNode(target, raw, applyOptions)
      .then((applied) => {
        if (applied) appliedDuringPoll = true
      })
      .finally(() => {
        resolvingResult = false
      })
  }

  const buildSuccessResult = (task: GenerationTaskDetail): ImageGenerationOnNodeResult =>
    buildSucceededImageGenerationResult(task)

  try {
    const first =
      options.initialTask ??
      normalizeGenerationTaskDetail(await getGenerationTaskDetail<GenerationTaskDetail>(taskId))

    const initialTarget = resolveNode()
    if (!initialTarget) {
      return appliedDuringPoll ? buildSuccessResult(first) : { success: false }
    }

    if (isImageResultApplied(initialTarget)) {
      return buildSuccessResult(first)
    }

    updateGenerationNodeProgress(initialTarget, first.progress ?? 5)
    tryApplyDuringPoll(first)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
        onProgress: (task) => {
          const target = resolveNode()
          if (!target) return
          if (isImageResultApplied(target)) return
          if (isGenerationTaskTerminal(task.status)) {
            tryApplyDuringPoll(task)
            return
          }

          const data = target.getData() as CanvasNodeData
          if (data.imageGenState !== 'loading') return

          updateGenerationNodeProgress(target, task.progress ?? 0)
          tryApplyDuringPoll(task)
        },
      })

    const finalTarget = resolveNode()
    if (!finalTarget) {
      return appliedDuringPoll ? buildSuccessResult(finalTask) : { success: false }
    }

    while (resolvingResult) {
      await new Promise((resolve) => window.setTimeout(resolve, 40))
    }

    if (finalTask.status !== 'SUCCEEDED') {
      if (isImageResultApplied(finalTarget)) {
        return buildSuccessResult(finalTask)
      }
      const reason = finalTask.error?.message || '生成任务失败'
      markGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      return { success: false }
    }

    const primaryResult = pickReadyImageResult(finalTask)
    if (!primaryResult) {
      markGenerationNodeFailed(finalTarget, '未返回结果图片')
      options.onError?.('生成完成，但未返回结果图片')
      return { success: false }
    }

    if (!isImageResultApplied(finalTarget)) {
      const applied = await applyResolvedImageResultToNode(finalTarget, primaryResult, applyOptions)
      if (!applied) {
        markGenerationNodeFailed(finalTarget, '未返回结果图片')
        options.onError?.('生成完成，但未返回结果图片')
        return { success: false }
      }
    }

    return buildSuccessResult(finalTask)
  } catch (error) {
    const target = resolveNode()
    if (target && !isImageResultApplied(target)) {
      markGenerationNodeFailed(target)
    }
    options.onError?.(error instanceof Error ? error.message : '生成失败，请稍后重试')
    return { success: false }
  }
}

/** 继续追踪已有 taskId 的图片生成任务 */
export function followImageGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title: string
    fileName: string
    onError?: (message: string) => void
    onTaskBound?: (taskId: string) => void
  },
) {
  return pollAndApplyImageTaskOnNode(node, taskId, options).then((result) => result.success)
}

/** 继续追踪已有 taskId 的文本生成任务 */
export async function followTextGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    toHtml?: (text: string) => string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'TEXT')

  try {
    if (isTextResultApplied(current)) return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateTextGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
        onProgress: (task) => {
          const target = resolveNode()
          if (target) updateTextGenerationNodeProgress(target, task.progress ?? 0)
        },
      })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    if (isTextResultApplied(finalTarget)) return true

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '文本生成任务失败'
      markTextGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      return false
    }

    const result = pickTextGenerationResult(finalTask)
    const content = result?.content?.trim() || ''
    if (!content) {
      markTextGenerationNodeFailed(finalTarget, '未返回文本')
      options.onError?.('生成完成，但未返回文本内容')
      return false
    }

    applyTextGenerationResultToNode(finalTarget, content, {
      title: options.title,
      toHtml: options.toHtml,
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target && !isTextResultApplied(target)) {
      markTextGenerationNodeFailed(target)
    }
    options.onError?.(error instanceof Error ? error.message : '文本生成失败，请稍后重试')
    return false
  }
}

/** 继续追踪已有 taskId 的 3D 生成任务 */
export async function followModelGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'MODEL')

  try {
    const currentData = current.getData() as CanvasNodeData
    if (currentData.previewUrl && currentData.imageGenState !== 'loading') return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
        onProgress: (task) => {
          const target = resolveNode()
          if (target) updateGenerationNodeProgress(target, task.progress ?? 0)
        },
      })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    const finalData = finalTarget.getData() as CanvasNodeData
    if (finalData.previewUrl && finalData.imageGenState !== 'loading') {
      return true
    }

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '3D 生成任务失败'
      markGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      return false
    }

    const result = pickModelGenerationResult(finalTask)
    const resolved = result ? await resolveGenerationResultPreview(result) : null
    if (!resolved?.previewUrl) {
      markGenerationNodeFailed(finalTarget, '未返回 3D 模型')
      options.onError?.('生成完成，但未返回 GLB 模型')
      return false
    }

    applyModelGenerationResultToNode(finalTarget, resolved, {
      title: options.title,
      fileName: resolved.previewUrl.split('/').pop()?.split('?')[0] || `${options.title || '3D 模型'}.glb`,
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target) markGenerationNodeFailed(target)
    options.onError?.(error instanceof Error ? error.message : '3D 生成失败，请稍后重试')
    return false
  }
}

/** 继续追踪已有 taskId 的视频生成任务 */
export async function followVideoGenerationTaskOnNode(
  node: Node,
  taskId: string,
  options: {
    title?: string
    fileName?: string
    onError?: (message: string) => void
  } = {},
): Promise<boolean> {
  const graph = getNodeGraph(node)
  const resolveNode = () => resolveTaskNode(graph, node, taskId)
  const current = resolveNode()
  if (!current) return false

  bindGenerationTaskId(current, taskId, 'VIDEO')

  try {
    const currentData = current.getData() as CanvasNodeData
    if (currentData.previewUrl && currentData.uploadState !== 'uploading') return true

    const first = normalizeGenerationTaskDetail(
      await getGenerationTaskDetail<GenerationTaskDetail>(taskId),
    )
    updateVideoGenerationNodeProgress(current, first.progress ?? 5)

    const finalTask = isGenerationTaskTerminal(first.status)
      ? first
      : await pollGenerationTask(taskId, {
        onProgress: (task) => {
          const target = resolveNode()
          if (target) updateVideoGenerationNodeProgress(target, task.progress ?? 0)
        },
      })

    const finalTarget = resolveNode()
    if (!finalTarget) return false
    const finalData = finalTarget.getData() as CanvasNodeData
    if (finalData.previewUrl && finalData.uploadState !== 'uploading') {
      return true
    }

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '视频生成任务失败'
      markVideoGenerationNodeFailed(finalTarget, reason)
      options.onError?.(reason)
      return false
    }

    const result = pickVideoGenerationResult(finalTask)
    const resolved = result ? await resolveGenerationResultPreview(result) : null
    if (!resolved?.previewUrl) {
      markVideoGenerationNodeFailed(finalTarget, '未返回视频')
      options.onError?.('生成完成，但未返回视频')
      return false
    }

    await applyVideoGenerationResultToNode(finalTarget, resolved, {
      title: options.title,
      fileName: options.fileName || resolved.fileName || '文生视频.mp4',
    })
    notifyGenerationTaskSucceeded(finalTask)
    return true
  } catch (error) {
    const target = resolveNode()
    if (target) markVideoGenerationNodeFailed(target)
    options.onError?.(error instanceof Error ? error.message : '视频生成失败，请稍后重试')
    return false
  }
}

const resumedTaskIds = new Set<string>()

function shouldResumeNode(data: CanvasNodeData) {
  const taskId = String(data.generationTaskId ?? '').trim()
  if (!taskId || resumedTaskIds.has(taskId)) return false

  const imageLoading = data.imageGenState === 'loading'
  const textLoading = data.textGenState === 'loading'
  const videoLoading = data.kind === 'video' && data.uploadState === 'uploading'
  if (!imageLoading && !textLoading && !videoLoading) return false

  if (data.kind === 'image' && imageLoading && !data.previewUrl) return true
  if (data.kind === 'text' && textLoading && !String(data.content || '').trim()) return true
  if (data.kind === 'model3d' && imageLoading && !data.previewUrl) return true
  if (data.kind === 'video' && videoLoading && !data.previewUrl) return true

  return false
}

function isNodeAwaitingGenerationResume(data: CanvasNodeData) {
  const imageLoading = data.imageGenState === 'loading' && !data.previewUrl
  const textLoading = data.textGenState === 'loading' && !String(data.content || '').trim()
  const videoLoading =
    data.kind === 'video' && data.uploadState === 'uploading' && !data.previewUrl
  return imageLoading || textLoading || videoLoading
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
  const notifyComplete = (succeeded: boolean) => {
    if (succeeded) options.onTaskComplete?.()
  }

  if (data.kind === 'image' && data.imageGenState === 'loading') {
    startImageGenerationTaskFollow(node, taskId, {
      title: data.title || '生成结果',
      fileName: data.fileName || data.title || '生成结果.png',
      onError: options.onError,
      initialTask,
      onComplete: (result) => notifyComplete(result.success),
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
      }).then(notifyComplete),
    )
    return
  }

  if (data.kind === 'video' && data.uploadState === 'uploading') {
    startVideoGenerationTaskFollow(node, taskId, {
      title: data.title || '文生视频',
      fileName: data.fileName || '文生视频.mp4',
      onError: options.onError,
      onComplete: (success) => {
        notifyComplete(success)
        options.onVideoGenerationComplete?.(node.id, success)
      },
    })
  }
}

/** 画布加载后，恢复所有带 taskId 且仍在生成中的节点 */
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
    nodesToResume.push({ node, data, taskId })
  })

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

export function resetResumedGenerationTaskCache() {
  resumedTaskIds.clear()
  activePollingTaskIds.clear()
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
    return { started: false }
  }

  options.onTaskCreated?.(created)

  const taskId = String(created.id ?? '').trim()
  if (!taskId) {
    markGenerationNodeFailed(node, '创建生成任务失败')
    options.onError?.('创建生成任务失败')
    return { started: false }
  }

  bindGenerationTaskId(node, taskId, 'IMAGE')
  options.onTaskBound?.(taskId)

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
  },
): Promise<ImageGenerationOnNodeResult> {
  if (!isNodeOnGraph(node)) return { success: false }

  let created: GenerationTaskDetail
  try {
    created = normalizeGenerationTaskDetail(await options.createTask())
  } catch (error) {
    markGenerationNodeFailed(node)
    options.onError?.(error instanceof Error ? error.message : '创建生成任务失败')
    return { success: false }
  }

  const taskId = created.id
  if (!taskId) {
    markGenerationNodeFailed(node, '创建生成任务失败')
    options.onError?.('创建生成任务失败')
    return { success: false }
  }

  return pollAndApplyImageTaskOnNode(node, taskId, {
    title: options.title,
    fileName: options.fileName,
    onError: options.onError,
    onTaskBound: options.onTaskBound,
    initialTask: created,
  })
}
