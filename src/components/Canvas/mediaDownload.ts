import { resolveOriginalMediaDownloadUrl } from './cloudImageProcess'
import { runWithoutLeaveConfirm } from '@/utils/leaveGuard'

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

function triggerLinkDownload(url: string, fileName: string, openInNewTab = false) {
  const anchor = document.createElement('a')
  anchor.href = url
  if (!openInNewTab) {
    anchor.download = fileName
  } else {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
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
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`download failed: ${response.status}`)
      }
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      try {
        triggerLinkDownload(blobUrl, fileName)
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      }
    } catch {
      // 跨域或拉取失败时在新标签页打开，避免当前 SPA 页面跳转
      triggerLinkDownload(downloadUrl, fileName, true)
    }
  })
}
