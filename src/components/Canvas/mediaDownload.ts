import { resolveOriginalMediaDownloadUrl } from './cloudImageProcess'

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
  return fileNameFromUrl(downloadUrl) || fileName?.trim() || fallbackName
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

/** 通过资源链接触发浏览器下载（<a download>） */
export async function downloadCanvasMedia(options: {
  url: string
  fileName?: string
  fallbackName: string
}): Promise<void> {
  const sourceUrl = options.url.trim()
  if (!sourceUrl) {
    throw new Error('无可下载资源')
  }

  const downloadUrl = resolveOriginalMediaDownloadUrl(sourceUrl)
  const fileName = resolveDownloadFileName(downloadUrl, options.fileName, options.fallbackName)
  triggerLinkDownload(downloadUrl, fileName)
}
