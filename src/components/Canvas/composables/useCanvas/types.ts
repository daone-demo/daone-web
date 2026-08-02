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
  (event: 'add-to-chat', payload: { previewUrl: string; fileName: string; assetId?: string }): void
  (event: 'toolbar-preferences-saved', payload: { nodeType: 'IMAGE' | 'VIDEO' | 'TEXT' }): void
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
  showVideoDialoguePanel: ComputedRef<boolean>
  videoGenSourceRefs: ComputedRef<import('../../videoGen').VideoSourceRef[]>
  videoGenSavedSettings: ComputedRef<import('../../constants').VideoDialogueSettings | undefined>
  videoDialogueSourceRefs: ComputedRef<import('../../videoGen').VideoSourceRef[]>
  showImageCreativeToolbar: ComputedRef<boolean>
  showElementSelectBar: ComputedRef<boolean>
  showTextFormatToolbar: ComputedRef<boolean>
  isImg2PromptTask: ComputedRef<boolean>
  isText2VideoTask: ComputedRef<boolean>
  isText2ImageTask: ComputedRef<boolean>
  promptSubmitLabel: ComputedRef<string>
  canSubmitTextPrompt: ComputedRef<boolean>
  imageCropSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageGridSplitSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageEraseSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageInpaintSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageExpandSource: ComputedRef<{
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null>
  imageDialoguePreviews: ComputedRef<import('../../constants').ImageSourceRef[]>
  imageDialoguePreviewUrl: ComputedRef<string>
  elementMarks: ComputedRef<import('../../constants').ImageMarkItem[]>
  imageMarkAnalyzingActive: ComputedRef<boolean>
  showNodeToolbar: ComputedRef<boolean>
  showMultiSelectToolbar: ComputedRef<boolean>
  showToolbarFeatureButtons: ComputedRef<boolean>
  isLightNodeToolbar: ComputedRef<boolean>
  closeImageGridSplit: () => void
  closeImageErase: () => void
  closeImageInpaint: () => void
  closeImageExpand: () => void
  onImageGridSplitComplete: (payload: {
    rows: number
    cols: number
    rowStops: number[]
    colStops: number[]
  }) => Promise<void>
  onImageEraseComplete: (payload: { dataUrl: string; width: number; height: number }) => Promise<void>
  onImageInpaintComplete: (payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
    settle?: () => void
  }) => Promise<void>
  onImageResizePointerDown: (event: MouseEvent, corner: import('../../graph').ImageResizeCorner) => void
  onImageExpandComplete: (payload: {
    expandDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'ALL'
    expandRatio: number
  }) => void
  onImageEditTextApply: (changes: import('../../editTextUtils').ImageEditTextChange[]) => void
  closeImageEditText: () => void
  closeImageToolbarCustomize: () => void
  saveImageToolbarCustomize: (
    settings: import('../../imageToolbarCustomize').ImageToolbarCustomizeSettings,
  ) => Promise<void>
  resetImageToolbarCustomize: () => void
  handleImageDialogueSubmit: (payload: import('../../constants').ImageDialogueSubmitPayload) => void
  handleVideoDialogueSubmit: (payload: import('../../constants').VideoDialogueSubmitPayload) => void
  handleVideoGenPromptSubmit: (payload: import('../../constants').VideoGenPromptSubmitPayload) => void
  onVideoGenAspectRatioChange: (ratio: import('../../constants').VideoGenAspectRatio) => void
  onVideoToolbarAction: (payload: import('../../constants').VideoToolbarClickPayload) => void
  loadImageDialogueFields: (nodeId: string) => void
  persistImageDialogueFields: (nodeId?: string) => void
  loadVideoDialogueFields: (nodeId: string) => void
  persistVideoDialogueFields: (nodeId?: string) => void
  toggleImageDialogueMarkMode: () => void
  updateImageMarkLabel: (markId: string, selectedLabelIndex: number) => void
  removeElementMark: (markId: string) => void
  clearElementMarks: () => void
  resolveElementMarkPreviewUrl: (mark: import('../../constants').ImageMarkItem) => string
  onImageContextMenuAction: (key: string) => void
  imageContextMenuLocked: ComputedRef<boolean>
  openProjectBrowser: () => void
  closeProjectBrowser: () => void
  graph: ShallowRef<Graph | null>
  [key: string]: unknown
}
