import type { Graph } from '@antv/x6'
import { getCanvasSnapshot, type CanvasSnapshot, type CanvasSnapshotMeta } from './canvasSnapshot'
import { ensureInfiniteCanvasArea, getScroller } from './graph'

export function applyCanvasSnapshot(graph: Graph, snapshot: CanvasSnapshot) {
  graph.fromJSON(snapshot.graph)
  graph.zoomTo(snapshot.viewport.zoom)
  graph.translate(snapshot.viewport.translateX, snapshot.viewport.translateY)

  ensureInfiniteCanvasArea(graph)

  const scroller = getScroller(graph)
  if (scroller?.container) {
    scroller.container.scrollLeft = snapshot.viewport.scrollLeft
    scroller.container.scrollTop = snapshot.viewport.scrollTop
  }
}

export function createCanvasHistory(getMeta: () => CanvasSnapshotMeta) {
  const past: CanvasSnapshot[] = []
  const future: CanvasSnapshot[] = []
  let recording = true

  function capture(graph: Graph) {
    return getCanvasSnapshot(graph, getMeta())
  }

  function push(graph: Graph) {
    if (!recording) return
    const snap = capture(graph)
    const last = past[past.length - 1]
    if (last && JSON.stringify(last.graph) === JSON.stringify(snap.graph)) return
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
    applyCanvasSnapshot(graph, past[past.length - 1]!)
    recording = true
    return true
  }

  function redo(graph: Graph) {
    if (future.length === 0) return false
    const next = future.pop()!
    recording = false
    applyCanvasSnapshot(graph, next)
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
