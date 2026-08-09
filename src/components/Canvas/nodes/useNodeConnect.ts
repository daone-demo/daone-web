import { inject, ref } from 'vue'
import type { Graph, Node } from '@antv/x6'
import type { CanvasGraph } from '../graph'
import { getFlowEdgeAttrs, getPreviewEdgeAttrs } from '../edgeStyle'
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
  const getGraph = inject<(() => Graph | undefined) | undefined>('getGraph', undefined)
  const dragging = ref(false)

  function resolveNodeGraph(node: Node): Graph | null {
    return getGraph?.() ?? node.model?.graph ?? null
  }

  /** x6-html-shape 会在 capture 阶段吞掉 button 的 mousedown，需用 pointerdown */
  function onPlusPointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const node = getNode()
    const g = resolveNodeGraph(node)
    if (!g || !canOpenConnectMenu(node)) return
    ;(g as CanvasGraph).__deactivateTextEditorToolbar?.()

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
      attrs: getPreviewEdgeAttrs(),
      zIndex: 0,
    })
    activeEdgeId = edge.id

    const captureTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    function onMove(e: PointerEvent) {
      if (e.pointerId !== event.pointerId) return
      const point = g.clientToLocal(e.clientX, e.clientY)
      edge.setTarget(point)
    }

    function onUp(e: PointerEvent) {
      if (e.pointerId !== event.pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (captureTarget?.hasPointerCapture?.(event.pointerId)) {
        captureTarget.releasePointerCapture(event.pointerId)
      }
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
        edge.setAttrs(getFlowEdgeAttrs())
        ;(g as CanvasGraph).__connectPreviewEdgeId = ''
        ;(g as CanvasGraph).__onNodeEdgeLinked?.(targetNode.id, node.id)
        return
      }

      ;(g as CanvasGraph).__connectPreviewEdgeId = edge.id
      edge.setTarget(point)
      edge.setAttrs(getPreviewEdgeAttrs())
      const openMenu = (g as CanvasGraph).__openConnectMenu
      openMenu?.(sourceId, point)
    }

    captureTarget?.setPointerCapture?.(event.pointerId)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return { onPlusPointerDown, dragging }
}
