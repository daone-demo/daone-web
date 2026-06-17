import { inject, ref } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasNodeData } from '../constants'
import { getBaseNodeSize } from '../graph'

const MIN_VIEW_SCALE = 0.35
const MAX_VIEW_SCALE = 3

export function useNodeViewScale() {
  const getNode = inject<() => Node>('getNode')!
  const previewScale = ref<number | null>(null)
  const isResizing = ref(false)

  function startResize(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()

    const node = getNode()
    const graph = node.model?.graph
    if (!graph) return

    const data = node.getData() as CanvasNodeData
    if (!data.previewUrl || !data.mediaWidth || !data.mediaHeight) return

    const startScale = data.viewScale ?? 1
    const baseSize = getBaseNodeSize(data.kind, data.mode, { ...data, viewScale: 1 })
    const startX = event.clientX
    const startY = event.clientY
    const zoom = graph.zoom() || 1

    isResizing.value = true
    previewScale.value = startScale

    function onMove(e: MouseEvent) {
      const dx = (e.clientX - startX) / zoom
      const dy = (e.clientY - startY) / zoom
      const delta = (dx + dy) / 2
      const nextScale = Math.max(
        MIN_VIEW_SCALE,
        Math.min(MAX_VIEW_SCALE, startScale + delta / baseSize.width),
      )

      previewScale.value = nextScale
      node.resize(
        Math.round(baseSize.width * nextScale),
        Math.round(baseSize.height * nextScale),
      )
    }

    function onUp() {
      const finalScale = previewScale.value ?? startScale
      const current = node.getData() as CanvasNodeData
      node.setData({ ...current, viewScale: finalScale })

      isResizing.value = false
      previewScale.value = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return {
    startResize,
    previewScale,
    isResizing,
  }
}
