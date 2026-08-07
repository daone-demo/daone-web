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
let onCanvasUploadComplete: ((payload: CanvasUploadCompletePayload) => void) | null = null

export interface CanvasUploadCompletePayload {
  fileName: string
  kind?: CanvasNodeData['kind']
}

export function setCanvasNodeMutationCompleteHandler(handler: (() => void) | null) {
  onCanvasNodeMutationComplete = handler
}

export function setCanvasUploadCompleteHandler(
  handler: ((payload: CanvasUploadCompletePayload) => void) | null,
) {
  onCanvasUploadComplete = handler
}

function notifyCanvasNodeMutationComplete() {
  onCanvasNodeMutationComplete?.()
}

function notifyCanvasUploadComplete(payload: CanvasUploadCompletePayload) {
  onCanvasUploadComplete?.(payload)
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

function resolveAssetType(file: File): 'IMAGE' | 'VIDEO' | 'DOCUMENT' {
  if (file.type.startsWith('image/')) return 'IMAGE'
  if (file.type.startsWith('video/')) return 'VIDEO'
  return 'DOCUMENT'
}

function resolveCosAuthorization(ticket: Record<string, any>): string | undefined {
  const headers = ticket.headers
  return (
    ticket.authorization ||
    ticket.Authorization ||
    (headers && (headers.Authorization || headers.authorization)) ||
    undefined
  )
}

/** 按 Apifox binary 方式：PUT 原始文件二进制到 COS。 */
function putBinaryToOss(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })
    xhr.timeout = UPLOAD_HTTP_TIMEOUT
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(event.loaded, event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error(`OSS 上传失败: HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('OSS 上传网络错误'))
    xhr.ontimeout = () => reject(new Error('OSS 上传超时'))
    // Body = binary（与 Apifox binary 一致，直接发送 File）
    xhr.send(file)
  })
}

/** 将本地文件直传 OSS：申请凭证 → PUT 二进制 → 完成确认。 */
export async function uploadAssetFile(
  file: File,
  options: UploadAssetOptions = {},
): Promise<UploadAssetResult> {
  const contentType = file.type || 'application/octet-stream'
  const projectId = resolveUploadProjectId(options.projectId)
  const type = resolveAssetType(file)

  options.onProgress?.(mapUploadProgress(0, 0, 0))

  // 图一：申请直传凭证，拿到 PUT 目标与 objectKey / Authorization
  const ticket = await api.createAssetUploadCredentials({
    projectId,
    fileName: file.name,
    contentType,
    fileSize: file.size,
    type,
  })

  const putUrl = ticket.uploadUrl || ticket.previewUrl || ticket.url
  if (!putUrl) {
    throw new Error('上传凭证缺少 uploadUrl')
  }
  if (!ticket.objectKey) {
    throw new Error('上传凭证缺少 objectKey')
  }

  const authorization = resolveCosAuthorization(ticket)
  const putHeaders: Record<string, string> = {
    'Content-Type': contentType,
  }
  if (authorization) {
    putHeaders.Authorization = authorization
  }

  // 图二：PUT binary 直传 COS
  await putBinaryToOss(putUrl, file, putHeaders, (loaded, total) => {
    options.onProgress?.(mapUploadProgress(1, loaded, total || file.size))
  })

  options.onProgress?.(UPLOAD_XHR_MAX_PERCENT)

  // 图三：直传完成确认，objectKey 来自图一返回值
  const asset = await api.completeAssetCompleteUpload({
    projectId,
    fileName: file.name,
    contentType,
    fileSize: file.size,
    objectKey: ticket.objectKey,
    type,
  })

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
  if (data.kind === 'image' || data.kind === 'video') {
    delete data.generationTaskType
    delete data.generationTaskId
  }
  if (data.kind === 'image') {
    data.imageGenState = 'idle'
    data.imageGenProgress = 0
    delete data.imageGenTask
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
  if (data.kind === 'image' || data.kind === 'video') {
    delete data.generationTaskType
    delete data.generationTaskId
  }
  if (data.kind === 'image') {
    data.imageGenState = 'idle'
    data.imageGenProgress = 0
    delete data.imageGenTask
  }
  notifyCanvasUploadComplete({
    fileName: file.name || data.fileName || data.title || '文件',
    kind: data.kind,
  })
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
