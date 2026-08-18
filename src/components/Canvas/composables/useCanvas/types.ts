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
  (event: 'add-to-chat', payload: {
    previewUrl: string
    fileName: string
    assetId?: string
    nodeId?: string
  }): void
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
  groupOverlayResize: {
    active: boolean
    handle: import('../../nodeGroup').GroupResizeHandle | ''
    groupId: string
    startBox: { x: number; y: number; width: number; height: number }
    currentBox: { x: number; y: number; width: number; height: number }
    startPointerX: number
    startPointerY: number
  }
  groupMoveState: {
    anchorId: string
    draggingNodeId: string
    lastX: number
    lastY: number
  }
  // computed + methods merged at runtime via registerCore
  zoomPercent: ComputedRef<string>
  currentProjectName: ComputedRef<string>
  canvasBgThemeLabel: ComputedRef<string>
  activeGroupSelection: ComputedRef<ReturnType<typeof import('../../nodeGroup').getCompleteGroupSelection> | null>
  overlayGroupSelection: ComputedRef<ReturnType<typeof import('../../nodeGroup').getGroupSelectionForNodeIds> | null>
  showGroupOverlay: ComputedRef<boolean>
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
  imageDialogueWorkflowDisabled: ComputedRef<boolean>
  imageDialoguePreviewUrl: ComputedRef<string>
  imageDialogueHideWorkflowAndMark: ComputedRef<boolean>
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
  onImageExpandComplete: (payload: import('../../expandUtils').ImageExpandRequestMetrics) => void
  onImageEditTextApply: (changes: import('../../editTextUtils').ImageEditTextChange[]) => void
  closeImageEditText: () => void
  closeImageToolbarCustomize: () => void
  saveImageToolbarCustomize: (
    settings: import('../../imageToolbarCustomize').ImageToolbarCustomizeSettings,
  ) => Promise<void>
  resetImageToolbarCustomize: () => void
  handleImageDialogueSubmit: (payload: import('../../constants').ImageDialogueSubmitPayload) => void
  onImageDialogueAddCanvasNode: (sourceNodeId: string) => void
  onImageDialogueAddDigitalHumanRef: (payload: { assetId: string; previewUrl: string }) => void
  handleVideoDialogueSubmit: (payload: import('../../constants').VideoDialogueSubmitPayload) => void
  handleVideoGenPromptSubmit: (payload: import('../../constants').VideoGenPromptSubmitPayload) => void
  onVideoGenAspectRatioChange: (ratio: import('../../constants').VideoGenAspectRatio) => void
  onVideoToolbarAction: (payload: import('../../constants').VideoToolbarClickPayload) => void
  loadImageDialogueFields: (nodeId: string) => void
  persistImageDialogueFields: (nodeId?: string) => void
  loadVideoDialogueFields: (nodeId: string) => void
  persistVideoDialogueFields: (nodeId?: string) => void
  toggleImageDialogueMarkMode: (options?: { coordinateOnly?: boolean }) => void
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

/**
 * useCanvas 对外公开 API。
 * 由 CanvasState + registerCore 返回面 + 入口附加字段组成。
 * 使用 ReturnType<typeof registerCore> 推断方法签名，避免维护重复的公开方法声明。
 * 注意：不要把带 [key: string]: unknown 的 CanvasBindings 直接当作模板消费类型，
 * 否则未在 Bindings 显式声明的方法会全部变成 unknown。
 */
export type UseCanvasApi = CanvasState &
  ReturnType<typeof import('./registerCore').registerCore> & {
    router: ReturnType<typeof import('vue-router').useRouter>
    modalStore: ReturnType<typeof import('@stores/useModal').useModalStore>
    textEditorApis: Map<string, TextEditorApi>
    groupOverlayDrag: CanvasBindings['groupOverlayDrag']
    groupOverlayResize: CanvasBindings['groupOverlayResize']
    groupMoveState: CanvasBindings['groupMoveState']
    TEXT_EDITOR_PLACEHOLDER: string
    getNodeCount: () => number
  }
