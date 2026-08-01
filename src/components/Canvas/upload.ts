import { message } from 'ant-design-vue'
import type { Graph, Node } from '@antv/x6'
import api from '@/services/api'
import type { CanvasNodeData } from './constants'
import { syncGenNodesFromSource } from './imageGen'
import { syncTextNodesFromImageSource } from './textPrompt'
import { getNodeSize, syncNodeShapeFromData } from './graph'
import { loadDrawableImage } from './drawableImage'
import { resolveImageNaturalSizeCached } from './imageDisplayUrl'

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
  durationSeconds?: number | null
}

export type CanvasUploader = (
  file: File,
  onProgress?: (percent: number) => void,
) => Promise<CanvasUploadResult>

let resolveProjectId: (() => string | undefined) | null = null
let canvasUploader: CanvasUploader | null = null
let onCanvasNodeMutationComplete: (() => void) | null = null

export function setCanvasNodeMutationCompleteHandler(handler: (() => void) | null) {
  onCanvasNodeMutationComplete = handler
}

function notifyCanvasNodeMutationComplete() {
  onCanvasNodeMutationComplete?.()
}

/** 文件读取阶段占用的进度上限 */
const UPLOAD_READ_MAX_PERCENT = 20
/** 请求发送阶段进度上限（保留余量等待服务端响应） */
const UPLOAD_XHR_MAX_PERCENT = 95
/** 文件上传接口超时：5 分钟（其余接口仍使用全局默认超时） */
const UPLOAD_HTTP_TIMEOUT = 5 * 60 * 1000

function mapUploadProgress(readRatio: number, xhrLoaded: number, xhrTotal: number) {
  const readPart = Math.min(1, Math.max(0, readRatio)) * UPLOAD_READ_MAX_PERCENT
  if (!xhrTotal) {
    return Math.min(UPLOAD_XHR_MAX_PERCENT, Math.round(readPart))
  }
  const xhrRatio = Math.min(1, Math.max(0, xhrLoaded / xhrTotal))
  const xhrPart = xhrRatio * (UPLOAD_XHR_MAX_PERCENT - UPLOAD_READ_MAX_PERCENT)
  return Math.min(UPLOAD_XHR_MAX_PERCENT, Math.round(readPart + xhrPart))
}

export function setCanvasUploadProjectId(getter: () => string | undefined) {
  resolveProjectId = getter
}

export function setCanvasUploader(uploader: CanvasUploader | null) {
  canvasUploader = uploader
}

function resolveUploadProjectId(projectId?: string) {
  return projectId || resolveProjectId?.() || undefined
}

function fileToBase64(file: File, onReadProgress?: (ratio: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    let lastRatio = 0

    reader.onprogress = (event) => {
      if (!event.lengthComputable) return
      const ratio = event.loaded / event.total
      if (ratio <= lastRatio) return
      lastRatio = ratio
      onReadProgress?.(ratio)
    }

    reader.onload = () => {
      onReadProgress?.(1)
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
    onReadProgress?.(0)
    reader.readAsDataURL(file)
  })
}

/** 将预览地址（blob / data / http）转为可上传的 File，fetch 失败时回退 canvas 绘制 */
export async function previewUrlToUploadFile(
  previewUrl: string,
  fileName: string,
  naturalSize?: { width?: number; height?: number },
): Promise<File> {
  try {
    const response = await fetch(previewUrl)
    if (response.ok) {
      const blob = await response.blob()
      if (blob.size > 0) {
        return new File([blob], fileName, { type: blob.type || 'image/png' })
      }
    }
  } catch {
    // fall through to canvas
  }

  const { img, revoke } = await loadDrawableImage(previewUrl)
  try {
    const width = naturalSize?.width || img.naturalWidth || img.width
    const height = naturalSize?.height || img.naturalHeight || img.height
    if (!width || !height) {
      throw new Error('图片尺寸无效')
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器不支持 Canvas')
    ctx.drawImage(img, 0, 0, width, height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('图片编码失败'))
      }, 'image/png')
    })
    return new File([blob], fileName, { type: 'image/png' })
  } finally {
    revoke?.()
  }
}

function readVideoSizeFromFile(
  file: File,
): Promise<{ width: number; height: number; durationSeconds?: number } | null> {
  if (!file.type.startsWith('video/')) return Promise.resolve(null)

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    video.onloadedmetadata = () => {
      cleanup()
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds:
            Number.isFinite(video.duration) && video.duration > 0
              ? Math.round(video.duration * 10) / 10
              : undefined,
        })
        return
      }
      resolve(null)
    }

    video.onerror = () => {
      cleanup()
      resolve(null)
    }

    video.src = objectUrl
  })
}

export function resolveVideoNaturalSize(
  previewUrl: string,
): Promise<{ width: number; height: number; durationSeconds?: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSeconds:
            Number.isFinite(video.duration) && video.duration > 0
              ? Math.round(video.duration * 10) / 10
              : undefined,
        })
        return
      }
      reject(new Error('Failed to read video metadata'))
    }
    video.onerror = () => reject(new Error('Failed to load video metadata'))
    video.src = previewUrl
  })
}

export function resolveImageNaturalSize(
  previewUrl: string,
): Promise<{ width: number; height: number }> {
  return resolveImageNaturalSizeCached(previewUrl)
}

function readImageSizeFromFile(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return Promise.resolve(null)

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    image.onload = () => {
      cleanup()
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (width > 0 && height > 0) {
        resolve({ width, height })
        return
      }
      resolve(null)
    }

    image.onerror = () => {
      cleanup()
      resolve(null)
    }

    image.src = objectUrl
  })
}

async function ensureImageMediaDimensions(
  data: CanvasNodeData,
  file: File,
  previewUrl: string,
) {
  if (data.mediaWidth! > 0 && data.mediaHeight! > 0) return

  const fromFile = await readImageSizeFromFile(file)
  if (fromFile) {
    data.mediaWidth = fromFile.width
    data.mediaHeight = fromFile.height
    return
  }

  try {
    const size = await resolveImageNaturalSizeCached(previewUrl)
    data.mediaWidth = size.width
    data.mediaHeight = size.height
  } catch {
    // 保留当前尺寸，避免阻塞上传完成
  }
}

/** 上传本地文件到 OSS，返回素材访问地址。 */
export async function uploadAssetFile(
  file: File,
  options: UploadAssetOptions = {},
): Promise<UploadAssetResult> {
  const contentType = file.type || 'application/octet-stream'
  const projectId = resolveUploadProjectId(options.projectId)

  const fileBase64 = await fileToBase64(file, (readRatio) => {
    options.onProgress?.(mapUploadProgress(readRatio, 0, 0))
  })

  const asset = await api.createAssetUploadTicket(
    {
      projectId,
      fileName: file.name,
      contentType,
      fileSize: file.size,
      fileBase64,
    },
    {
      timeout: UPLOAD_HTTP_TIMEOUT,
      onUploadProgress: (event) => {
        const total = event.total ?? 0
        if (!total) return
        options.onProgress?.(mapUploadProgress(1, event.loaded, total))
      },
    },
  )

  return {
    url: asset.previewUrl || asset.url || '',
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
    durationSeconds: result.durationSeconds,
  }
}

export async function runUploadSimulation(graphNode: Node, file: File) {
  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'uploading'
  data.uploadProgress = 0
  data.fileName = file.name
  data.mode = 'editor'
  if (data.kind === 'video') {
    delete data.generationTaskType
    delete data.generationTaskId
  }

  if (file.type.startsWith('image/')) {
    const size = await readImageSizeFromFile(file)
    if (size) {
      data.mediaWidth = size.width
      data.mediaHeight = size.height
    }
  }

  if (file.type.startsWith('video/')) {
    const size = await readVideoSizeFromFile(file)
    if (size) {
      data.mediaWidth = size.width
      data.mediaHeight = size.height
      if (size.durationSeconds) {
        data.durationSeconds = size.durationSeconds
      }
    }
  }

  graphNode.setData(data)

  void uploadCanvasFile(file, (progress) => {
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    if (current.uploadState !== 'uploading') return
    current.uploadProgress = Math.min(99, progress)
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
  const previewUrl = result.url?.trim()
  if (!previewUrl) {
    console.error('[Canvas] upload succeeded but missing preview url', result)
    message.error('上传成功但未返回资源地址')
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    current.uploadState = 'idle'
    current.uploadProgress = 0
    graphNode.setData(current)
    return
  }

  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.mode = 'editor'
  if (result.assetId) {
    data.assetId = result.assetId
  }

  if (result.width && result.height) {
    data.mediaWidth = result.width
    data.mediaHeight = result.height
  }
  if (result.durationSeconds && result.durationSeconds > 0) {
    data.durationSeconds = result.durationSeconds
  }

  if (file.type.startsWith('image/')) {
    await ensureImageMediaDimensions(data, file, previewUrl)
    applyNodeMedia(graphNode, data)
    notifyCanvasNodeMutationComplete()
    return
  }

  applyNodeMedia(graphNode, data)
  notifyCanvasNodeMutationComplete()

  if (result.width && result.height) return

  if (file.type.startsWith('video/')) {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const current = { ...(graphNode.getData() as CanvasNodeData) }
      if (current.previewUrl !== previewUrl) return
      current.mediaWidth = video.videoWidth || 2560
      current.mediaHeight = video.videoHeight || 1440
      if (Number.isFinite(video.duration) && video.duration > 0) {
        current.durationSeconds = Math.round(video.duration * 10) / 10
      }
      applyNodeMedia(graphNode, current)
      notifyCanvasNodeMutationComplete()
    }
    video.onerror = () => {
      const current = { ...(graphNode.getData() as CanvasNodeData) }
      if (current.previewUrl !== previewUrl) return
      current.mediaWidth = 2560
      current.mediaHeight = 1440
      applyNodeMedia(graphNode, current)
      notifyCanvasNodeMutationComplete()
    }
    video.src = previewUrl
    return
  }

  const current = { ...(graphNode.getData() as CanvasNodeData) }
  if (current.previewUrl !== previewUrl) return
  current.mediaWidth = current.mediaWidth || 2560
  current.mediaHeight = current.mediaHeight || 1440
  applyNodeMedia(graphNode, current)
}

export async function applyRemoteImageToNode(
  graphNode: Node,
  payload: {
    assetId?: string
    previewUrl: string
    fileName?: string
    width?: number | null
    height?: number | null
  },
) {
  const previewUrl = payload.previewUrl?.trim()
  if (!previewUrl) return

  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.mode = 'editor'
  data.fileName = payload.fileName || '图片'
  data.title = data.fileName
  if (payload.assetId) {
    data.assetId = payload.assetId
  }

  if (payload.width && payload.height) {
    data.mediaWidth = payload.width
    data.mediaHeight = payload.height
    applyNodeMedia(graphNode, data)
    return
  }

  applyNodeMedia(graphNode, data)

  try {
    const size = await resolveImageNaturalSizeCached(previewUrl)
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    if (current.previewUrl?.trim() !== previewUrl) return
    if (current.mediaWidth && current.mediaHeight) return
    current.mediaWidth = size.width
    current.mediaHeight = size.height
    applyNodeMedia(graphNode, current)
  } catch {
    // ImageNode 会在 <img> onload 时再次尝试补全尺寸
  }
}

export async function applyRemoteVideoToNode(
  graphNode: Node,
  payload: {
    assetId?: string
    previewUrl: string
    fileName?: string
    width?: number | null
    height?: number | null
  },
) {
  const previewUrl = payload.previewUrl?.trim()
  if (!previewUrl) return

  const data = { ...(graphNode.getData() as CanvasNodeData) }
  data.uploadState = 'done'
  data.uploadProgress = 100
  data.previewUrl = previewUrl
  data.mode = 'editor'
  data.fileName = payload.fileName || '视频'
  data.title = data.fileName
  if (payload.assetId) {
    data.assetId = payload.assetId
  }
  delete data.generationTaskType
  delete data.generationTaskId

  if (payload.width && payload.height) {
    data.mediaWidth = payload.width
    data.mediaHeight = payload.height
  }

  applyNodeMedia(graphNode, data)

  if (payload.width && payload.height) return

  try {
    const size = await resolveVideoNaturalSize(previewUrl)
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    if (current.previewUrl !== previewUrl) return
    current.mediaWidth = size.width
    current.mediaHeight = size.height
    if (size.durationSeconds) {
      current.durationSeconds = size.durationSeconds
    }
    applyNodeMedia(graphNode, current)
  } catch {
    const current = { ...(graphNode.getData() as CanvasNodeData) }
    if (current.previewUrl !== previewUrl) return
    current.mediaWidth = current.mediaWidth || 2560
    current.mediaHeight = current.mediaHeight || 1440
    applyNodeMedia(graphNode, current)
  }
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
