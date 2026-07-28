import { getImageDisplayBounds } from './cropUtils'
import { canvasToObjectUrl, loadDrawableImage } from './drawableImage'

export interface ErasePoint {
  x: number
  y: number
}

export interface EraseStroke {
  /** 相对图片显示区域的比例坐标（0-1），与平移/缩放无关 */
  points: ErasePoint[]
  /** 画笔粗细相对图片显示宽度的比例 */
  sizeRatio: number
}

/** 舞台坐标 → 图片归一化坐标 */
export function stagePointToNormalized(
  point: ErasePoint,
  bounds: { x: number; y: number; width: number; height: number },
): ErasePoint {
  return {
    x: (point.x - bounds.x) / bounds.width,
    y: (point.y - bounds.y) / bounds.height,
  }
}

/** 图片归一化坐标 → 当前显示区域内的画布坐标 */
export function normalizedPointToDisplay(
  point: ErasePoint,
  bounds: { width: number; height: number },
): ErasePoint {
  return {
    x: point.x * bounds.width,
    y: point.y * bounds.height,
  }
}

/** 归一化坐标 → 舞台坐标 */
export function normalizedPointToStage(
  point: ErasePoint,
  bounds: { x: number; y: number; width: number; height: number },
): ErasePoint {
  const display = normalizedPointToDisplay(point, bounds)
  return {
    x: display.x + bounds.x,
    y: display.y + bounds.y,
  }
}

export function getStrokeDisplaySize(
  stroke: EraseStroke,
  bounds: { width: number },
) {
  return stroke.sizeRatio * bounds.width
}

function strokeToDisplayStroke(
  stroke: EraseStroke,
  bounds: { width: number; height: number },
): { points: ErasePoint[]; size: number } {
  return {
    points: stroke.points.map((point) => normalizedPointToDisplay(point, bounds)),
    size: getStrokeDisplaySize(stroke, bounds),
  }
}

/** 擦除工具画笔展示色 */
export const ERASE_BRUSH_DISPLAY_COLOR = 'rgba(255, 255, 255, 0.92)'
/** 局部修改画笔展示色（红色半透明，柔边） */
export const INPAINT_BRUSH_DISPLAY_COLOR = 'rgba(255, 59, 48, 0.45)'
const INPAINT_BRUSH_GLOW_COLOR = 'rgba(255, 59, 48, 0.5)'

function getInpaintBrushFeather(size: number) {
  return Math.max(4, size * 0.24)
}

function applySoftInpaintBrushStyle(ctx: CanvasRenderingContext2D, size: number) {
  const feather = getInpaintBrushFeather(size)
  ctx.shadowColor = INPAINT_BRUSH_GLOW_COLOR
  ctx.shadowBlur = feather
  ctx.strokeStyle = INPAINT_BRUSH_DISPLAY_COLOR
  ctx.fillStyle = INPAINT_BRUSH_DISPLAY_COLOR
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, size * 0.82)
}

export function drawInpaintBrushDotLocal(
  ctx: CanvasRenderingContext2D,
  point: ErasePoint,
  size: number,
) {
  ctx.save()
  applySoftInpaintBrushStyle(ctx, size)
  ctx.beginPath()
  ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawInpaintBrushSegmentLocal(
  ctx: CanvasRenderingContext2D,
  from: ErasePoint,
  to: ErasePoint,
  size: number,
) {
  ctx.save()
  applySoftInpaintBrushStyle(ctx, size)
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

export function drawInpaintBrushStroke(
  ctx: CanvasRenderingContext2D,
  stroke: { points: ErasePoint[]; size: number },
) {
  if (!stroke.points.length) return

  if (stroke.points.length === 1) {
    drawInpaintBrushDotLocal(ctx, stroke.points[0], stroke.size)
    return
  }

  ctx.save()
  applySoftInpaintBrushStyle(ctx, stroke.size)
  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let index = 1; index < stroke.points.length; index += 1) {
    ctx.lineTo(stroke.points[index].x, stroke.points[index].y)
  }
  ctx.stroke()
  ctx.restore()
}

export function getEraseImageBounds(
  workspaceWidth: number,
  workspaceHeight: number,
  naturalWidth: number,
  naturalHeight: number,
) {
  return getImageDisplayBounds(workspaceWidth, workspaceHeight, naturalWidth, naturalHeight, 0)
}

export function drawEraseStroke(
  ctx: CanvasRenderingContext2D,
  stroke: { points: ErasePoint[]; size: number },
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  if (!stroke.points.length) return

  if (stroke.points.length === 1) {
    drawEraseDotLocal(ctx, stroke.points[0], stroke.size, color)
    return
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = stroke.size

  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let index = 1; index < stroke.points.length; index += 1) {
    ctx.lineTo(stroke.points[index].x, stroke.points[index].y)
  }
  ctx.stroke()
  ctx.restore()
}

export function syncEraseCanvasSize(
  canvas: HTMLCanvasElement,
  bounds: { width: number; height: number },
) {
  const width = Math.max(1, Math.round(bounds.width))
  const height = Math.max(1, Math.round(bounds.height))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

export function drawEraseDotLocal(
  ctx: CanvasRenderingContext2D,
  point: ErasePoint,
  size: number,
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawEraseSegmentLocal(
  ctx: CanvasRenderingContext2D,
  from: ErasePoint,
  to: ErasePoint,
  size: number,
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

export function redrawEraseDisplayCanvas(
  canvas: HTMLCanvasElement,
  strokes: EraseStroke[],
  bounds: { x: number; y: number; width: number; height: number },
  currentStroke?: EraseStroke | null,
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  syncEraseCanvasSize(canvas, bounds)
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const paintStrokes = currentStroke ? [...strokes, currentStroke] : strokes
  paintStrokes.forEach((stroke) => {
    const displayStroke = strokeToDisplayStroke(stroke, bounds)
    if (color === INPAINT_BRUSH_DISPLAY_COLOR) {
      drawInpaintBrushStroke(ctx, displayStroke)
      return
    }
    drawEraseStroke(ctx, displayStroke, color)
  })
}

export function drawEraseSegment(
  ctx: CanvasRenderingContext2D,
  from: ErasePoint,
  to: ErasePoint,
  size: number,
  bounds: { x: number; y: number },
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = size
  ctx.beginPath()
  ctx.moveTo(from.x - bounds.x, from.y - bounds.y)
  ctx.lineTo(to.x - bounds.x, to.y - bounds.y)
  ctx.stroke()
  ctx.restore()
}

export function drawEraseDot(
  ctx: CanvasRenderingContext2D,
  point: ErasePoint,
  size: number,
  bounds: { x: number; y: number },
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(point.x - bounds.x, point.y - bounds.y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export async function exportErasedImage(
  imageUrl: string,
  strokes: EraseStroke[],
  _bounds: { x: number; y: number; width: number; height: number },
  naturalWidth: number,
  naturalHeight: number,
  cachedImage?: HTMLImageElement | null,
): Promise<{ dataUrl: string; width: number; height: number }> {
  let revoke: (() => void) | undefined
  let img = cachedImage ?? null
  if (!img) {
    const loaded = await loadDrawableImage(imageUrl)
    img = loaded.img
    revoke = loaded.revoke
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = naturalWidth
    canvas.height = naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to create erase canvas')
    }

    ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight)

    ctx.globalCompositeOperation = 'destination-out'
    strokes.forEach((stroke) => {
      const displaySize = stroke.sizeRatio * naturalWidth
      drawEraseStroke(
        ctx,
        {
          points: stroke.points.map((point) => ({
            x: point.x * naturalWidth,
            y: point.y * naturalHeight,
          })),
          size: displaySize,
        },
        'rgba(0, 0, 0, 1)',
      )
    })

    return {
      dataUrl: await canvasToObjectUrl(canvas),
      width: naturalWidth,
      height: naturalHeight,
    }
  } finally {
    revoke?.()
  }
}

export async function loadEraseImage(url: string): Promise<HTMLImageElement> {
  const { img } = await loadDrawableImage(url)
  return img
}

export async function exportEraseMask(
  strokes: EraseStroke[],
  _bounds: { x: number; y: number; width: number; height: number },
  naturalWidth: number,
  naturalHeight: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = document.createElement('canvas')
  canvas.width = naturalWidth
  canvas.height = naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to create mask canvas')
  }

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, naturalWidth, naturalHeight)

  strokes.forEach((stroke) => {
    drawEraseStroke(ctx, {
      points: stroke.points.map((point) => ({
        x: point.x * naturalWidth,
        y: point.y * naturalHeight,
      })),
      size: stroke.sizeRatio * naturalWidth,
    }, '#ffffff')
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: naturalWidth,
    height: naturalHeight,
  }
}
