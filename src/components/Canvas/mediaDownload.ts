import { toMediaProxyUrl } from './mediaProxy'

function buildFetchCandidates(url: string): string[] {
  const source = url.trim()
  if (!source) return []

  const candidates: string[] = []
  if (source.startsWith('blob:') || source.startsWith('data:') || source.startsWith('/')) {
    candidates.push(source)
    return candidates
  }

  const proxyUrl = toMediaProxyUrl(source)
  if (proxyUrl) candidates.push(proxyUrl)
  candidates.push(source)
  return [...new Set(candidates)]
}

function extensionFromMime(mime: string): string {
  const type = mime.toLowerCase().split(';')[0]?.trim() ?? ''
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'video/x-msvideo': '.avi',
  }
  return map[type] || ''
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url, window.location.href).pathname
    const match = pathname.match(/(\.[a-z0-9]{2,5})$/i)
    return match?.[1]?.toLowerCase() ?? ''
  } catch {
    return ''
  }
}

function ensureFileName(fileName: string | undefined, fallback: string, blob: Blob, sourceUrl: string) {
  const raw = (fileName || fallback).trim() || fallback
  if (/\.[a-z0-9]{2,5}$/i.test(raw)) return raw
  const ext = extensionFromMime(blob.type) || extensionFromUrl(sourceUrl) || ''
  return ext ? `${raw}${ext}` : raw
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-cache',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.blob()
}

/**
 * 下载画布图片/视频资源。
 * 跨域 OSS 优先走同源 /media-proxy，再回退直连；同域/blob/data 直接拉取。
 */
export async function downloadCanvasMedia(options: {
  url: string
  fileName?: string
  fallbackName: string
}): Promise<void> {
  const sourceUrl = options.url.trim()
  if (!sourceUrl) {
    throw new Error('无可下载资源')
  }

  // data: 可直接触发，避免超大 dataURL 再走 fetch
  if (sourceUrl.startsWith('data:')) {
    const anchor = document.createElement('a')
    anchor.href = sourceUrl
    anchor.download = options.fileName || options.fallbackName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    return
  }

  const candidates = buildFetchCandidates(sourceUrl)
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      const blob = await fetchBlob(candidate)
      const fileName = ensureFileName(options.fileName, options.fallbackName, blob, sourceUrl)
      triggerBlobDownload(blob, fileName)
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('下载失败')
}
