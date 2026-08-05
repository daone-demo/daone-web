import { useModalStore } from '@stores/useModal'
import { useRouter } from 'vue-router'
import type { Node } from '@antv/x6'
import { TEXT_EDITOR_PLACEHOLDER } from '../../constants'
import { createCanvasState } from './state'
import type { CanvasBindings, CanvasDomRefs, CanvasEmit } from './types'
import type { CanvasState } from './state'
import { registerCore } from './registerCore'

export type { CanvasEmit, CanvasDomRefs } from './types'

type ChatTaskCreatedPayload = {
  taskId: string | number
  taskType?: string
  taskName?: string
  prompt?: string
  capabilityCode?: string
  nodeId?: string
}

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
  | 'showVideoGenCanvasPickMode'
    | 'showImageDialogueCanvasPickMode'
    | 'imageDialogueSettings'
    | 'videoDialogueSettings'
    | 'showImageToolbarCustomize'
    | 'imageToolbarCustomizeSettings'
    | 'mentionInsertSerial'
    | 'mentionInsertToken'
    | 'showImageContextMenu'
    | 'imageContextMenuPos'
    | 'imageContextMenuNodeId'
    | 'imageContextMenuKind'
    | 'imagePreviewKind'
    | 'showProjectBrowser'
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
    | 'imageInpaintSource'
    | 'closeImageExpand'
    | 'onImageExpandComplete'
    | 'imageExpandSource'
    | 'closeImageEditText'
    | 'onImageEditTextApply'
    | 'handleImageDialogueSubmit'
    | 'handleVideoDialogueSubmit'
    | 'handleVideoGenPromptSubmit'
    | 'onImageDialogueAddCanvasNode'
    | 'onImageDialogueAddDigitalHumanRef'
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
    | 'closeImageToolbarCustomize'
    | 'saveImageToolbarCustomize'
    | 'toggleVideoGenCanvasPickMode'
    | 'toggleImageDialogueCanvasPickMode'
    | 'elementMarks'
    | 'imageMarkAnalyzingActive'
    | 'toggleImageDialogueMarkMode'
    | 'updateImageMarkLabel'
    | 'removeElementMark'
    | 'clearElementMarks'
    | 'resolveElementMarkPreviewUrl'
    | 'onImageContextMenuAction'
    | 'imageContextMenuLocked'
    | 'showElementSelectBar'
    | 'imageMarkHintVisible'
    | 'imageMarkHints'
    | 'openProjectBrowser'
    | 'closeProjectBrowser'
  > & {
    createNodeFromChatTask: (payload: ChatTaskCreatedPayload) => Node | null
  }

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
