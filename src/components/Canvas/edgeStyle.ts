import type { Edge, Graph } from '@antv/x6'

/** 选中连线高亮色 */
export const FLOW_EDGE_SELECTED_COLOR = '#6b7cff'
/** 拖拽预览端点圆点 */
export const FLOW_EDGE_PREVIEW_DOT_COLOR = '#6b7cff'

/** @deprecated 保留兼容，实际颜色由主题驱动 */
export const FLOW_EDGE_COLOR = '#787f8a'

let canvasEdgeStroke = FLOW_EDGE_COLOR

export function setCanvasEdgeStroke(color: string) {
  canvasEdgeStroke = color
}

export function getCanvasEdgeStroke() {
  return canvasEdgeStroke
}

type CanvasGraphLike = Graph & { __connectPreviewEdgeId?: string }

function isPreviewEdge(graph: Graph, edge: Edge) {
  return (graph as CanvasGraphLike).__connectPreviewEdgeId === edge.id
}

export function getFlowEdgeLineAttrs(
  stroke = canvasEdgeStroke,
  selected = false,
  preview = false,
) {
  const color = selected ? FLOW_EDGE_SELECTED_COLOR : stroke
  return {
    stroke: color,
    strokeWidth: selected ? 2 : 1.5,
    strokeLinecap: 'round' as const,
    targetMarker: preview
      ? {
          name: 'circle' as const,
          r: 5,
          fill: FLOW_EDGE_PREVIEW_DOT_COLOR,
          stroke: '#ffffff',
          strokeWidth: 1.5,
        }
      : null,
  }
}

export function getFlowEdgeAttrs(
  stroke = canvasEdgeStroke,
  selected = false,
  preview = false,
) {
  return {
    line: getFlowEdgeLineAttrs(stroke, selected, preview),
    wrap: {
      strokeWidth: 16,
      stroke: 'transparent',
      fill: 'none',
      cursor: 'pointer',
    },
  }
}

/** 拖拽连线预览：浅灰曲线 + 端点蓝色圆点 */
export function getPreviewEdgeAttrs() {
  return getFlowEdgeAttrs(canvasEdgeStroke, false, true)
}

export function applyFlowEdgeStyle(
  graph: Graph,
  edge: Edge,
  selected = false,
) {
  const preview = isPreviewEdge(graph, edge)
  edge.setAttrs(getFlowEdgeAttrs(canvasEdgeStroke, selected, preview))
  const view = graph.findViewByCell(edge)
  if (!view) return
  view.removeClass('canvas-edge--selected')
  view.removeClass('canvas-edge--preview')
  if (selected) view.addClass('canvas-edge--selected')
  if (preview) view.addClass('canvas-edge--preview')
}

export function syncEdgeSelectionHighlight(
  graph: Graph,
  selectedEdgeId = '',
  hoveredEdgeId = '',
) {
  graph.getEdges().forEach((edge) => {
    const highlighted = edge.id === selectedEdgeId || edge.id === hoveredEdgeId
    applyFlowEdgeStyle(graph, edge, highlighted)
  })
}

export function bindFlowEdgeInteraction(graph: Graph) {
  graph.on('edge:added', ({ edge }) => {
    applyFlowEdgeStyle(graph, edge as Edge)
  })
  graph.getEdges().forEach((edge) => applyFlowEdgeStyle(graph, edge))
}
