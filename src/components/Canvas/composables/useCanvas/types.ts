import type { Ref, ShallowRef, ComputedRef } from 'vue'
import type { Graph } from '@antv/x6'
import type CanvasNodeOverlays from '../../panels/CanvasNodeOverlays.vue'
import type CanvasBottomLeftDock from '../../panels/CanvasBottomLeftDock.vue'
import type CanvasHiddenFileInput from '../../panels/CanvasHiddenFileInput.vue'
import type CanvasTextExpandEditor from '../../panels/CanvasTextExpandEditor.vue'
import type { TextEditorApi } from '../../nodes/useTextEditorRegistry'
import type { CanvasState } from './state'

export type CanvasEmit = {
  (event: 'focus-chat'): void
  (event: 'add-to-chat', payload: { previewUrl: string; fileName: string }): void
  (event: 'save-skill-to-chat', payload: { file: File; skillName: string }): void
}

export type CanvasDomRefs = {
  canvasRef: Ref<HTMLElement | null>
  graphRef: Ref<HTMLElement | null>
  nodeOverlaysRef: Ref<InstanceType<typeof CanvasNodeOverlays> | null>
  fileInputComponentRef: Ref<InstanceType<typeof CanvasHiddenFileInput> | null>
  bottomLeftDockRef: Ref<InstanceType<typeof CanvasBottomLeftDock> | null>
  textExpandEditorComponentRef: Ref<InstanceType<typeof CanvasTextExpandEditor> | null>
}

export type CanvasBindings = CanvasState & {
  router: ReturnType<typeof import('vue-router').useRouter>
  modalStore: ReturnType<typeof import('@stores/useModal').useModalStore>
  textEditorApis: Map<string, TextEditorApi>
  groupOverlayDrag: {
    active: boolean
    lastGraphX: number
    lastGraphY: number
    nodeIds: string[]
  }
  groupMoveState: {
    anchorId: string
    lastX: number
    lastY: number
  }
  // computed + methods merged at runtime via registerCore
  zoomPercent: ComputedRef<string>
  currentProjectName: ComputedRef<string>
  canvasBgThemeLabel: ComputedRef<string>
  activeGroupSelection: ComputedRef<ReturnType<typeof import('../../nodeGroup').getCompleteGroupSelection> | null>
  showGroupToolbar: ComputedRef<boolean>
  showPromptBar: ComputedRef<boolean>
  showImageGenPromptBar: ComputedRef<boolean>
  showVideoGenPromptBar: ComputedRef<boolean>
  videoGenSourceRefs: ComputedRef<import('../../constants').ImageSourceRef[]>
  showImageCreativeToolbar: ComputedRef<boolean>
  showTextFormatToolbar: ComputedRef<boolean>
  isImg2PromptTask: ComputedRef<boolean>
  canSubmitTextPrompt: ComputedRef<boolean>
  imageCropSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageDialoguePreviews: ComputedRef<import('../../constants').ImageSourceRef[]>
  imageDialoguePreviewUrl: ComputedRef<string>
  showNodeToolbar: ComputedRef<boolean>
  showMultiSelectToolbar: ComputedRef<boolean>
  showToolbarFeatureButtons: ComputedRef<boolean>
  isLightNodeToolbar: ComputedRef<boolean>
  graph: ShallowRef<Graph | null>
  [key: string]: unknown
}
