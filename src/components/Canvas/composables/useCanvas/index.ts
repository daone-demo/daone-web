import { useModalStore } from '@stores/useModal'
import { useRouter } from 'vue-router'
import { TEXT_EDITOR_PLACEHOLDER } from '../../constants'
import { createCanvasState } from './state'
import type { CanvasBindings, CanvasDomRefs, CanvasEmit } from './types'
import { registerCore } from './registerCore'

export type { CanvasEmit, CanvasDomRefs } from './types'

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
    groupMoveState: {
      anchorId: '',
      lastX: 0,
      lastY: 0,
    },
  } as CanvasBindings

  Object.assign(bind, registerCore(bind))

  return bind
}

export function useCanvas(emit: CanvasEmit, domRefs: CanvasDomRefs) {
  const bind = createBindings(emit, domRefs)
  return {
    ...bind,
    TEXT_EDITOR_PLACEHOLDER,
    getNodeCount: () => bind.nodeCount.value,
  } as unknown as ReturnType<typeof import('./_legacy').useCanvas>
}
