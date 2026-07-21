import { toMediaProxyUrl } from './mediaProxy'

export type GridSplitTile = {
  dataUrl: string
  width: number
  height: number
  row: number
  col: number
  label: string
}

export type GridSplitStops = {
  /** 水平分割线位置（相对高度 0~1），长度 = rows - 1，需升序 */
  rowStops?: number[]
  /** 竖直分割线位置（相对宽度 0~1），长度 = cols - 1，需升序 */
  colStops?: number[]
}

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

async function fetchAsObjectUrl(url: string): Promise<{ objectUrl: string; revoke: () => void }> {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'reload',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const blob = await response.blob()
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
async function loadDrawableImage(url: string): Promise<{
  img: HTMLImageElement
  revoke?: () => void
}> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return { img: await loadImageElement(url) }
  }

  const candidates: string[] = []
  const proxyUrl = toMediaProxyUrl(url)
  if (proxyUrl) candidates.push(proxyUrl)
  candidates.push(url)

  let lastError: unknown
  for (const candidate of candidates) {
    const crossOrigin = isCrossOriginUrl(candidate)

    if (!crossOrigin) {
      try {
        // 同源（含 media-proxy）：直接取 blob，保证 canvas 可导出
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

  console.error('[grid-split] loadDrawableImage failed', lastError)
  throw new Error('图片加载失败，无法拆分（可能受跨域限制）')
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('宫格导出失败'))
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

/** 生成等分分割线位置（不含 0/1） */
export function createEqualStops(count: number): number[] {
  const n = Math.max(1, Math.floor(count))
  if (n <= 1) return []
  return Array.from({ length: n - 1 }, (_, i) => (i + 1) / n)
}

function normalizeStops(count: number, stops?: number[]): number[] {
  const n = Math.max(1, Math.floor(count))
  if (n <= 1) return []
  const equal = createEqualStops(n)
  if (!Array.isArray(stops) || stops.length !== n - 1) return equal

  const cleaned = stops
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  if (cleaned.length !== n - 1) return equal

  const sorted = [...cleaned].sort((a, b) => a - b)
  return sorted.map((value, index) => {
    const min = index === 0 ? 0.02 : sorted[index - 1] + 0.02
    const max = index === sorted.length - 1 ? 0.98 : sorted[index + 1] - 0.02
    return Math.min(max, Math.max(min, value))
  })
}

function buildEdges(count: number, stops?: number[]): number[] {
  return [0, ...normalizeStops(count, stops), 1]
}

/** 将图片按 rows×cols 裁切；可传入拖拽后的分割比例 */
export async function splitImageIntoGrid(
  imageUrl: string,
  rows: number,
  cols: number,
  stops: GridSplitStops = {},
): Promise<GridSplitTile[]> {
  const safeRows = Math.max(1, Math.min(10, Math.floor(rows)))
  const safeCols = Math.max(1, Math.min(10, Math.floor(cols)))

  const { img, revoke } = await loadDrawableImage(imageUrl)
  try {
    const naturalWidth = img.naturalWidth || img.width
    const naturalHeight = img.naturalHeight || img.height
    if (!naturalWidth || !naturalHeight) {
      throw new Error('图片尺寸无效')
    }

    const xEdges = buildEdges(safeCols, stops.colStops).map((ratio) =>
      Math.round(ratio * naturalWidth),
    )
    const yEdges = buildEdges(safeRows, stops.rowStops).map((ratio) =>
      Math.round(ratio * naturalHeight),
    )
    xEdges[0] = 0
    yEdges[0] = 0
    xEdges[xEdges.length - 1] = naturalWidth
    yEdges[yEdges.length - 1] = naturalHeight

    const tiles: GridSplitTile[] = []
    for (let row = 0; row < safeRows; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        const sx = xEdges[col]
        const sy = yEdges[row]
        const sw = Math.max(1, xEdges[col + 1] - sx)
        const sh = Math.max(1, yEdges[row + 1] - sy)

        const canvas = document.createElement('canvas')
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('当前浏览器不支持 Canvas')
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

        tiles.push({
          dataUrl: await canvasToObjectUrl(canvas),
          width: sw,
          height: sh,
          row: row + 1,
          col: col + 1,
          label: `${row + 1}-${col + 1}`,
        })
      }
    }
    return tiles
  } finally {
    revoke?.()
  }
}
