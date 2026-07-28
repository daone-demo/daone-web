import { getImageDisplayBounds } from './cropUtils'
import { canvasToObjectUrl, loadDrawableImage } from './drawableImage'

export interface ErasePoint {
  x: number
  y: number
}

export interface EraseStroke {
  points: ErasePoint[]
  size: number
}

/** 擦除工具画笔展示色 */
export const ERASE_BRUSH_DISPLAY_COLOR = 'rgba(255, 255, 255, 0.92)'
/** 局部修改画笔展示色（红色半透明） */
export const INPAINT_BRUSH_DISPLAY_COLOR = 'rgba(255, 59, 48, 0.45)'

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
  stroke: EraseStroke,
  color = ERASE_BRUSH_DISPLAY_COLOR,
) {
  if (stroke.points.length < 2) return

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
    drawEraseStroke(
      ctx,
      {
        points: stroke.points.map((point) => ({
          x: point.x - bounds.x,
          y: point.y - bounds.y,
        })),
        size: stroke.size,
      },
      color,
    )
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
  bounds: { x: number; y: number; width: number; height: number },
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

    const scaleX = naturalWidth / bounds.width
    const scaleY = naturalHeight / bounds.height

    ctx.globalCompositeOperation = 'destination-out'
    strokes.forEach((stroke) => {
      drawEraseStroke(
        ctx,
        {
          points: stroke.points.map((point) => ({
            x: (point.x - bounds.x) * scaleX,
            y: (point.y - bounds.y) * scaleY,
          })),
          size: stroke.size * Math.max(scaleX, scaleY),
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
  bounds: { x: number; y: number; width: number; height: number },
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

  const scaleX = naturalWidth / bounds.width
  const scaleY = naturalHeight / bounds.height

  strokes.forEach((stroke) => {
    drawEraseStroke(ctx, {
      points: stroke.points.map((point) => ({
        x: (point.x - bounds.x) * scaleX,
        y: (point.y - bounds.y) * scaleY,
      })),
      size: stroke.size * Math.max(scaleX, scaleY),
    }, '#ffffff')
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: naturalWidth,
    height: naturalHeight,
  }
}
