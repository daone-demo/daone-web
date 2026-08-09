import JSZip from 'jszip'
import { resolveOriginalMediaDownloadUrl } from './cloudImageProcess'
import { buildMediaProxyCandidates } from './mediaProxy'
import { runWithoutLeaveConfirm } from '@/utils/leaveGuard'
import type { CanvasNodeData, NodeKind } from './constants'

const DOWNLOADABLE_MEDIA_KINDS = new Set<NodeKind>(['image', 'video', 'model3d', 'audio'])

const DEFAULT_MEDIA_EXTENSIONS: Record<NodeKind, string> = {
  image: '.png',
  video: '.mp4',
  model3d: '.glb',
  audio: '.mp3',
  text: '.txt',
}

export interface CanvasMediaDownloadItem {
  url: string
  fileName: string
}

export interface CanvasMediaBatchDownloadResult {
  total: number
  success: number
  failed: number
  packagedAsZip: boolean
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, window.location.href).pathname
    const base = pathname.split('/').pop() || ''
    return decodeURIComponent(base.split('?')[0] || '').trim()
  } catch {
    return ''
  }
}

function resolveDownloadFileName(
  downloadUrl: string,
  fileName: string | undefined,
  fallbackName: string,
): string {
  return fileName?.trim() || fileNameFromUrl(downloadUrl) || fallbackName
}

function sanitizeDownloadFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function ensureFileExtension(name: string, kind: NodeKind): string {
  const trimmed = sanitizeDownloadFileName(name)
  if (!trimmed) return `canvas-${kind}${DEFAULT_MEDIA_EXTENSIONS[kind] || ''}`
  if (/\.[a-z0-9]{2,5}$/i.test(trimmed)) return trimmed
  return `${trimmed}${DEFAULT_MEDIA_EXTENSIONS[kind] || ''}`
}

function uniqueDownloadFileName(name: string, used: Set<string>): string {
  const normalized = sanitizeDownloadFileName(name)
  if (!used.has(normalized.toLowerCase())) {
    used.add(normalized.toLowerCase())
    return normalized
  }

  const dot = normalized.lastIndexOf('.')
  const base = dot > 0 ? normalized.slice(0, dot) : normalized
  const ext = dot > 0 ? normalized.slice(dot) : ''

  let index = 2
  while (used.has(`${base} (${index})${ext}`.toLowerCase())) {
    index += 1
  }

  const next = `${base} (${index})${ext}`
  used.add(next.toLowerCase())
  return next
}

function buildDownloadFetchCandidates(sourceUrl: string): string[] {
  const downloadUrl = resolveOriginalMediaDownloadUrl(sourceUrl)
  const proxies = buildMediaProxyCandidates(downloadUrl)
  // 优先同源代理，避免生产环境直连对象存储触发 CORS
  return [...new Set([...proxies, downloadUrl].filter(Boolean))]
}

function formatBatchZipName() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `画布批量下载-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`
}

export function isDownloadableCanvasNode(data?: Partial<CanvasNodeData> | null): data is CanvasNodeData {
  if (!data?.previewUrl?.trim()) return false
  if (!data.kind || !DOWNLOADABLE_MEDIA_KINDS.has(data.kind)) return false
  if (data.uploadState === 'uploading') return false
  if (data.imageGenState === 'loading') return false
  return true
}

export function resolveCanvasMediaFileName(
  data: CanvasNodeData,
  index: number,
  usedNames = new Set<string>(),
): string {
  const preferred = data.fileName?.trim() || data.title?.trim()
  const fallback = `canvas-${data.kind}-${index + 1}${DEFAULT_MEDIA_EXTENSIONS[data.kind] || ''}`
  const withExt = ensureFileExtension(preferred || fallback, data.kind)
  return uniqueDownloadFileName(withExt, usedNames)
}

export function buildCanvasMediaDownloadItems(
  nodes: CanvasNodeData[],
): CanvasMediaDownloadItem[] {
  const usedNames = new Set<string>()
  return nodes
    .filter(isDownloadableCanvasNode)
    .map((data, index) => ({
      url: data.previewUrl,
      fileName: resolveCanvasMediaFileName(data, index, usedNames),
    }))
}

function triggerLinkDownload(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

const INVALID_DOWNLOAD_CONTENT_TYPE_RE = /text\/html|application\/json|text\/plain/i

function isValidMediaDownloadContentType(contentType: string, blob: Blob): boolean {
  const type = (contentType || blob.type || '').toLowerCase()
  if (!type) return blob.size > 0
  if (INVALID_DOWNLOAD_CONTENT_TYPE_RE.test(type)) return false
  if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) return true
  if (type.includes('octet-stream') || type.includes('gltf') || type.includes('model')) return true
  return false
}

async function assertValidMediaBlob(blob: Blob, contentType: string) {
  if (!blob.size) {
    throw new Error('empty media response')
  }
  if (!isValidMediaDownloadContentType(contentType, blob)) {
    throw new Error(`invalid media content-type: ${contentType || blob.type || 'unknown'}`)
  }

  const header = new Uint8Array(await blob.slice(0, 64).arrayBuffer())
  const prefix = String.fromCharCode(...header).trimStart().toLowerCase()
  if (prefix.startsWith('<!doctype') || prefix.startsWith('<html') || prefix.startsWith('{')) {
    throw new Error('invalid media response: html/json payload')
  }
}

async function readResponseBlob(response: Response): Promise<Blob> {
  const contentType = response.headers.get('content-type') || ''
  const blob = await response.blob()
  await assertValidMediaBlob(blob, contentType)
  return blob
}

/** 浏览器直连资源地址下载，不依赖 fetch/CORS，用于 media-proxy 未配置的生产环境 */
function triggerDirectResourceDownload(url: string, fileName: string) {
  triggerLinkDownload(url, fileName)
}

async function fetchMediaBlob(sourceUrl: string): Promise<Blob> {
  const trimmed = sourceUrl.trim()
  if (!trimmed) {
    throw new Error('无可下载资源')
  }

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    const response = await fetch(trimmed)
    if (!response.ok) {
      throw new Error(`download failed: ${response.status}`)
    }
    return readResponseBlob(response)
  }

  const candidates = buildDownloadFetchCandidates(trimmed)

  let lastError: unknown
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate)
      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`)
      }
      return await readResponseBlob(response)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('download failed')
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob)
  try {
    triggerLinkDownload(blobUrl, fileName)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  }
}

/** fetch 失败时逐个触发浏览器直连下载（不依赖 CORS，但无法打包 zip） */
async function downloadBatchViaDirectLinks(items: CanvasMediaDownloadItem[]): Promise<number> {
  let success = 0
  await runWithoutLeaveConfirm(async () => {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const sourceUrl = item.url.trim()
      if (!sourceUrl) continue
      const downloadUrl = resolveOriginalMediaDownloadUrl(sourceUrl)
      const fileName = resolveDownloadFileName(downloadUrl, item.fileName, item.fileName)
      try {
        triggerDirectResourceDownload(downloadUrl, fileName)
        success += 1
      } catch {
        // ignore
      }
      if (index < items.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 350))
      }
    }
  })
  return success
}

/** 通过资源链接触发浏览器下载，避免当前页跳转触发离开确认 */
export async function downloadCanvasMedia(options: {
  url: string
  fileName?: string
  fallbackName: string
}): Promise<void> {
  await runWithoutLeaveConfirm(async () => {
    const sourceUrl = options.url.trim()
    if (!sourceUrl) {
      throw new Error('无可下载资源')
    }

    const downloadUrl = resolveOriginalMediaDownloadUrl(sourceUrl)
    const fileName = resolveDownloadFileName(downloadUrl, options.fileName, options.fallbackName)

    try {
      const blob = await fetchMediaBlob(sourceUrl)
      triggerBlobDownload(blob, fileName)
    } catch {
      // 生产 nginx 未配置 /media-proxy 时会返回 index.html；直连 OSS 不经过 fetch，可正常下载
      triggerDirectResourceDownload(downloadUrl, fileName)
    }
  })
}

export async function downloadCanvasMediaBatch(
  items: CanvasMediaDownloadItem[],
  options: {
    onProgress?: (current: number, total: number) => void
  } = {},
): Promise<CanvasMediaBatchDownloadResult> {
  const total = items.length
  if (!total) {
    return { total: 0, success: 0, failed: 0, packagedAsZip: false }
  }

  if (total === 1) {
    try {
      await downloadCanvasMedia({
        url: items[0].url,
        fileName: items[0].fileName,
        fallbackName: items[0].fileName,
      })
      options.onProgress?.(1, 1)
      return { total: 1, success: 1, failed: 0, packagedAsZip: false }
    } catch {
      return { total: 1, success: 0, failed: 1, packagedAsZip: false }
    }
  }

  const zip = new JSZip()
  let success = 0
  const failedItems: CanvasMediaDownloadItem[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    options.onProgress?.(index, total)
    try {
      const blob = await fetchMediaBlob(item.url)
      zip.file(item.fileName, blob)
      success += 1
    } catch {
      failedItems.push(item)
    }
  }

  options.onProgress?.(total, total)

  if (success > 0) {
    await runWithoutLeaveConfirm(async () => {
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      triggerBlobDownload(zipBlob, formatBatchZipName())
    })

    if (failedItems.length) {
      const directSuccess = await downloadBatchViaDirectLinks(failedItems)
      return {
        total,
        success: success + directSuccess,
        failed: total - success - directSuccess,
        packagedAsZip: true,
      }
    }

    return { total, success, failed: 0, packagedAsZip: true }
  }

  const directSuccess = await downloadBatchViaDirectLinks(items)
  return {
    total,
    success: directSuccess,
    failed: total - directSuccess,
    packagedAsZip: false,
  }
}
