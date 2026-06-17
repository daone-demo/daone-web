import { inject } from 'vue'
import type { Node } from '@antv/x6'
import type { CanvasGraph } from '../graph'

export function useNodeDelete() {
  const getNode = inject<() => Node>('getNode')!

  function removeSelf() {
    const node = getNode()
    const graph = node.model?.graph as CanvasGraph | undefined
    if (!graph) return

    // 删除可能正处于编辑（聚焦）状态的节点：先让焦点元素失焦，
    // 避免卸载承载该按钮的 Vue 节点时焦点元素被移除引发异常。
    ;(document.activeElement as HTMLElement | null)?.blur?.()

    // 关键：不要在按钮自身的 mousedown/click 事件派发过程中同步卸载本组件，
    // 否则会在事件途中销毁正在派发事件的 DOM，导致删除被中断而“看似无效”。
    // 延后到下一帧执行，确保事件派发结束后再移除。
    requestAnimationFrame(() => {
      if (typeof graph.__deleteCanvasNode === 'function') {
        graph.__deleteCanvasNode(node.id)
      } else {
        graph.removeCell(node)
      }
    })
  }

  return { removeSelf }
}
