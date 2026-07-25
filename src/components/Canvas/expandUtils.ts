export interface ExpandRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageExpandNaturalMetrics {
  targetWidth: number
  targetHeight: number
  imageX: number
  imageY: number
  imageWidth: number
  imageHeight: number
}

export function getImageFitBounds(
  workspaceWidth: number,
  workspaceHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  padding = 28,
): ExpandRect {
  const innerW = Math.max(80, workspaceWidth - padding * 2)
  const innerH = Math.max(80, workspaceHeight - padding * 2)
  if (!naturalWidth || !naturalHeight) {
    return {
      x: (workspaceWidth - innerW) / 2,
      y: (workspaceHeight - innerH) / 2,
      width: innerW,
      height: innerH,
    }
  }

  const scale = Math.min(innerW / naturalWidth, innerH / naturalHeight, 1)
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  return {
    x: (workspaceWidth - width) / 2,
    y: (workspaceHeight - height) / 2,
    width,
    height,
  }
}

export function scaleRectAroundCenter(rect: ExpandRect, scale: number): ExpandRect {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const width = rect.width * scale
  const height = rect.height * scale
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  }
}

export function rectContainsRect(outer: ExpandRect, inner: ExpandRect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

export function createExpandFrameFromImageCenter(
  image: ExpandRect,
  workspace: { width: number; height: number },
  aspectRatio: number | null,
): ExpandRect {
  let width = image.width
  let height = image.height

  if (aspectRatio && aspectRatio > 0) {
    const imageRatio = width / height
    if (imageRatio > aspectRatio) {
      height = width / aspectRatio
    } else {
      width = height * aspectRatio
    }
  }

  const cx = image.x + image.width / 2
  const cy = image.y + image.height / 2

  if (width > workspace.width) {
    width = workspace.width
    if (aspectRatio && aspectRatio > 0) {
      height = width / aspectRatio
    }
  }
  if (height > workspace.height) {
    height = workspace.height
    if (aspectRatio && aspectRatio > 0) {
      width = height * aspectRatio
    }
  }

  width = Math.max(width, image.width)
  height = Math.max(height, image.height)

  if (aspectRatio && aspectRatio > 0) {
    const frameRatio = width / height
    if (frameRatio > aspectRatio) {
      height = width / aspectRatio
    } else if (frameRatio < aspectRatio) {
      width = height * aspectRatio
    }
  }

  let x = cx - width / 2
  let y = cy - height / 2

  x = Math.max(0, Math.min(x, workspace.width - width))
  y = Math.max(0, Math.min(y, workspace.height - height))

  return clampExpandFrame({ x, y, width, height }, image, workspace, aspectRatio)
}

export function clampExpandFrame(
  frame: ExpandRect,
  image: ExpandRect,
  workspace: { width: number; height: number },
  aspectRatio: number | null,
): ExpandRect {
  let { x, y, width, height } = frame

  width = Math.max(width, image.width)
  height = Math.max(height, image.height)

  if (aspectRatio && aspectRatio > 0) {
    if (width / height > aspectRatio) {
      width = height * aspectRatio
    } else {
      height = width / aspectRatio
    }
    width = Math.max(width, image.width)
    height = Math.max(height, image.height)
    if (width / height > aspectRatio) {
      height = width / aspectRatio
    } else {
      width = height * aspectRatio
    }
  }

  width = Math.min(width, workspace.width)
  height = Math.min(height, workspace.height)
  width = Math.max(width, image.width)
  height = Math.max(height, image.height)

  x = Math.min(image.x, x)
  y = Math.min(image.y, y)
  if (x + width < image.x + image.width) {
    x = image.x + image.width - width
  }
  if (y + height < image.y + image.height) {
    y = image.y + image.height - height
  }

  x = Math.max(0, Math.min(x, workspace.width - width))
  y = Math.max(0, Math.min(y, workspace.height - height))

  return { x, y, width, height }
}

export function clampImageOffset(
  image: ExpandRect,
  frame: ExpandRect,
  workspace: { width: number; height: number },
): ExpandRect {
  let { x, y, width, height } = image
  x = Math.max(frame.x, Math.min(x, frame.x + frame.width - width))
  y = Math.max(frame.y, Math.min(y, frame.y + frame.height - height))
  x = Math.max(0, Math.min(x, workspace.width - width))
  y = Math.max(0, Math.min(y, workspace.height - height))
  return { x, y, width, height }
}

export function computeExpandNaturalMetrics(
  expandFrame: ExpandRect,
  imageBounds: ExpandRect,
  naturalWidth: number,
  _naturalHeight: number,
): ImageExpandNaturalMetrics {
  const ratio = imageBounds.width > 0 ? naturalWidth / imageBounds.width : 1
  return {
    targetWidth: Math.max(1, Math.round(expandFrame.width * ratio)),
    targetHeight: Math.max(1, Math.round(expandFrame.height * ratio)),
    imageX: Math.max(0, Math.round((imageBounds.x - expandFrame.x) * ratio)),
    imageY: Math.max(0, Math.round((imageBounds.y - expandFrame.y) * ratio)),
    imageWidth: Math.max(1, Math.round(imageBounds.width * ratio)),
    imageHeight: Math.max(1, Math.round(imageBounds.height * ratio)),
  }
}
