import axios from 'axios'
import { message } from 'ant-design-vue'
import type { Graph, Node } from '@antv/x6'
import api, { type AssetView, type UploadTicketResponse } from '@/services/api'
import { getToken } from '@/utils/request'
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

function isMockStorageUpload(ticket: UploadTicketResponse) {
  return ticket.uploadUrl.includes('/mock-files/upload')
}

async function uploadToStorage(
  file: File,
  ticket: UploadTicketResponse,
  onProgress?: (percent: number) => void,
) {
  if (isMockStorageUpload(ticket)) {
    onProgress?.(100)
    return
  }

  const headers: Record<string, string> = { ...(ticket.formFields ?? {}) }
  const token = getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const reportProgress = (loaded: number, total: number) => {
    if (!total) return
    onProgress?.(Math.min(100, Math.round((loaded / total) * 100)))
  }

  if (ticket.uploadMethod === 'POST') {
    const form = new FormData()
    Object.entries(ticket.formFields ?? {}).forEach(([key, value]) => {
      form.append(key, value)
    })
    form.append('file', file)

    await axios.post(ticket.uploadUrl, form, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      onUploadProgress: (event) => reportProgress(event.loaded, event.total ?? file.size),
      validateStatus: (status) => status >= 200 && status < 300,
    })
    return
  }

  await axios.put(ticket.uploadUrl, file, {
    headers,
    onUploadProgress: (event) => reportProgress(event.loaded, event.total ?? file.size),
    validateStatus: (status) => status >= 200 && status < 300,
  })
}

/** 申请上传凭证 → 直传存储 → 确认上传，返回素材访问地址。 */
export async function uploadAssetFile(
  file: File,
  options: UploadAssetOptions = {},
): Promise<UploadAssetResult> {
  const contentType = file.type || 'application/octet-stream'
  const projectId = resolveUploadProjectId(options.projectId)

  const ticket = await api.createAssetUploadTicket<UploadTicketResponse>({
    projectId,
    fileName: file.name,
    contentType,
    fileSize: file.size,
  })

  await uploadToStorage(file, ticket, options.onProgress)

  const asset = await api.completeAssetUpload<AssetView>({
    uploadTicket: ticket.uploadTicket,
    projectId,
    fileSize: file.size,
  })

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
