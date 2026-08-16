import type { Graph, Node } from '@antv/x6'

const GEN_GAP = 56

export type ResultPlacement = 'right' | 'above'

export type OutgoingResultLayoutOptions = {
  layoutSlot?: number
  layoutTotal?: number
  placement?: ResultPlacement
  /** 多批次结果时向右（或向上）错开整列，避免与已有子节点重叠 */
  columnOffset?: number
}

type LayoutRect = { x: number; y: number; width: number; height: number }

function centerToRect(
  center: { x: number; y: number },
  size: { width: number; height: number },
): LayoutRect {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  }
}

function rectsOverlap(a: LayoutRect, b: LayoutRect, gap = GEN_GAP) {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  )
}

function getNodeLayoutRect(node: Node): LayoutRect {
  const pos = node.position()
  const size = node.getSize()
  return {
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
  }
}

/** 收集画布上已有节点占位（用于碰撞检测） */
function collectGraphNodeRects(graph: Graph, excludeNodeIds: string[] = []): LayoutRect[] {
  const excluded = new Set(excludeNodeIds)
  return graph
    .getNodes()
    .filter((cell) => !excluded.has(cell.id))
    .map((cell) => getNodeLayoutRect(cell as Node))
}

function isPointFree(
  point: { x: number; y: number },
  size: { width: number; height: number },
  occupied: LayoutRect[],
) {
  const rect = centerToRect(point, size)
  return !occupied.some((item) => rectsOverlap(rect, item))
}

function fallbackOutgoingPoint(
  sourceNode: Node,
  size: { width: number; height: number },
  occupied: LayoutRect[],
  placement: ResultPlacement,
) {
  const sourceRect = getNodeLayoutRect(sourceNode)
  if (!occupied.length) {
    return computeOutgoingResultNodePoint(sourceNode, size, { placement, layoutSlot: 0 })
  }

  if (placement === 'above') {
    const minY = Math.min(...occupied.map((rect) => rect.y))
    const centerX =
      occupied.reduce((sum, rect) => sum + rect.x + rect.width / 2, 0) / occupied.length
    return {
      x: centerX,
      y: minY - GEN_GAP - size.height / 2,
    }
  }

  const maxRight = Math.max(sourceRect.x + sourceRect.width, ...occupied.map((rect) => rect.x + rect.width))
  const centerY = sourceRect.y + sourceRect.height / 2
  return {
    x: maxRight + GEN_GAP + size.width / 2,
    y: centerY,
  }
}

function findFreePointNearSource(
  sourceNode: Node,
  size: { width: number; height: number },
  occupied: LayoutRect[],
  placement: ResultPlacement,
  hint?: {
    layoutSlot?: number
    layoutTotal?: number
    columnOffset?: number
  },
) {
  if (
    typeof hint?.layoutTotal === 'number' &&
    hint.layoutTotal > 1 &&
    typeof hint.layoutSlot === 'number'
  ) {
    const startColumn = hint.columnOffset ?? 0
    for (let column = startColumn; column < startColumn + 40; column += 1) {
      const point = computeOutgoingResultNodePoint(sourceNode, size, {
        placement,
        layoutSlot: hint.layoutSlot,
        layoutTotal: hint.layoutTotal,
        columnOffset: column,
      })
      if (isPointFree(point, size, occupied)) return point
    }
  }

  const sourceRect = getNodeLayoutRect(sourceNode)
  const colStep = size.width + GEN_GAP
  const rowStep = size.height + GEN_GAP

  if (placement === 'above') {
    for (let column = 0; column < 40; column += 1) {
      const centerY = sourceRect.y - GEN_GAP - size.height / 2 - column * colStep
      for (let row = 0; row < 40; row += 1) {
        const rowOffsets = row === 0 ? [0] : [row, -row]
        for (const rowOffset of rowOffsets) {
          const centerX = sourceRect.x + sourceRect.width / 2 + rowOffset * rowStep
          const point = { x: centerX, y: centerY }
          if (isPointFree(point, size, occupied)) return point
        }
      }
    }
  } else {
    for (let column = 0; column < 40; column += 1) {
      const centerX = sourceRect.x + sourceRect.width + GEN_GAP + column * colStep + size.width / 2
      for (let row = 0; row < 40; row += 1) {
        const rowOffsets = row === 0 ? [0] : [row, -row]
        for (const rowOffset of rowOffsets) {
          const centerY = sourceRect.y + sourceRect.height / 2 + rowOffset * rowStep
          const point = { x: centerX, y: centerY }
          if (isPointFree(point, size, occupied)) return point
        }
      }
    }
  }

  return fallbackOutgoingPoint(sourceNode, size, occupied, placement)
}

/** 规划一批结果节点中心点，保证彼此及与画布已有节点不重叠 */
export function planOutgoingResultPoints(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  count: number,
  placement: ResultPlacement = 'right',
) {
  const safeCount = Math.max(1, Math.floor(count) || 1)
  const occupied = collectGraphNodeRects(graph)
  const points: { x: number; y: number }[] = []

  for (let index = 0; index < safeCount; index += 1) {
    const point = findFreePointNearSource(sourceNode, size, occupied, placement, {
      layoutSlot: safeCount > 1 ? index : undefined,
      layoutTotal: safeCount > 1 ? safeCount : undefined,
    })
    points.push(point)
    occupied.push(centerToRect(point, size))
  }

  return points
}

/** 并行生成结果节点：右侧纵向或上方横向错位排布 */
export function computeOutgoingResultNodePoint(
  sourceNode: Node,
  size: { width: number; height: number },
  options: OutgoingResultLayoutOptions = {},
) {
  const bbox = sourceNode.getBBox()
  const placement = options.placement ?? 'right'
  const slot = options.layoutSlot ?? 0
  const total = options.layoutTotal
  const columnOffset = options.columnOffset ?? 0

  if (placement === 'above') {
    const centerX = bbox.x + bbox.width / 2
    const y = bbox.y - GEN_GAP - size.height / 2 - columnOffset * (size.height + GEN_GAP)
    const step = size.width + GEN_GAP

    if (typeof total === 'number' && total > 1) {
      const span = total * size.width + (total - 1) * GEN_GAP
      const startX = centerX - span / 2 + size.width / 2
      return { x: startX + slot * step, y }
    }

    if (slot === 0) {
      return { x: centerX, y }
    }

    const layer = Math.ceil(slot / 2)
    const direction = slot % 2 === 1 ? 1 : -1
    return { x: centerX + direction * layer * step, y }
  }

  const x =
    bbox.x +
    bbox.width +
    GEN_GAP +
    size.width / 2 +
    columnOffset * (size.width + GEN_GAP)
  const centerY = bbox.y + bbox.height / 2
  const step = size.height + GEN_GAP

  if (typeof total === 'number' && total > 1) {
    const span = total * size.height + (total - 1) * GEN_GAP
    const startY = centerY - span / 2 + size.height / 2
    return { x, y: startY + slot * step }
  }

  if (slot === 0) {
    return { x, y: centerY }
  }

  const layer = Math.ceil(slot / 2)
  const direction = slot % 2 === 1 ? 1 : -1
  return { x, y: centerY + direction * layer * step }
}

/** 为一批并行结果节点预留不重叠的列偏移（兼容旧调用） */
export function reserveOutgoingBatchColumnOffset(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  count: number,
  placement: ResultPlacement = 'right',
) {
  const occupied = collectGraphNodeRects(graph)
  for (let column = 0; column < 40; column += 1) {
    let fits = true
    for (let slot = 0; slot < count; slot += 1) {
      const point = computeOutgoingResultNodePoint(sourceNode, size, {
        placement,
        layoutSlot: slot,
        layoutTotal: count,
        columnOffset: column,
      })
      if (!isPointFree(point, size, occupied)) {
        fits = false
        break
      }
    }
    if (fits) return column
  }
  return 0
}

/** 解析不重叠的结果节点中心点，优先在原任务周边排布 */
export function resolveOutgoingResultNodePoint(
  graph: Graph,
  sourceNode: Node,
  size: { width: number; height: number },
  options: OutgoingResultLayoutOptions = {},
) {
  const occupied = collectGraphNodeRects(graph)
  const placement = options.placement ?? 'right'
  const explicitSlot = options.layoutSlot

  return findFreePointNearSource(sourceNode, size, occupied, placement, {
    layoutSlot: explicitSlot,
    layoutTotal: options.layoutTotal,
    columnOffset: options.columnOffset,
  })
}
