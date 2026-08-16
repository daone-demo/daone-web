import type { Edge, Graph } from '@antv/x6'
import type { Scroller } from '@antv/x6-plugin-scroller'

type ScrollerImplLike = {
  localToBackgroundPoint(x: number, y: number): { x: number; y: number }
  clientToLocalPoint(x: number, y: number): { x: number; y: number }
  container: HTMLDivElement
}

function getScroller(graph: Graph): Scroller | null {
  return graph.getPlugin<Scroller>('scroller') ?? null
}

/**
 * 当前可视视口中心对应的图坐标。
 * scroller 模式下必须用 scrollerImpl.clientToLocalPoint（已计入 scrollLeft/padding/缩放），
 * 直接用 graph.clientToLocal 会忽略滚动偏移，导致新建节点落点偏移很大。
 */
export function clientPointToGraphLocal(
  graph: Graph,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const scroller = getScroller(graph)
  const impl = scroller
    ? (scroller as unknown as { scrollerImpl?: ScrollerImplLike }).scrollerImpl
    : undefined

  if (scroller && impl) {
    const p = impl.clientToLocalPoint(clientX, clientY)
    return { x: p.x, y: p.y }
  }

  return graph.clientToLocal(clientX, clientY)
}

export function getViewportCenterLocal(graph: Graph): { x: number; y: number } {
  const scroller = getScroller(graph)
  if (scroller) {
    const el = scroller.container
    const rect = el.getBoundingClientRect()
    return clientPointToGraphLocal(
      graph,
      rect.left + el.clientWidth / 2,
      rect.top + el.clientHeight / 2,
    )
  }

  const rect = graph.container.getBoundingClientRect()
  return clientPointToGraphLocal(graph, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

/**
 * 图坐标 → 浮层定位容器（.canvas）内的像素偏移。
 * 须使用不随 Scroller 滚动的容器；勿用 graph.container（会随内容滚动）。
 * 统一走 graph.localToClient，缩放/滚动时与节点视觉位置保持同步。
 */
export function graphLocalToContainerOffset(
  graph: Graph,
  localX: number,
  localY: number,
  container: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect()
  const client = graph.localToClient(localX, localY)
  return {
    left: client.x - containerRect.left,
    top: client.y - containerRect.top,
  }
}

type EdgeViewLike = {
  getPointAtRatio?: (ratio: number) => { x: number; y: number }
}

/** 连线几何中点（图坐标），优先取路径 50% 位置 */
export function getEdgeMidpointLocal(graph: Graph, edge: Edge) {
  const view = graph.findViewByCell(edge) as EdgeViewLike | null
  if (view?.getPointAtRatio) {
    return view.getPointAtRatio(0.5)
  }
  return edge.getBBox().getCenter()
}

/** 连线删除按钮在 .canvas 容器内的定位 */
export function getEdgeDeleteButtonPosition(graph: Graph, edge: Edge, container: HTMLElement) {
  const mid = getEdgeMidpointLocal(graph, edge)
  return graphLocalToContainerOffset(graph, mid.x, mid.y, container)
}
