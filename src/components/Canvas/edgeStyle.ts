import type { Edge, Graph } from '@antv/x6'

/** 画布连线主色（电流输出效果） */
export const FLOW_EDGE_COLOR = '#6b7cff'
export const FLOW_EDGE_SELECTED_COLOR = '#f97316'

const FLOW_EDGE_DASH = '12 7'

export function getFlowEdgeLineAttrs(stroke = FLOW_EDGE_COLOR, selected = false) {
  return {
    stroke,
    strokeWidth: selected ? 3.5 : 2.5,
    strokeLinecap: 'round' as const,
    strokeDasharray: FLOW_EDGE_DASH,
    targetMarker: {
      name: 'block' as const,
      width: 10,
      height: 8,
      fill: stroke,
      stroke,
    },
  }
}

export function getFlowEdgeAttrs(stroke = FLOW_EDGE_COLOR, selected = false) {
  return {
    line: getFlowEdgeLineAttrs(stroke, selected),
    wrap: {
      strokeWidth: 16,
      stroke: 'transparent',
      fill: 'none',
      cursor: 'pointer',
    },
  }
}

export function applyFlowEdgeStyle(
  graph: Graph,
  edge: Edge,
  selected = false,
) {
  edge.setAttrs(getFlowEdgeAttrs(FLOW_EDGE_COLOR, selected))
  const view = graph.findViewByCell(edge)
  if (!view) return
  if (selected) {
    view.addClass('canvas-edge--selected')
  } else {
    view.removeClass('canvas-edge--selected')
  }
}

export function syncEdgeSelectionHighlight(graph: Graph, selectedEdgeId = '') {
  graph.getEdges().forEach((edge) => {
    applyFlowEdgeStyle(graph, edge, edge.id === selectedEdgeId)
  })
}

export function bindFlowEdgeInteraction(graph: Graph) {
  graph.on('edge:added', ({ edge }) => {
    applyFlowEdgeStyle(graph, edge as Edge)
  })
  graph.getEdges().forEach((edge) => applyFlowEdgeStyle(graph, edge))
}
