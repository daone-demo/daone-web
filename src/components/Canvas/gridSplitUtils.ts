import type { Graph, Node } from '@antv/x6'
import type { CanvasNodeData } from './constants'
import { canvasToObjectUrl, loadDrawableImage } from './drawableImage'

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

/** 宫格碎片节点之间的布局间隙 */
export const GRID_SPLIT_GAP = 2

/** 拖拽宫格碎片时边缘吸附阈值（图坐标 px） */
export const GRID_SPLIT_SNAP_THRESHOLD = 10

export function computeGridSplitGap(_width?: number, _height?: number) {
  return GRID_SPLIT_GAP
}

export function isGridSplitResultNodeData(data: CanvasNodeData | undefined) {
  return Boolean(data?.gridSplitTile)
}

export function areAllGridSplitResultNodes(graph: Graph, nodeIds: string[]) {
  if (!nodeIds.length) return false
  return nodeIds.every((id) => {
    const cell = graph.getCellById(id)
    if (!cell?.isNode()) return false
    return isGridSplitResultNodeData(cell.getData() as CanvasNodeData)
  })
}

function isGridSplitSibling(node: Node, sourceNodeId: string) {
  const data = node.getData() as { gridSplitTile?: unknown; sourceNodeId?: string }
  return Boolean(data.gridSplitTile && data.sourceNodeId === sourceNodeId)
}

export function getGridSplitResultNodes(graph: Graph, sourceNodeId: string) {
  return graph.getNodes().filter((candidate) => isGridSplitSibling(candidate, sourceNodeId))
}

/** 计算新宫格批次左上角：在源图右侧，并避开同源已有宫格批次 */
export function computeGridSplitContentOrigin(
  graph: Graph,
  sourceNode: Node,
  gridHeight: number,
  layoutGap: number,
) {
  const bbox = sourceNode.getBBox()
  const siblings = getGridSplitResultNodes(graph, sourceNode.id)

  let anchorRight = bbox.x + bbox.width
  siblings.forEach((node) => {
    const nodeBBox = node.getBBox()
    anchorRight = Math.max(anchorRight, nodeBBox.x + nodeBBox.width)
  })

  return {
    x: anchorRight + layoutGap,
    y: bbox.y + Math.max(0, (bbox.height - gridHeight) / 2),
  }
}

/** 拖拽宫格碎片时，与同源碎片边缘吸附对齐（保留 GRID_SPLIT_GAP 缝宽） */
export function snapGridSplitNodePosition(
  graph: Graph,
  node: Node,
  threshold = GRID_SPLIT_SNAP_THRESHOLD,
) {
  const data = node.getData() as { gridSplitTile?: unknown; sourceNodeId?: string }
  if (!data.gridSplitTile || !data.sourceNodeId) return

  const siblings = graph.getNodes().filter((candidate) => {
    if (candidate.id === node.id) return false
    return isGridSplitSibling(candidate, data.sourceNodeId!)
  })
  if (!siblings.length) return

  let { x, y } = node.getPosition()
  const width = node.getSize().width
  const height = node.getSize().height
  const gap = GRID_SPLIT_GAP

  let snapX = x
  let snapY = y
  let bestDx = threshold
  let bestDy = threshold

  const trySnapX = (nextX: number) => {
    const delta = Math.abs(nextX - x)
    if (delta <= threshold && delta < bestDx) {
      bestDx = delta
      snapX = nextX
    }
  }

  const trySnapY = (nextY: number) => {
    const delta = Math.abs(nextY - y)
    if (delta <= threshold && delta < bestDy) {
      bestDy = delta
      snapY = nextY
    }
  }

  siblings.forEach((sibling) => {
    const sp = sibling.getPosition()
    const sw = sibling.getSize().width
    const sh = sibling.getSize().height

    trySnapX(sp.x + sw + gap)
    trySnapX(sp.x - gap - width)
    trySnapX(sp.x)

    trySnapY(sp.y + sh + gap)
    trySnapY(sp.y - gap - height)
    trySnapY(sp.y)
  })

  if (snapX !== x || snapY !== y) {
    node.position(snapX, snapY)
  }
}

export function buildSplitAxisLayout(edges: number[], total: number, gap: number) {
  const count = Math.max(1, edges.length - 1)
  const gapTotal = Math.max(0, count - 1) * gap
  const available = Math.max(count, total - gapTotal)
  const sizes = Array.from({ length: count }, (_, index) => {
    const ratio = Math.max(0, edges[index + 1] - edges[index])
    return Math.max(1, Math.round(ratio * available))
  })
  const sum = sizes.reduce((acc, value) => acc + value, 0)
  sizes[sizes.length - 1] = Math.max(1, sizes[sizes.length - 1] + (available - sum))

  const offsets: number[] = []
  let cursor = 0
  for (let i = 0; i < count; i += 1) {
    offsets.push(cursor)
    cursor += sizes[i] + (i < count - 1 ? gap : 0)
  }
  return { sizes, offsets }
}

export function buildGridSplitEdges(count: number, stops?: number[]) {
  const n = Math.max(1, Math.floor(count))
  const equal = createEqualStops(n)
  if (!Array.isArray(stops) || stops.length !== n - 1) {
    return [0, ...equal, 1]
  }
  return [0, ...stops, 1]
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
