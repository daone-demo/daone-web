export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CropTransform {
  rotation: number
  flipX: boolean
  flipY: boolean
}

interface SourceCropRect {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = url
  })
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360
}

function isAliyunOssUrl(url: URL) {
  return url.hostname.toLowerCase().includes('.aliyuncs.com')
}

function createOssCropUrl(imageUrl: string, sourceCrop: SourceCropRect, transform: CropTransform) {
  if (normalizeRotation(transform.rotation) !== 0 || transform.flipX || transform.flipY) return null

  let url: URL
  try {
    url = new URL(imageUrl, window.location.href)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(url.protocol) || !isAliyunOssUrl(url)) return null

  const x = Math.max(0, Math.round(sourceCrop.x))
  const y = Math.max(0, Math.round(sourceCrop.y))
  const width = Math.max(1, Math.round(sourceCrop.width))
  const height = Math.max(1, Math.round(sourceCrop.height))
  const cropProcess = `crop,x_${x},y_${y},w_${width},h_${height}`
  const existingProcess = url.searchParams.get('x-oss-process')

  url.searchParams.set(
    'x-oss-process',
    existingProcess ? `${existingProcess}/${cropProcess}` : `image/${cropProcess}`,
  )

  return url.toString()
}

export function getTransformedSize(naturalWidth: number, naturalHeight: number, rotation: number) {
  const rot = normalizeRotation(rotation)
  const swapped = rot === 90 || rot === 270
  return {
    width: swapped ? naturalHeight : naturalWidth,
    height: swapped ? naturalWidth : naturalHeight,
  }
}

export function getImageDisplayBounds(
  workspaceWidth: number,
  workspaceHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  rotation: number,
): CropBounds {
  const { width, height } = getTransformedSize(naturalWidth, naturalHeight, rotation)
  if (!width || !height) {
    return { x: 0, y: 0, width: workspaceWidth, height: workspaceHeight }
  }

  const scale = Math.min(workspaceWidth / width, workspaceHeight / height, 1)
  const displayWidth = width * scale
  const displayHeight = height * scale

  return {
    x: (workspaceWidth - displayWidth) / 2,
    y: (workspaceHeight - displayHeight) / 2,
    width: displayWidth,
    height: displayHeight,
  }
}

export function clampCropRect(rect: CropRect, bounds: CropBounds, aspectRatio: number | null): CropRect {
  let { x, y, width, height } = rect

  if (aspectRatio && aspectRatio > 0) {
    if (width / height > aspectRatio) {
      width = height * aspectRatio
    } else {
      height = width / aspectRatio
    }
  }

  width = Math.max(24, Math.min(width, bounds.width))
  height = Math.max(24, Math.min(height, bounds.height))

  if (aspectRatio && aspectRatio > 0) {
    if (width / height > aspectRatio) {
      width = height * aspectRatio
    } else {
      height = width / aspectRatio
    }
  }

  x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width))
  y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height))

  return { x, y, width, height }
}

export function createFullCropRect(bounds: CropBounds): CropRect {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  }
}

export async function exportCroppedImage(
  imageUrl: string,
  cropRect: CropRect,
  imageBounds: CropBounds,
  naturalWidth: number,
  naturalHeight: number,
  transform: CropTransform,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { width: outW, height: outH } = getTransformedSize(naturalWidth, naturalHeight, transform.rotation)
  if (!outW || !outH || !imageBounds.width || !imageBounds.height) {
    throw new Error('Invalid crop bounds')
  }

  const scaleX = outW / imageBounds.width
  const scaleY = outH / imageBounds.height
  const sx = Math.max(0, (cropRect.x - imageBounds.x) * scaleX)
  const sy = Math.max(0, (cropRect.y - imageBounds.y) * scaleY)
  const sw = Math.max(1, Math.min(outW - sx, cropRect.width * scaleX))
  const sh = Math.max(1, Math.min(outH - sy, cropRect.height * scaleY))
  const cropWidth = Math.round(sw)
  const cropHeight = Math.round(sh)

  const ossCropUrl = createOssCropUrl(imageUrl, { x: sx, y: sy, width: sw, height: sh }, transform)
  if (ossCropUrl) {
    return {
      dataUrl: ossCropUrl,
      width: cropWidth,
      height: cropHeight,
    }
  }

  const img = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropWidth
  cropCanvas.height = cropHeight
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) throw new Error('Canvas not supported')

  cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, cropCanvas.width, cropCanvas.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('Failed to export crop'))
    }, 'image/png')
  })

  return {
    dataUrl: URL.createObjectURL(blob),
    width: cropCanvas.width,
    height: cropCanvas.height,
  }
}
