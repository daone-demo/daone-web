import { MiniMap } from '@antv/x6-plugin-minimap'
import '@antv/x6-plugin-minimap/es/index.css'
import type { Graph } from '@antv/x6'
import { getCanvasBgThemeMeta, type CanvasBgTheme } from './canvasTheme'

export const MINIMAP_SIZE = {
  width: 180,
  height: 112,
  padding: 8,
}

export function createMinimap(
  graph: Graph,
  container: HTMLElement,
  bgTheme: CanvasBgTheme = 'dark',
) {
  const minimap = new MiniMap({
    container,
    width: MINIMAP_SIZE.width,
    height: MINIMAP_SIZE.height,
    padding: MINIMAP_SIZE.padding,
    scalable: false,
    graphOptions: {
      background: { color: getCanvasBgThemeMeta(bgTheme).minimapBg },
    },
  })
  graph.use(minimap)
  return minimap
}

export function destroyMinimap(graph: Graph) {
  graph.disposePlugins('minimap')
}
