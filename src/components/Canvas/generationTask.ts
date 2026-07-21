import type { Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { syncNodeShapeFromData, getNodeSize } from './graph'

export type GenerationTaskResult = {
  assetId?: string
  type?: string
  previewUrl?: string
  url?: string
  content?: string
  width?: number | null
  height?: number | null
  fileName?: string
}

export type GenerationTaskDetail = {
  id: string
  status: string
  progress?: number
  results?: GenerationTaskResult[]
  error?: { code?: string; message?: string } | null
}

const TERMINAL_STATUSES = new Set(['SUCCEEDED', 'FAILED', 'CANCELED'])

export function isGenerationTaskTerminal(status: string) {
  return TERMINAL_STATUSES.has(status)
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

  const width = readResultField<number | null>(item, 'width') ?? readResultField<number | null>(nestedAsset ?? {}, 'width')
  const height = readResultField<number | null>(item, 'height') ?? readResultField<number | null>(nestedAsset ?? {}, 'height')

  if (!previewUrl && !assetId && !content) return null

  return {
    assetId: assetId || undefined,
    type: type || undefined,
    previewUrl: previewUrl || undefined,
    url: previewUrl || undefined,
    content: content || undefined,
    width,
    height,
    fileName: fileName || undefined,
  }
}

export function normalizeGenerationTaskDetail(raw: unknown): GenerationTaskDetail {
  if (!raw || typeof raw !== 'object') {
    return { id: '', status: 'FAILED' }
  }

  const task = raw as Record<string, unknown>
  const resultsRaw = Array.isArray(task.results) ? task.results : []
  const results = resultsRaw
    .map((item) => normalizeGenerationTaskResult(item))
    .filter((item): item is GenerationTaskResult => Boolean(item))

  return {
    id: String(readResultField<unknown>(task, 'id') ?? ''),
    status: String(readResultField<unknown>(task, 'status') ?? ''),
    progress: Number(readResultField<unknown>(task, 'progress') ?? 0) || undefined,
    results,
    error: (task.error as GenerationTaskDetail['error']) ?? null,
  }
}

export function pickImageGenerationResults(task: GenerationTaskDetail): GenerationTaskResult[] {
  return task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
}

export function pickPrimaryGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  return pickImageGenerationResults(task)[0] ?? null
}

/** 优先取 type=MODEL 的 GLB；否则回退到 .glb URL 或首个结果 */
export function pickModelGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
  if (!results.length) return null

  const byType = results.find((item) => String(item.type || '').toUpperCase() === 'MODEL')
  if (byType?.previewUrl) return byType

  const byExt = results.find((item) => /\.glb(\?|$)/i.test(item.previewUrl || ''))
  if (byExt) return byExt

  return results[0] ?? null
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

function bindGenerationTaskId(node: Node, taskId: string) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData), generationTaskId: taskId }
  setNodeData(node, data)
}

function clearGenerationTaskId(node: Node) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData) }
  delete data.generationTaskId
  setNodeData(node, data)
}

export function updateTextGenerationNodeProgress(node: Node, progress: number) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.textGenState !== 'loading') return
  data.textGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  setNodeData(node, data)
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
  delete data.generationTaskId
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
  delete data.generationTaskId

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function updateGenerationNodeProgress(node: Node, progress: number) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.imageGenState !== 'loading') return
  data.imageGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  setNodeData(node, data)
}

export function applyGenerationResultToNode(
  node: Node,
  result: GenerationTaskResult,
  options: { title?: string; fileName?: string } = {},
) {
  const previewUrl = result.previewUrl?.trim()
  if (!previewUrl) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  delete data.imageGenState
  delete data.imageGenProgress
  delete data.imageGenTask
  delete data.generationTaskId
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
  }

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)

  if (!result.width || !result.height) {
    const img = new Image()
    img.onload = () => {
      if (!isNodeOnGraph(node)) return
      const current = { ...(node.getData() as CanvasNodeData) }
      if (current.previewUrl !== previewUrl) return
      current.mediaWidth = img.naturalWidth
      current.mediaHeight = img.naturalHeight
      setNodeData(node, current)
      syncNodeShapeFromData(node)
      const nextSize = getNodeSize(current.kind, current.mode, current)
      node.resize(nextSize.width, nextSize.height)
    }
    img.src = previewUrl
  }

  return true
}

export function markGenerationNodeFailed(node: Node, errorMessage?: string) {
  if (!isNodeOnGraph(node)) return
  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenState = 'idle'
  data.imageGenProgress = 0
  delete data.generationTaskId
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
    const raw = await api.getGenerationTask<GenerationTaskDetail>(taskId)
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
  return applyGenerationResultToNode(node, resolved, options)
}

function isImageResultApplied(node: Node) {
  const data = node.getData() as CanvasNodeData
  return Boolean(data.previewUrl?.trim()) && data.imageGenState !== 'loading'
}

function normalizeCreatedTask(raw: GenerationTaskDetail): GenerationTaskDetail {
  return normalizeGenerationTaskDetail(raw)
}

/** 在单个结果节点上独立创建、轮询并回写图片生成结果（支持轮询阶段提前返回） */
export async function runImageGenerationOnNode(
  node: Node,
  options: {
    title: string
    fileName: string
    createTask: () => Promise<GenerationTaskDetail>
    onError?: (message: string) => void
  },
): Promise<boolean> {
  if (!isNodeOnGraph(node)) return false

  let created: GenerationTaskDetail
  try {
    created = normalizeCreatedTask(await options.createTask())
  } catch (error) {
    markGenerationNodeFailed(node)
    options.onError?.(error instanceof Error ? error.message : '创建生成任务失败')
    return false
  }

  const taskId = created.id
  if (!taskId) {
    markGenerationNodeFailed(node, '创建生成任务失败')
    options.onError?.('创建生成任务失败')
    return false
  }

  bindGenerationTaskId(node, taskId)
  updateGenerationNodeProgress(node, created.progress ?? 5)

  let appliedDuringPoll = false
  let resolvingResult = false
  const applyOptions = { title: options.title, fileName: options.fileName }

  const tryApplyDuringPoll = (task: GenerationTaskDetail) => {
    if (appliedDuringPoll || resolvingResult || !isGenerationTaskTerminal(task.status)) return
    const raw = pickReadyImageResult(task)
    if (!raw) return

    resolvingResult = true
    void applyResolvedImageResultToNode(node, raw, applyOptions)
      .then((applied) => {
        if (applied) appliedDuringPoll = true
      })
      .finally(() => {
        resolvingResult = false
      })
  }

  try {
    const finalTask =
      created.status === 'SUCCEEDED'
        ? created
        : await pollGenerationTask(taskId, {
          onProgress: (task) => {
            if (!isNodeOnGraph(node)) return
            const data = node.getData() as CanvasNodeData
            if (data.imageGenState !== 'loading') return

            updateGenerationNodeProgress(node, task.progress ?? 0)
            tryApplyDuringPoll(task)
          },
        })

    if (!isNodeOnGraph(node)) return appliedDuringPoll

    while (resolvingResult) {
      await new Promise((resolve) => window.setTimeout(resolve, 40))
    }

    if (isImageResultApplied(node)) {
      clearGenerationTaskId(node)
      return true
    }

    if (finalTask.status !== 'SUCCEEDED') {
      const reason = finalTask.error?.message || '生成任务失败'
      markGenerationNodeFailed(node, reason)
      options.onError?.(reason)
      return false
    }

    const applied = await applyResolvedImageResultToNode(
      node,
      pickReadyImageResult(finalTask),
      applyOptions,
    )
    if (!applied) {
      markGenerationNodeFailed(node, '未返回结果图片')
      options.onError?.('生成完成，但未返回结果图片')
      return false
    }

    clearGenerationTaskId(node)
    return true
  } catch (error) {
    if (isNodeOnGraph(node) && !isImageResultApplied(node)) {
      markGenerationNodeFailed(node)
    }
    options.onError?.(error instanceof Error ? error.message : '生成失败，请稍后重试')
    return false
  }
}
