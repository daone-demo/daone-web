import { computed, ref, shallowRef, watch } from 'vue'
import type { Graph } from '@antv/x6'
import {
  type ImageSourceRef,
  type NodeKind,
  type VideoHdMagnification,
} from '../../constants'
import { refreshCanvasNodeViews } from '../../graph'
import type { ImageEditTextEntry } from '../../editTextUtils'
import { setSharedCanvasBgTheme } from '../../useCanvasBgTheme'
import type { CanvasBgTheme } from '../../canvasTheme'
import type { Project } from '@/stores/useProject'
import type { CanvasDomRefs, CanvasEmit } from './types'

export type UploadFilter = 'image' | 'video' | 'any'

/** 画布顶栏项目列表项：后端 Project + 本地保存状态 */
export type CanvasProjectListItem = Project & { saved?: boolean }

export function createCanvasState(emit: CanvasEmit, domRefs: CanvasDomRefs) {
  const {
    canvasRef,
    graphRef,
    nodeOverlaysRef,
    fileInputComponentRef,
    bottomLeftDockRef,
    textExpandEditorComponentRef,
  } = domRefs

  const fileInputRef = computed(() => fileInputComponentRef.value?.inputRef ?? null)
  const minimapContainerRef = computed(() => bottomLeftDockRef.value?.minimapContainerRef ?? null)
  const textExpandEditorRef = computed(() => textExpandEditorComponentRef.value?.editorRef ?? null)

  const modelType = ref<'img2prompt' | 'text2xhs' | 'free' | 'text2video' | 'text2image'>('free')
  const promptSourcePreviewUrl = ref('')
  const promptSourceFileName = ref('')
  const promptSourcePreviews = ref<ImageSourceRef[]>([])
  const promptSubmitting = ref(false)
  const userMenuName = ref('李阳')
  const userMenuRole = ref('普通用户')
  const userMenuPoints = ref(3)
  const graph = shallowRef<Graph | null>(null)
  const nodeCount = ref(0)
  const zoomLevel = ref(1)
  const showZoomMenu = ref(false)
  const gridVisible = ref(false)
  const canvasBgTheme = ref<CanvasBgTheme>('light')

  watch(canvasBgTheme, (theme) => {
    setSharedCanvasBgTheme(theme)
    const g = graph.value
    if (g) refreshCanvasNodeViews(g)
  }, { immediate: true })

  const panMode = ref(false)
  const showShortcutsPanel = ref(false)
  const imagePreviewUrl = ref('')
  const canUndo = ref(false)
  const canRedo = ref(false)
  const nodeClipboard = ref<Record<string, unknown> | Record<string, unknown>[] | null>(null)
  const showMinimap = ref(false)
  const showBackToNodesBanner = ref(false)
  const isRecenteringToNodes = ref(false)
  const showProjectMenu = ref(false)
  const showUserMenu = ref(false)
  const canvasProjects = ref<CanvasProjectListItem[]>([])
  const activeProjectId = ref('')
  const canvasRevision = ref(0)
  const showAddMenu = ref(false)
  const showConnectMenu = ref(false)
  const connectMenuPos = ref({ left: 0, top: 0 })
  const connectReleasePoint = ref<{ x: number; y: number } | null>(null)
  const addMenuPos = ref({ left: 0, top: 0 })
  const addMenuDropPoint = ref<{ x: number; y: number } | null>(null)
  const connectSourceNodeId = ref('')
  const showAssetsPanel = ref(false)
  const showAssetCenterPanel = ref(false)
  const showHistoryPanel = ref(false)
  const assetsTab = ref<'RECOMMENDED' | 'CENTER' | 'MINE' | 'FAVORITE' | 'FILES'>('RECOMMENDED')
  const assetsLoading = ref(false)
  const assetCenterTab = ref<'ALL' | '角色' | '场景' | '风格包' | '自定义'>('ALL')
  const assetCenterSearch = ref('')
  const assetCenterLoading = ref(false)
  const assetCenterItems = ref<Array<{
    id: string
    name: string
    role: string
    previewUrl?: string
    description?: string
  }>>([])
  const promptText = ref('')
  const activePickerNodeId = ref('')
  const activeImageGenPromptNodeId = ref('')
  const imageGenPromptText = ref('')
  const imageGenSeed = ref(58)
  const imageGenSourcePreviewUrl = ref('')
  const imageGenSubmitting = ref(false)
  const activeVideoGenPromptNodeId = ref('')
  const videoGenPromptText = ref('')
  const videoNum = ref(1)
  const videoGenActiveTab = ref('text2video')
  const selectedNodeId = ref('')
  const selectedNodeIds = ref<string[]>([])
  const selectedEdgeId = ref('')
  const hoveredEdgeId = ref('')
  const edgeDeleteBtnPos = ref({ left: 0, top: 0 })
  const pendingUploadNodeId = ref('')
  const fileInputAccept = ref('image/*,video/*')
  const fileInputMultiple = ref(true)
  const isCanvasFileDragOver = ref(false)
  const canvasFileDragDepth = ref(0)
  const pendingUploadFilter = ref<UploadFilter>('any')
  const toolbarPos = ref({ left: 0, top: 0 })
  const multiSelectToolbarPos = ref({ left: 0, top: 0 })
  const groupToolbarPos = ref({ left: 0, top: 0 })
  const showSaveSkillPopover = ref(false)
  const saveSkillPopoverPos = ref({ left: 0, top: 0 })
  const saveSkillItems = ref<Array<{ nodeId: string; label: string }>>([])
  const saveSkillSubmitting = ref(false)
  const groupOverlayBox = ref<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const dialoguePos = ref({ left: 0, top: 0, width: 360 })
  const promptPos = ref({ left: 0, top: 0, width: 360 })
  const imageGenPromptPos = ref({ left: 0, top: 0, width: 480 })
  const videoGenPromptPos = ref({ left: 0, top: 0, width: 520 })
  const videoGenPromptDragOffset = ref({ x: 0, y: 0 })
  const imageInpaintDragOffset = ref({ x: 0, y: 0 })
  const imageExpandDragOffset = ref({ x: 0, y: 0 })
  const showElementSelectMode = ref(false)
  const elementSelectReturnNodeId = ref('')
  const imageCropPos = ref({ left: 0, top: 0, width: 360, height: 420 })
  const imageResizeOverlay = ref({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    dimensionLabel: '',
    nodeId: '',
  })
  const showImageResizeOverlay = ref(false)
  const imageGridSplitPos = ref({ left: 0, top: 0, width: 420, height: 520 })
  const videoHdPos = ref({ left: 0, top: 0, width: 320 })
  const selectedKind = ref<NodeKind | null>(null)
  const showImageToolbarMore = ref(false)
  const showImageToolbarMoreMenu = ref(false)
  const showImageHdMenu = ref(false)
  const showImageDialogue = ref(false)
  const showImageCrop = ref(false)
  const cropSourceNodeId = ref('')
  const showImageGridSplit = ref(false)
  const gridSplitSourceNodeId = ref('')
  const gridSplitRows = ref(2)
  const gridSplitCols = ref(2)
  const showImageErase = ref(false)
  const eraseSourceNodeId = ref('')
  const imageErasePos = ref({ left: 0, top: 0, width: 360, height: 420 })
  const showImageInpaint = ref(false)
  const inpaintSourceNodeId = ref('')
  const imageInpaintPos = ref({ left: 0, top: 0, width: 360, height: 520 })
  const showImageExpand = ref(false)
  const expandSourceNodeId = ref('')
  const imageExpandPos = ref({ left: 0, top: 0, width: 360, height: 420 })
  const showImageEditText = ref(false)
  const editTextSourceNodeId = ref('')
  const imageEditTextPos = ref({ left: 0, top: 0, width: 380, height: 420 })
  const imageEditTextEntries = ref<ImageEditTextEntry[]>([])
  const imageEditTextRecognizing = ref(false)
  const showVideoDialogue = ref(false)
  const showVideoHdPanel = ref(false)
  const showVideoFramesPanel = ref(false)
  const imageDialogueText = ref('')
  const videoDialogueText = ref('')
  const videoHdMagnification = ref<VideoHdMagnification>('2')
  const canvasCredits = ref(12003)
  const textFormatToolbarPos = ref({ left: 0, top: 0, width: 420 })
  const textDownloadPos = ref({ left: 0, top: 0 })
  const textExpandOpen = ref(false)
  const textExpandNodeId = ref('')
  const textExpandTitle = ref('')
  const toolbarRevision = ref(0)

  return {
    emit,
    canvasRef,
    graphRef,
    nodeOverlaysRef,
    fileInputComponentRef,
    bottomLeftDockRef,
    textExpandEditorComponentRef,
    fileInputRef,
    minimapContainerRef,
    textExpandEditorRef,
    modelType,
    promptSourcePreviewUrl,
    promptSourceFileName,
    promptSourcePreviews,
    promptSubmitting,
    userMenuName,
    userMenuRole,
    userMenuPoints,
    graph,
    nodeCount,
    zoomLevel,
    showZoomMenu,
    gridVisible,
    canvasBgTheme,
    panMode,
    showShortcutsPanel,
    imagePreviewUrl,
    canUndo,
    canRedo,
    nodeClipboard,
    showMinimap,
    showBackToNodesBanner,
    isRecenteringToNodes,
    showProjectMenu,
    showUserMenu,
    canvasProjects,
    activeProjectId,
    canvasRevision,
    showAddMenu,
    showConnectMenu,
    connectMenuPos,
    connectReleasePoint,
    addMenuPos,
    addMenuDropPoint,
    connectSourceNodeId,
    showAssetsPanel,
    showAssetCenterPanel,
    showHistoryPanel,
    assetsTab,
    assetsLoading,
    assetCenterTab,
    assetCenterSearch,
    assetCenterLoading,
    assetCenterItems,
    promptText,
    activePickerNodeId,
    activeImageGenPromptNodeId,
    imageGenPromptText,
    imageGenSeed,
    imageGenSourcePreviewUrl,
    imageGenSubmitting,
    activeVideoGenPromptNodeId,
    videoGenPromptText,
    videoNum,
    videoGenActiveTab,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    hoveredEdgeId,
    edgeDeleteBtnPos,
    pendingUploadNodeId,
    fileInputAccept,
    fileInputMultiple,
    isCanvasFileDragOver,
    canvasFileDragDepth,
    pendingUploadFilter,
    toolbarPos,
    multiSelectToolbarPos,
    groupToolbarPos,
    showSaveSkillPopover,
    saveSkillPopoverPos,
    saveSkillItems,
    saveSkillSubmitting,
    groupOverlayBox,
    dialoguePos,
    promptPos,
    imageGenPromptPos,
    videoGenPromptPos,
    videoGenPromptDragOffset,
    imageInpaintDragOffset,
    imageExpandDragOffset,
    showElementSelectMode,
    elementSelectReturnNodeId,
    imageCropPos,
    imageResizeOverlay,
    showImageResizeOverlay,
    imageGridSplitPos,
    videoHdPos,
    selectedKind,
    showImageToolbarMore,
    showImageToolbarMoreMenu,
    showImageHdMenu,
    showImageDialogue,
    showImageCrop,
    cropSourceNodeId,
    showImageGridSplit,
    gridSplitSourceNodeId,
    gridSplitRows,
    gridSplitCols,
    showImageErase,
    eraseSourceNodeId,
    imageErasePos,
    showImageInpaint,
    inpaintSourceNodeId,
    imageInpaintPos,
    showImageExpand,
    expandSourceNodeId,
    imageExpandPos,
    showImageEditText,
    editTextSourceNodeId,
    imageEditTextPos,
    imageEditTextEntries,
    imageEditTextRecognizing,
    showVideoDialogue,
    showVideoHdPanel,
    showVideoFramesPanel,
    imageDialogueText,
    videoDialogueText,
    videoHdMagnification,
    canvasCredits,
    textFormatToolbarPos,
    textDownloadPos,
    textExpandOpen,
    textExpandNodeId,
    textExpandTitle,
    toolbarRevision,
  }
}

export type CanvasState = ReturnType<typeof createCanvasState>
