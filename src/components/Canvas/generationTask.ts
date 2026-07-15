import type { Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { syncNodeShapeFromData, getNodeSize } from './graph'

export type GenerationTaskResult = {
  assetId?: string
  type?: string
  previewUrl?: string
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

export function pickPrimaryGenerationResult(task: GenerationTaskDetail): GenerationTaskResult | null {
  const results = task.results?.filter((item) => item.previewUrl || item.assetId) ?? []
  return results[0] ?? null
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

export function updateTextGenerationNodeProgress(node: Node, progress: number) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.textGenState !== 'loading') return
  data.textGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  node.setData(data)
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
  node.setData(data)
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
  node.setData(data)
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

  node.setData(data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function updateGenerationNodeProgress(node: Node, progress: number) {
  const data = { ...(node.getData() as CanvasNodeData) }
  if (data.imageGenState !== 'loading') return
  data.imageGenProgress = Math.max(0, Math.min(100, Math.round(progress)))
  node.setData(data)
}

export function applyGenerationResultToNode(
  node: Node,
  result: GenerationTaskResult,
  options: { title?: string; fileName?: string } = {},
) {
  const previewUrl = result.previewUrl?.trim()
  if (!previewUrl) return false

  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenState = 'done'
  data.imageGenProgress = 100
  data.imageGenTask = undefined
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

  node.setData(data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)

  if (!result.width || !result.height) {
    const img = new Image()
    img.onload = () => {
      const current = { ...(node.getData() as CanvasNodeData) }
      if (current.previewUrl !== previewUrl) return
      current.mediaWidth = img.naturalWidth
      current.mediaHeight = img.naturalHeight
      node.setData(current)
      syncNodeShapeFromData(node)
      const nextSize = getNodeSize(current.kind, current.mode, current)
      node.resize(nextSize.width, nextSize.height)
    }
    img.src = previewUrl
  }

  return true
}

export function markGenerationNodeFailed(node: Node, errorMessage?: string) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.imageGenState = 'idle'
  data.imageGenProgress = 0
  data.title = errorMessage ? `生成失败` : data.title
  node.setData(data)
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
    const task = await api.getGenerationTask<GenerationTaskDetail>(taskId)
    options.onProgress?.(task)

    if (isGenerationTaskTerminal(task.status)) {
      return task
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
  }

  throw new Error('生成任务超时，请稍后在任务列表中查看')
}
