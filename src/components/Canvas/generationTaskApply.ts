import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { normalizeGenerationFailMessage, parseVideoAspectRatioValue } from './constants'
import { resolveImageNaturalSizeCached } from './imageDisplayUrl'
import { syncNodeShapeFromData, getNodeSize, refreshCanvasNodeView } from './graph'
import { resolveVideoNaturalSize } from './upload'
import type { GenerationTaskResult } from './generationTaskTypes'
import {
  isGenerationProgressTitle,
  resolveGenerationResultTitle,
  resolveGenerationResultTitleWithFallback,
} from './generationTaskTitles'

export function setNodeData(node: Node, data: CanvasNodeData) {
  node.setData(data, { overwrite: true })
}

export function isNodeOnGraph(node: Node) {
  return Boolean(node.model?.graph)
}

export function getNodeGraph(node: Node): Graph | null {
  return (node.model?.graph as Graph | undefined) ?? null
}

export type GenerationProgressSyncOptions = {
  forceRefreshView?: boolean
}

function refreshGenerationNodeView(node: Node, forceRefreshView?: boolean) {
  if (!forceRefreshView) return
  const graph = getNodeGraph(node)
  if (graph) refreshCanvasNodeView(graph, node)
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
  data.title = resolveGenerationResultTitleWithFallback(
    '反推提示词',
    options.title,
    data.generationTaskName,
    data.title,
  )
  data.content = options.toHtml ? options.toHtml(text) : text
  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function markTextGenerationNodeFailed(node: Node, errorMessage?: string) {
  const data = { ...(node.getData() as CanvasNodeData) }
  data.textGenState = 'failed'
  data.textGenProgress = 0
  data.title = '生成失败'
  data.generationFailMessage = normalizeGenerationFailMessage(errorMessage)
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
  data.title = resolveGenerationResultTitleWithFallback(
    '文生视频',
    options.title,
    data.generationTaskName,
    data.title,
  )
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
      const ratio = data.videoGenAspectRatio || data.videoDialogueSettings?.aspectRatio
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
  data.title = '生成失败'
  data.generationFailMessage = normalizeGenerationFailMessage(errorMessage)
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
  data.title = resolveGenerationResultTitleWithFallback(
    '3D 模型',
    options.title,
    data.generationTaskName,
    data.title,
  )
  data.fileName =
    options.fileName ||
    result.fileName ||
    data.fileName ||
    previewUrl.split('/').pop()?.split('?')[0] ||
    'model.glb'
  data.mediaWidth = data.mediaWidth || 320
  data.mediaHeight = data.mediaHeight || 360

  setNodeData(node, data)
  syncNodeShapeFromData(node)
  const size = getNodeSize(data.kind, data.mode, data)
  node.resize(size.width, size.height)
  return true
}

export function updateGenerationNodeProgress(
  node: Node,
  progress: number,
  options: GenerationProgressSyncOptions = {},
) {
  if (!isNodeOnGraph(node)) return
  const rounded = Math.max(0, Math.min(100, Math.round(progress)))
  const data = node.getData() as CanvasNodeData
  if (data.imageGenState !== 'loading') return
  if (data.imageGenProgress === rounded) return

  const next = { ...data, imageGenProgress: rounded }
  setNodeData(node, next)
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
  data.title = resolveGenerationResultTitle(options.title, data.generationTaskName, data.title)
  if (!isGenerationProgressTitle(data.title)) {
    data.generationTaskName = data.title
  }
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

  const displayWidth = node.getSize().width
  delete data.editorWidth
  delete data.editorHeight
  delete data.viewScale
  if (data.mediaWidth && data.mediaHeight && displayWidth > 0) {
    data.editorWidth = displayWidth
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
  data.imageGenState = 'failed'
  data.imageGenProgress = 0
  data.title = '生成失败'
  data.generationFailMessage = normalizeGenerationFailMessage(errorMessage)
  setNodeData(node, data)
}
