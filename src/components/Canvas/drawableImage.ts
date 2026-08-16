import { mintMediaProxyCandidates } from './mediaProxy'

function loadImageElement(url: string, crossOrigin?: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image element load failed'))
    img.src = url
  })
}

function isCrossOriginUrl(url: string) {
  try {
    return new URL(url, window.location.href).origin !== window.location.origin
  } catch {
    return true
  }
}

function isDrawableResponse(contentType: string, blob: Blob) {
  const type = contentType.toLowerCase()
  if (type.includes('image/')) return true
  if (type.includes('application/octet-stream') && blob.type.startsWith('image/')) return true
  return blob.type.startsWith('image/')
}

async function fetchAsObjectUrl(url: string): Promise<{ objectUrl: string; revoke: () => void }> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'reload',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  const blob = await response.blob()
  if (!isDrawableResponse(contentType, blob)) {
    throw new Error(`unexpected content-type: ${contentType || blob.type || 'unknown'}`)
  }
  const objectUrl = URL.createObjectURL(blob)
  return {
    objectUrl,
    revoke: () => URL.revokeObjectURL(objectUrl),
  }
}

/**
 * 加载可绘制到 canvas 的图片。
 * - blob/data/同域：直接加载
 * - 跨域 OSS：优先走同源 /media-proxy，绕过未配置 CORS 的桶
 * - 其它跨域：fetch→blob，再回退 Image+crossOrigin
 */
export async function loadDrawableImage(url: string): Promise<{
  img: HTMLImageElement
  revoke?: () => void
}> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return { img: await loadImageElement(url) }
  }

  const candidates: string[] = [...(await mintMediaProxyCandidates(url))]
  const crossOrigin = isCrossOriginUrl(url)
  if (!crossOrigin) {
    candidates.push(url)
  }

  let lastError: unknown
  for (const candidate of candidates) {
    const candidateCrossOrigin = isCrossOriginUrl(candidate)

    if (!candidateCrossOrigin) {
      try {
        const { objectUrl, revoke } = await fetchAsObjectUrl(candidate)
        try {
          const img = await loadImageElement(objectUrl)
          return { img, revoke }
        } catch (error) {
          revoke()
          throw error
        }
      } catch (error) {
        lastError = error
        try {
          return { img: await loadImageElement(candidate) }
        } catch (fallbackError) {
          lastError = fallbackError
        }
        continue
      }
    }

    try {
      const { objectUrl, revoke } = await fetchAsObjectUrl(candidate)
      try {
        const img = await loadImageElement(objectUrl)
        return { img, revoke }
      } catch (error) {
        revoke()
        throw error
      }
    } catch (error) {
      lastError = error
    }

    try {
      return { img: await loadImageElement(candidate, true) }
    } catch (error) {
      lastError = error
    }
  }

  console.error('[drawable-image] loadDrawableImage failed', lastError)
  throw new Error('图片加载失败，无法处理（可能受跨域限制）')
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片导出失败'))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}
