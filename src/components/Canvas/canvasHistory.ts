import type { Graph } from '@antv/x6'
import { getCanvasSnapshot, type CanvasSnapshot, type CanvasSnapshotMeta } from './canvasSnapshot'
import {
  ensureInfiniteCanvasArea,
  getScroller,
  migrateGraphJsonForHtmlShape,
  refreshCanvasNodeViews,
} from './graph'

export type ApplyCanvasSnapshotOptions = {
  /** undo/redo 时保持当前缩放与平移，避免画布位置跳动 */
  preserveViewport?: boolean
}

function applyHistoryGraphSnapshot(graph: Graph, snapshot: CanvasSnapshot) {
  const json = migrateGraphJsonForHtmlShape(snapshot.graph)
  const container = graph.container as HTMLElement | undefined
  const prevVisibility = container?.style.visibility ?? ''
  if (container) container.style.visibility = 'hidden'
  try {
    graph.batchUpdate('history-restore', () => {
      graph.fromJSON(json)
    })
    refreshCanvasNodeViews(graph)
  } finally {
    if (container) container.style.visibility = prevVisibility
  }
}

export function applyCanvasSnapshot(
  graph: Graph,
  snapshot: CanvasSnapshot,
  options?: ApplyCanvasSnapshotOptions,
) {
  if (options?.preserveViewport) {
    applyHistoryGraphSnapshot(graph, snapshot)
    return
  }

  graph.fromJSON(migrateGraphJsonForHtmlShape(snapshot.graph))
  graph.zoomTo(snapshot.viewport.zoom)
  graph.translate(snapshot.viewport.translateX, snapshot.viewport.translateY)

  const scroller = getScroller(graph)
  if (scroller?.container) {
    scroller.container.scrollLeft = snapshot.viewport.scrollLeft
    scroller.container.scrollTop = snapshot.viewport.scrollTop
  }

  ensureInfiniteCanvasArea(graph)
}

export function createCanvasHistory(getMeta: () => CanvasSnapshotMeta) {
  const past: CanvasSnapshot[] = []
  const future: CanvasSnapshot[] = []
  let recording = true

  function capture(graph: Graph) {
    return getCanvasSnapshot(graph, getMeta())
  }

  function getGraphChangeKey(snapshot: CanvasSnapshot) {
    const cells = snapshot.graph.cells ?? []
    const cellIds = cells.map((cell) => String(cell.id ?? '')).join('\u0001')
    return `${snapshot.summary.nodeCount}:${snapshot.summary.edgeCount}:${cells.length}:${cellIds}`
  }

  function push(graph: Graph) {
    if (!recording) return
    const snap = capture(graph)
    const last = past[past.length - 1]
    if (last && getGraphChangeKey(last) === getGraphChangeKey(snap)) return
    past.push(snap)
    if (past.length > 40) past.shift()
    future.length = 0
  }

  function seed(graph: Graph) {
    past.length = 0
    future.length = 0
    past.push(capture(graph))
  }

  function undo(graph: Graph) {
    if (past.length <= 1) return false
    const current = past.pop()!
    future.push(current)
    recording = false
    applyCanvasSnapshot(graph, past[past.length - 1]!, { preserveViewport: true })
    recording = true
    return true
  }

  function redo(graph: Graph) {
    if (future.length === 0) return false
    const next = future.pop()!
    recording = false
    applyCanvasSnapshot(graph, next, { preserveViewport: true })
    past.push(next)
    recording = true
    return true
  }

  return {
    push,
    seed,
    undo,
    redo,
    canUndo: () => past.length > 1,
    canRedo: () => future.length > 0,
  }
}
