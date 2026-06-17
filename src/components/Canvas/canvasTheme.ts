import type { Graph } from '@antv/x6'
import { applyFlowEdgeStyle } from './edgeStyle'

export type CanvasBgTheme = 'dark' | 'light'

export interface CanvasBgThemeMeta {
  label: string
  pageBg: string
  graphBg: string
  gridColor: string
  edgeStroke: string
  minimapBg: string
}

const CANVAS_BG_THEMES: Record<CanvasBgTheme, CanvasBgThemeMeta> = {
  dark: {
    label: '深色',
    pageBg: '#141416',
    graphBg: '#141416',
    gridColor: '#2a2a30',
    edgeStroke: '#e5e7eb',
    minimapBg: '#1a1a1e',
  },
  light: {
    label: '灰色',
    pageBg: '#e8eaed',
    graphBg: '#e8eaed',
    gridColor: '#b8bcc4',
    edgeStroke: '#6b7280',
    minimapBg: '#e8eaed',
  },
}

export function getCanvasBgThemeMeta(theme: CanvasBgTheme): CanvasBgThemeMeta {
  return CANVAS_BG_THEMES[theme]
}

let defaultEdgeStroke = CANVAS_BG_THEMES.dark.edgeStroke

export function getDefaultEdgeStroke() {
  return defaultEdgeStroke
}

export function syncGraphThemeDefaults(theme: CanvasBgTheme) {
  defaultEdgeStroke = getCanvasBgThemeMeta(theme).edgeStroke
}

type ScrollerPlugin = {
  drawBackground: (options?: { color?: string }) => void
  container: HTMLElement
}

/** 同步 Scroller 各层背景，避免仅主绘图区变色、边距区域仍为深色 */
function syncScrollerCanvasTheme(graph: Graph, pageBg: string, graphBg: string) {
  const scroller = graph.getPlugin('scroller') as unknown as ScrollerPlugin | null
  if (!scroller) return

  scroller.drawBackground({ color: graphBg })
  scroller.container.style.backgroundColor = pageBg

  const bgEl = scroller.container.querySelector(
    '.x6-graph-scroller-background',
  ) as HTMLElement | null
  if (bgEl) {
    bgEl.style.backgroundColor = graphBg
  }
}

export function applyCanvasBgTheme(
  graph: Graph | null,
  theme: CanvasBgTheme,
  gridVisible = true,
) {
  syncGraphThemeDefaults(theme)
  if (!graph) return

  const meta = getCanvasBgThemeMeta(theme)
  const bgOptions = { color: meta.graphBg }

  // 须走 Graph API，才能更新 Scroller 插件承载的全画布背景
  graph.drawBackground(bgOptions)
  syncScrollerCanvasTheme(graph, meta.pageBg, meta.graphBg)

  if (gridVisible) {
    graph.setGridSize(16)
    graph.drawGrid({
      type: 'dot',
      args: { color: meta.gridColor, thickness: 1.2 },
    })
    graph.showGrid()
  } else {
    graph.hideGrid()
  }

  graph.getEdges().forEach((edge) => {
    applyFlowEdgeStyle(graph, edge)
  })
}
