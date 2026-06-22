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

export function normalizeCanvasSnapshot(
  data: Partial<CanvasSnapshot>,
  fallback: Pick<CanvasSnapshotMeta, 'projectId' | 'projectName'>,
): CanvasSnapshot {
  return {
    version: 1,
    savedAt: data.savedAt ?? new Date().toISOString(),
    meta: {
      projectId: data.meta?.projectId ?? fallback.projectId,
      projectName: data.meta?.projectName ?? fallback.projectName,
      canvasBgTheme: data.meta?.canvasBgTheme ?? 'light',
      gridVisible: data.meta?.gridVisible ?? false,
      panMode: data.meta?.panMode ?? false,
      showMinimap: data.meta?.showMinimap ?? false,
    },
    viewport: {
      zoom: data.viewport?.zoom ?? 1,
      translateX: data.viewport?.translateX ?? 0,
      translateY: data.viewport?.translateY ?? 0,
      scrollLeft: data.viewport?.scrollLeft ?? 0,
      scrollTop: data.viewport?.scrollTop ?? 0,
    },
    graph: data.graph ?? { cells: [] },
    summary: {
      nodeCount: data.summary?.nodeCount ?? 0,
      edgeCount: data.summary?.edgeCount ?? 0,
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
