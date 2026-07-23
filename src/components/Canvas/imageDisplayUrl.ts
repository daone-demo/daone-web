const OSS_HOST_RE = /\.aliyuncs\.com$/i
const DEFAULT_CANVAS_IMAGE_MAX_EDGE = 960

const naturalSizeCache = new Map<string, { width: number; height: number }>()
const naturalSizeInflight = new Map<string, Promise<{ width: number; height: number }>>()

function isAliyunOssUrl(url: URL) {
  return OSS_HOST_RE.test(url.hostname)
}

function appendOssResizeProcess(url: string, maxEdge: number) {
  if (!url) return url

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost')
    if (!['http:', 'https:'].includes(parsed.protocol) || !isAliyunOssUrl(parsed)) {
      return url
    }
    if (parsed.searchParams.has('x-oss-process')) return url

    parsed.searchParams.set(
      'x-oss-process',
      `image/resize,m_lfit,w_${maxEdge},h_${maxEdge}/quality,q_85`,
    )
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * 画布节点预览用缩略图地址：OSS 走 x-oss-process 压缩，本地/blob 原样返回。
 */
export function getCanvasImageDisplayUrl(
  url: string,
  maxEdge = DEFAULT_CANVAS_IMAGE_MAX_EDGE,
): string {
  const source = url?.trim()
  if (!source || source.startsWith('blob:') || source.startsWith('data:')) {
    return source
  }

  if (source.startsWith('/media-proxy')) {
    try {
      const parsed = new URL(source, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      const inner = parsed.searchParams.get('url')
      if (!inner) return source
      const processed = appendOssResizeProcess(inner, maxEdge)
      if (processed === inner) return source
      return `/media-proxy?url=${encodeURIComponent(processed)}`
    } catch {
      return source
    }
  }

  const processed = appendOssResizeProcess(source, maxEdge)
  return processed || source
}

function loadImageNaturalSizeUncached(previewUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error('invalid image dimensions'))
        return
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => reject(new Error('failed to load image'))
    img.src = previewUrl
  })
}

/** 读取图片原始尺寸（带内存缓存，避免节点展示与尺寸补全重复下载）。 */
export function resolveImageNaturalSizeCached(
  previewUrl: string,
): Promise<{ width: number; height: number }> {
  const url = previewUrl?.trim()
  if (!url) {
    return Promise.reject(new Error('missing preview url'))
  }

  const cached = naturalSizeCache.get(url)
  if (cached) return Promise.resolve(cached)

  const inflight = naturalSizeInflight.get(url)
  if (inflight) return inflight

  const task = loadImageNaturalSizeUncached(url)
    .then((size) => {
      naturalSizeCache.set(url, size)
      return size
    })
    .finally(() => {
      naturalSizeInflight.delete(url)
    })

  naturalSizeInflight.set(url, task)
  return task
}

export function rememberImageNaturalSize(
  previewUrl: string,
  width: number,
  height: number,
) {
  const url = previewUrl?.trim()
  if (!url || !width || !height) return
  naturalSizeCache.set(url, { width, height })
}
