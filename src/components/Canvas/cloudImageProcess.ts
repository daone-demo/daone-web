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
