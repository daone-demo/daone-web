import { useModalStore } from '@stores/useModal'
import { useRouter } from 'vue-router'
import { TEXT_EDITOR_PLACEHOLDER } from '../../constants'
import { createCanvasState } from './state'
import type { CanvasBindings, CanvasDomRefs, CanvasEmit, UseCanvasApi } from './types'
import { registerCore } from './registerCore'

export type { CanvasEmit, CanvasDomRefs, UseCanvasApi } from './types'

/**
 * 组装画布运行时绑定：
 * 1. createCanvasState —— 全部响应式状态
 * 2. registerCore —— computed / 方法 / 生命周期 / provide
 * 对外签名与解构字段必须保持稳定（见 Canvas/index.vue、defineExpose）。
 */
function createBindings(emit: CanvasEmit, domRefs: CanvasDomRefs): CanvasBindings {
  const state = createCanvasState(emit, domRefs)
  const bind = {
    ...state,
    router: useRouter(),
    modalStore: useModalStore(),
    textEditorApis: new Map(),
    groupOverlayDrag: {
      active: false,
      lastGraphX: 0,
      lastGraphY: 0,
      nodeIds: [] as string[],
    },
    groupOverlayResize: {
      active: false,
      handle: '' as import('../../nodeGroup').GroupResizeHandle | '',
      groupId: '',
      startBox: { x: 0, y: 0, width: 0, height: 0 },
      currentBox: { x: 0, y: 0, width: 0, height: 0 },
      startPointerX: 0,
      startPointerY: 0,
    },
    groupMoveState: {
      anchorId: '',
      draggingNodeId: '',
      lastX: 0,
      lastY: 0,
    },
  } as CanvasBindings

  Object.assign(bind, registerCore(bind))

  return bind
}

export function useCanvas(emit: CanvasEmit, domRefs: CanvasDomRefs): UseCanvasApi {
  const bind = createBindings(emit, domRefs)
  return {
    ...bind,
    TEXT_EDITOR_PLACEHOLDER,
    getNodeCount: () => bind.nodeCount.value,
  } as UseCanvasApi
}
