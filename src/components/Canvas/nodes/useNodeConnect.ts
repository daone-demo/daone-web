import { inject, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasGraph } from '../graph'
import { getFlowEdgeAttrs } from '../edgeStyle'
import type { CanvasNodeData } from '../constants'
import {
  canImageNodeAcceptIncoming,
  canOpenConnectMenu,
  removeSourcePreviewEdges,
} from '../nodeConnect'
import { canLinkImageToNode } from '../videoGen'

let activeEdgeId: string | null = null

export function useNodeConnect() {
  const getNode = inject<() => Node>('getNode')!
  const dragging = ref(false)

  function onPlusPointerDown(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const node = getNode()
    const graph = node.model?.graph
    if (!graph || !canOpenConnectMenu(node)) return
    const g = graph

    if (activeEdgeId) {
      const stale = g.getCellById(activeEdgeId)
      if (stale?.isEdge()) g.removeCell(stale)
      activeEdgeId = null
    }

    const canvasGraph = g as CanvasGraph
    if (canvasGraph.__connectPreviewEdgeId) {
      const preview = g.getCellById(canvasGraph.__connectPreviewEdgeId)
      if (preview?.isEdge()) g.removeCell(preview)
      canvasGraph.__connectPreviewEdgeId = ''
    }

    const sourceId = node.id
    removeSourcePreviewEdges(g, sourceId)

    dragging.value = true
    const local = g.clientToLocal(event.clientX, event.clientY)
    const edge = g.addEdge({
      source: { cell: sourceId, port: 'right' },
      target: { x: local.x, y: local.y },
      attrs: getFlowEdgeAttrs(),
      zIndex: 0,
    })
    activeEdgeId = edge.id

    function onMove(e: MouseEvent) {
      const point = g.clientToLocal(e.clientX, e.clientY)
      edge.setTarget(point)
    }

    function onUp(e: MouseEvent) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragging.value = false
      activeEdgeId = null

      const point = g.clientToLocal(e.clientX, e.clientY)
      const targetView = g
        .findViewsFromPoint(point)
        .find((view) => view.cell.isNode() && view.cell.id !== sourceId)
      const targetNode = targetView?.cell

      if (targetNode?.isNode()) {
        const sourceData = node.getData() as CanvasNodeData
        const targetData = targetNode.getData() as CanvasNodeData
        const canLink =
          sourceData.kind === 'image' &&
          sourceData.previewUrl &&
          (canLinkImageToNode(targetData) || canImageNodeAcceptIncoming(targetData))

        if (!canLink) {
          g.removeCell(edge)
          return
        }

        edge.setTarget({ cell: targetNode.id, port: 'left' })
        ;(g as CanvasGraph).__connectPreviewEdgeId = ''
        ;(g as CanvasGraph).__onNodeEdgeLinked?.(targetNode.id, node.id)
        return
      }

      ;(g as CanvasGraph).__connectPreviewEdgeId = edge.id
      edge.setTarget(point)
      const openMenu = (g as CanvasGraph).__openConnectMenu
      openMenu?.(sourceId, point)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { onPlusPointerDown, dragging }
}
