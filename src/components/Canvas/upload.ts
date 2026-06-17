import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { syncGenNodesFromSource } from './imageGen'
import { syncTextNodesFromImageSource } from './textPrompt'
import { getNodeSize, syncNodeShapeFromData } from './graph'

export interface CanvasUploadResult {
  /** 资源可访问地址（真实接口返回的 URL，或本地预览 URL） */
  url: string
}

export type CanvasUploader = (
  file: File,
  onProgress?: (percent: number) => void,
) => Promise<CanvasUploadResult>

/**
 * 上传接口接入点（预留口子）。
 * 默认实现为本地模拟：不依赖后端，使用 Object URL 生成预览地址。
 * 后续接入真实接口时，调用 `setCanvasUploader` 注入即可，无需改动节点组件与画布逻辑。
 *
 * @example
 * setCanvasUploader(async (file, onProgress) => {
 *   const form = new FormData()
 *   form.append('file', file)
 *   const { data } = await http.post('/api/upload', form, {
 *     onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
 *   })
 *   return { url: data.url }
 * })
 */
let canvasUploader: CanvasUploader | null = null

export function setCanvasUploader(uploader: CanvasUploader | null) {
  canvasUploader = uploader
}

/** 执行上传：有真实接口则走接口，否则回退到本地预览（mock）。 */
async function uploadCanvasFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CanvasUploadResult> {
  if (canvasUploader) {
    return canvasUploader(file, onProgress)
  }
  // TODO: 真实上传接口未接入，先返回本地预览地址。
  return { url: URL.createObjectURL(file) }
}

export function runUploadSimulation(graphNode: Node, file: File) {
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'uploading'
  data.uploadProgress = 0
  data.fileName = file.name
  data.mode = 'editor'
  graphNode.setData(data)

  const duration = file.size > 8_000_000 ? 3200 : file.type.startsWith('video/') ? 2400 : 1600
  const start = Date.now()

  const timer = window.setInterval(() => {
    const elapsed = Date.now() - start
    const progress = Math.min(100, Math.round((elapsed / duration) * 100))
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    current.uploadProgress = progress
    graphNode.setData(current)

    if (progress >= 100) {
      window.clearInterval(timer)
      void finishUpload(graphNode, file)
    }
  }, 60)
}

async function finishUpload(graphNode: Node, file: File) {
  const { url } = await uploadCanvasFile(file)
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = url
  data.mode = 'editor'

  if (file.type.startsWith('image/')) {
    const img = new Image()
    img.onload = () => {
      data.mediaWidth = img.naturalWidth
      data.mediaHeight = img.naturalHeight
      applyNodeMedia(graphNode, data)
    }
    img.src = url
    return
  }

  if (file.type.startsWith('video/')) {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      data.mediaWidth = video.videoWidth || 2560
      data.mediaHeight = video.videoHeight || 1440
      applyNodeMedia(graphNode, data)
    }
    video.onerror = () => {
      data.mediaWidth = 2560
      data.mediaHeight = 1440
      applyNodeMedia(graphNode, data)
    }
    video.src = url
    return
  }

  data.mediaWidth = 2560
  data.mediaHeight = 1440
  applyNodeMedia(graphNode, data)
}

function applyNodeMedia(graphNode: Node, data: CanvasNodeData) {
  if (data.imageGenTask === 'picker') {
    data.imageGenTask = undefined
  }
  graphNode.setData(data)
  syncNodeShapeFromData(graphNode)
  const size = getNodeSize(data.kind, data.mode, data)
  graphNode.resize(size.width, size.height)

  const graph = graphNode.model?.graph as Graph | undefined
  if (graph && !data.imageGenTask) {
    syncGenNodesFromSource(graph, graphNode)
    syncTextNodesFromImageSource(graph, graphNode)
  }
}
