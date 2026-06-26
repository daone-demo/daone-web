import { message } from 'ant-design-vue'
import type { Graph, Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { syncGenNodesFromSource } from './imageGen'
import { syncTextNodesFromImageSource } from './textPrompt'
import { getNodeSize, syncNodeShapeFromData } from './graph'

export interface UploadAssetOptions {
  projectId?: string
  onProgress?: (percent: number) => void
}

export interface UploadAssetResult {
  url: string
  assetId: string
  width?: number | null
  height?: number | null
  durationSeconds?: number | null
}

export interface CanvasUploadResult {
  url: string
  assetId?: string
  width?: number | null
  height?: number | null
}

export type CanvasUploader = (
  file: File,
  onProgress?: (percent: number) => void,
) => Promise<CanvasUploadResult>

let resolveProjectId: (() => string | undefined) | null = null
let canvasUploader: CanvasUploader | null = null

export function setCanvasUploadProjectId(getter: () => string | undefined) {
  resolveProjectId = getter
}

export function setCanvasUploader(uploader: CanvasUploader | null) {
  canvasUploader = uploader
}

function resolveUploadProjectId(projectId?: string) {
  return projectId || resolveProjectId?.() || undefined
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read file'))
        return
      }
      const base64 = result.split(',')[1]
      if (!base64) {
        reject(new Error('Failed to encode file'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** 上传本地文件到 OSS，返回素材访问地址。 */
export async function uploadAssetFile(
  file: File,
  options: UploadAssetOptions = {},
): Promise<UploadAssetResult> {
  const contentType = file.type || 'application/octet-stream'
  const projectId = resolveUploadProjectId(options.projectId)
  const fileBase64 = await fileToBase64(file)

  const asset = await api.createAssetUploadTicket(
    {
      projectId,
      fileName: file.name,
      contentType,
      fileSize: file.size,
      fileBase64,
    },
    {
      onUploadProgress: (event) => {
        if (!event.total) return
        options.onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      },
    },
  )

  return {
    url: asset.previewUrl,
    assetId: asset.id,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
  }
}

async function uploadCanvasFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CanvasUploadResult> {
  if (canvasUploader) {
    return canvasUploader(file, onProgress)
  }

  const result = await uploadAssetFile(file, { onProgress })
  return {
    url: result.url,
    assetId: result.assetId,
    width: result.width,
    height: result.height,
  }
}

export function runUploadSimulation(graphNode: Node, file: File) {
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'uploading'
  data.uploadProgress = 0
  data.fileName = file.name
  data.mode = 'editor'
  graphNode.setData(data)

  void uploadCanvasFile(file, (progress) => {
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    if (current.uploadState !== 'uploading') return
    current.uploadProgress = progress
    graphNode.setData(current)
  })
    .then((result) => finishUpload(graphNode, file, result))
    .catch((error) => {
      console.error('[Canvas] upload failed', error)
      message.error('上传失败，请稍后重试')
      const current = { ...(graphNode.getData() as CanvasNodeData) }
      current.uploadState = 'idle'
      current.uploadProgress = 0
      graphNode.setData(current)
    })
}

async function finishUpload(
  graphNode: Node,
  file: File,
  result: CanvasUploadResult,
) {
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = result.url
  data.mode = 'editor'

  if (result.width && result.height) {
    data.mediaWidth = result.width
    data.mediaHeight = result.height
    applyNodeMedia(graphNode, data)
    return
  }

  if (file.type.startsWith('image/')) {
    const img = new Image()
    img.onload = () => {
      data.mediaWidth = img.naturalWidth
      data.mediaHeight = img.naturalHeight
      applyNodeMedia(graphNode, data)
    }
    img.onerror = () => applyNodeMedia(graphNode, data)
    img.src = result.url
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
    video.src = result.url
    return
  }

  data.mediaWidth = 2560
  data.mediaHeight = 1440
  applyNodeMedia(graphNode, data)
}

export function applyRemoteImageToNode(
  graphNode: Node,
  payload: {
    previewUrl: string
    fileName?: string
    width?: number | null
    height?: number | null
  },
) {
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = payload.previewUrl
  data.mode = 'editor'
  data.fileName = payload.fileName || '图片'
  data.title = data.fileName

  if (payload.width && payload.height) {
    data.mediaWidth = payload.width
    data.mediaHeight = payload.height
    applyNodeMedia(graphNode, data)
    return
  }

  const img = new Image()
  img.onload = () => {
    data.mediaWidth = img.naturalWidth
    data.mediaHeight = img.naturalHeight
    applyNodeMedia(graphNode, data)
  }
  img.onerror = () => applyNodeMedia(graphNode, data)
  img.src = payload.previewUrl
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
