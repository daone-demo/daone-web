import type { Graph } from '@antv/x6'
import type { CanvasBgTheme } from './canvasTheme'
import type { CanvasNodeData } from './constants'
import { getScroller } from './graph'

export interface CanvasSnapshotMeta {
  projectId: string
  projectName: string
  canvasBgTheme: CanvasBgTheme
  gridVisible: boolean
  panMode: boolean
  showMinimap: boolean
}

export interface CanvasSnapshot {
  version: 1
  savedAt: string
  meta: CanvasSnapshotMeta
  viewport: {
    zoom: number
    translateX: number
    translateY: number
    scrollLeft: number
    scrollTop: number
  }
  graph: ReturnType<Graph['toJSON']>
  summary: {
    nodeCount: number
    edgeCount: number
  }
}

function sanitizeNodeData(data: CanvasNodeData): CanvasNodeData {
  const { isSelected: _isSelected, ...rest } = data
  return rest
}

export function getCanvasSnapshot(graph: Graph, meta: CanvasSnapshotMeta): CanvasSnapshot {
  const raw = graph.toJSON()
  const cells = raw.cells?.map((cell) => {
    if ('data' in cell && cell.data && typeof cell.data === 'object') {
      return {
        ...cell,
        data: sanitizeNodeData(cell.data as CanvasNodeData),
      }
    }
    return cell
  })

  const translation = graph.translate()
  const scroller = getScroller(graph)

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    meta,
    viewport: {
      zoom: graph.zoom(),
      translateX: translation.tx,
      translateY: translation.ty,
      scrollLeft: scroller?.container?.scrollLeft ?? 0,
      scrollTop: scroller?.container?.scrollTop ?? 0,
    },
    graph: {
      ...raw,
      cells,
    },
    summary: {
      nodeCount: graph.getNodes().length,
      edgeCount: graph.getEdges().length,
    },
  }
}

export function getCanvasSnapshotStorageKey(projectId: string) {
  return `design-canvas:${projectId}`
}

export function saveCanvasSnapshotToStorage(snapshot: CanvasSnapshot) {
  const key = getCanvasSnapshotStorageKey(snapshot.meta.projectId)
  localStorage.setItem(key, JSON.stringify(snapshot))
  return key
}
