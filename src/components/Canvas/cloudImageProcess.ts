export interface CloudCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CloudCropTransform {
  rotation: number
  flipX: boolean
  flipY: boolean
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360
}

function canUseCloudCrop(transform: CloudCropTransform) {
  return normalizeRotation(transform.rotation) === 0 && !transform.flipX && !transform.flipY
}

function isAliyunOssUrl(url: URL) {
  return url.hostname.toLowerCase().includes('.aliyuncs.com')
}

function isTencentCosUrl(url: URL) {
  return /\.myqcloud\.com$/i.test(url.hostname)
}

function appendTencentImageOp(url: URL, op: string) {
  const base = `${url.origin}${url.pathname}`
  const search = url.search ? url.search.slice(1) : ''
  const query = search ? `${search}&${op}` : op
  return `${base}?${query}`
}

/**
 * 通过对象存储图片处理参数生成裁切 URL，无需 canvas，不受浏览器 CORS 限制。
 * 支持阿里云 OSS（x-oss-process）与腾讯云 COS（imageMogr2/cut）。
 */
export function createCloudCropUrl(
  imageUrl: string,
  sourceCrop: CloudCropRect,
  transform: CloudCropTransform,
): string | null {
  if (!canUseCloudCrop(transform)) return null

  let url: URL
  try {
    url = new URL(imageUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null

  const x = Math.max(0, Math.round(sourceCrop.x))
  const y = Math.max(0, Math.round(sourceCrop.y))
  const width = Math.max(1, Math.round(sourceCrop.width))
  const height = Math.max(1, Math.round(sourceCrop.height))

  if (isAliyunOssUrl(url)) {
    const cropProcess = `crop,x_${x},y_${y},w_${width},h_${height}`
    const existingProcess = url.searchParams.get('x-oss-process')
    url.searchParams.set(
      'x-oss-process',
      existingProcess ? `${existingProcess}/${cropProcess}` : `image/${cropProcess}`,
    )
    return url.toString()
  }

  if (isTencentCosUrl(url)) {
    return appendTencentImageOp(url, `imageMogr2/cut/${width}x${height}x${x}x${y}`)
  }

  return null
}

export function isCloudImageProcessUrl(url: string) {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    return isAliyunOssUrl(parsed) || isTencentCosUrl(parsed)
  } catch {
    return false
  }
}

function stripTencentCosImageQuery(search: string): string {
  const query = search.startsWith('?') ? search.slice(1) : search
  if (!query) return ''
  const cleaned = query.split('&').filter((part) => part && !part.startsWith('imageMogr2'))
  return cleaned.length ? `?${cleaned.join('&')}` : ''
}

function stripCloudImageProcessFromParsedUrl(parsed: URL): boolean {
  if (isAliyunOssUrl(parsed)) {
    if (!parsed.searchParams.has('x-oss-process')) return false
    parsed.searchParams.delete('x-oss-process')
    return true
  }

  if (isTencentCosUrl(parsed)) {
    const nextSearch = stripTencentCosImageQuery(parsed.search)
    if (nextSearch === parsed.search) return false
    parsed.search = nextSearch
    return true
  }

  return false
}

function unwrapMediaProxyUrl(url: string): string | null {
  if (!url.startsWith('/media-proxy')) return null

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    const inner = parsed.searchParams.get('url')?.trim()
    if (inner) return inner

    const pathMatch = parsed.pathname.match(/^\/media-proxy\/([^/]+)\/(.+)$/)
    if (!pathMatch) return null
    return `https://${pathMatch[1]}/${pathMatch[2]}${parsed.search}`
  } catch {
    return null
  }
}

/**
 * 下载用原始资源地址：去掉 OSS/COS 图片处理参数，并解开 media-proxy 包装。
 */
export function resolveOriginalMediaDownloadUrl(url: string): string {
  const source = url.trim()
  if (!source || source.startsWith('blob:') || source.startsWith('data:')) return source

  const remoteUrl = unwrapMediaProxyUrl(source) ?? source
  try {
    const parsed = new URL(remoteUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    if (!stripCloudImageProcessFromParsedUrl(parsed)) return remoteUrl
    return parsed.toString()
  } catch {
    return remoteUrl
  }
}
