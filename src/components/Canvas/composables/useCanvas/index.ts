import { useModalStore } from '@stores/useModal'
import { useRouter } from 'vue-router'
import { TEXT_EDITOR_PLACEHOLDER } from '../../constants'
import { createCanvasState } from './state'
import type { CanvasBindings, CanvasDomRefs, CanvasEmit } from './types'
import type { CanvasState } from './state'
import { registerCore } from './registerCore'

export type { CanvasEmit, CanvasDomRefs } from './types'

type GridSplitCanvasApi = Pick<
  CanvasState,
  | 'showImageGridSplit'
  | 'imageGridSplitPos'
  | 'gridSplitRows'
  | 'gridSplitCols'
  | 'showImageErase'
  | 'eraseSourceNodeId'
  | 'imageErasePos'
  | 'showImageInpaint'
  | 'inpaintSourceNodeId'
  | 'imageInpaintPos'
  | 'showImageExpand'
  | 'expandSourceNodeId'
  | 'imageExpandPos'
  | 'showImageEditText'
  | 'editTextSourceNodeId'
  | 'imageEditTextPos'
  | 'imageEditTextEntries'
  | 'imageEditTextRecognizing'
  | 'showImageResizeOverlay'
  | 'imageResizeOverlay'
  | 'videoGenAspectRatio'
  | 'imageDialogueSettings'
  | 'videoDialogueSettings'
> &
  Pick<
    CanvasBindings,
    | 'closeImageGridSplit'
    | 'onImageGridSplitComplete'
    | 'imageGridSplitSource'
    | 'closeImageErase'
    | 'onImageEraseComplete'
    | 'imageEraseSource'
    | 'closeImageInpaint'
    | 'onImageInpaintComplete'
    | 'onImageInpaintDragStart'
    | 'onImageExpandDragStart'
    | 'imageInpaintSource'
    | 'closeImageExpand'
    | 'onImageExpandComplete'
    | 'imageExpandSource'
    | 'closeImageEditText'
    | 'onImageEditTextApply'
    | 'handleImageDialogueSubmit'
    | 'handleVideoDialogueSubmit'
    | 'handleVideoGenPromptSubmit'
    | 'onVideoGenAspectRatioChange'
    | 'onVideoToolbarAction'
    | 'isText2VideoTask'
    | 'isText2ImageTask'
    | 'promptSubmitLabel'
    | 'onImageResizePointerDown'
    | 'persistImageDialogueFields'
    | 'persistVideoDialogueFields'
    | 'videoDialogueSourceRefs'
    | 'videoGenSavedSettings'
    | 'showVideoDialoguePanel'
  >

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
  } as unknown as ReturnType<typeof import('./_legacy').useCanvas> & GridSplitCanvasApi
}
