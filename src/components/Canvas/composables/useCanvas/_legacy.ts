import { useModalStore } from '@stores/useModal'
import { useRouter } from 'vue-router'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch,
  type Ref,
} from 'vue'
import type { Edge, Graph, Node } from '@antv/x6'
import type CanvasNodeOverlays from '../../panels/CanvasNodeOverlays.vue'
import type CanvasBottomLeftDock from '../../panels/CanvasBottomLeftDock.vue'
import type CanvasHiddenFileInput from '../../panels/CanvasHiddenFileInput.vue'
import type CanvasTextExpandEditor from '../../panels/CanvasTextExpandEditor.vue'
import type { UserMenuKey } from '../../panels/CanvasHeader.vue'
import {
  ADD_NODE_GROUPS,
  CANVAS_PROJECTS,
  CONNECT_GENERATE_MENU,
  IMG2PROMPT_EXAMPLE_FILENAME,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  NODE_SPAWN_GAP_X,
  NODE_SPAWN_GAP_Y,
  ZOOM_MENU_PRESETS,
  TEXT_EDITOR_PLACEHOLDER,
  type CanvasNodeData,
  type ImageGenTask,
  type ImageSourceRef,
  type NodeKind,
  type TextFormatCommand,
  type VideoHdMagnification,
} from '../../constants'
import type { TextEditorApi } from '../../nodes/useTextEditorRegistry'
import exampleImage from '@assets/hero.png'
import {
  applyImageGenTask as applyImageGenTaskToNode,
  connectGenEdge,
  spawnCroppedImageNode,
} from '../../imageGen'
import {
  canImageNodeAcceptIncoming,
  canOpenConnectMenu,
  createNodeFromConnectMenu,
  getConnectMenuPosition,
  getLinkedSpawnPoint,
  resolveConnectSpawnPoint,
} from '../../nodeConnect'
import { detachEdgeRelation, isPersistedEdge } from '../../edgeRelations'
import { syncEdgeSelectionHighlight } from '../../edgeStyle'
import type { ConnectMenuKey } from '../../constants'
import {
  addCanvasNode,
  bindGraphInteraction,
  createGraph,
  ensureInfiniteCanvasArea,
  clientPointToGraphLocal,
  getViewportCenterLocal,
  hasVisibleNodesInViewport,
  centerGraphContent,
  getNodeCropOverlayPosition,
  getNodeDialoguePosition,
  getNodeImageGenPromptPosition,
  getNodeVideoGenPromptPosition,
  getNodePromptPosition,
  getNodeSidePanelPosition,
  getNodeTextDownloadPosition,
  getNodeTextFormatToolbarPosition,
  getGroupScreenBox,
  getMultiSelectionToolbarPosition,
  getNodeToolbarPosition,
  getNodeSize,
  getScroller,
  graphLocalToContainerOffset,
  refreshCanvasNodeViews,
  syncAllNodeSizes,
  type CanvasGraph,
} from '../../graph'
import {
  applyCanvasBgTheme,
  getCanvasBgThemeMeta,
  type CanvasBgTheme,
} from '../../canvasTheme'
import { layoutNodesInGroup, tidyCanvas, tidyNodes, type GroupLayoutDirection } from '../../layout'
import {
  assignGroupId,
  expandSelectionToGroup,
  getCompleteGroupSelection,
  getNodesInGroup,
  mergeStoryboardGroup,
  normalizeGroupMembership,
  ungroupSelection,
} from '../../nodeGroup'
import {
  ensureImageTextEdge,
  findIncomingImageNode,
  IMG2PROMPT_DEFAULT_INSTRUCTION,
  mockImg2Prompt,
  mockTextGenerate,
  syncTextNodeImageSource,
} from '../../textPrompt'
import { createMinimap, destroyMinimap } from '../../minimap'
import { runUploadSimulation } from '../../upload'
import {
  getCanvasSnapshot,
  saveCanvasSnapshotToStorage,
  type CanvasSnapshot,
} from '../../canvasSnapshot'
import { createCanvasHistory } from '../../canvasHistory'
import {
  disconnectImageFromVideo,
  findImageToVideoEdge,
  getVideoSourceRefs,
  VIDEO_GEN_TAB_IMAGE_RULES,
} from '../../videoGen'
import { setSharedCanvasBgTheme } from '../../useCanvasBgTheme'
import { useCanvasKeyboard } from '../useCanvasKeyboard'
import api from '@/services/api'

export type CanvasEmit = {
  (event: 'focus-chat'): void
  (event: 'add-to-chat', payload: { previewUrl: string; fileName: string }): void
}

export type CanvasDomRefs = {
  canvasRef: Ref<HTMLElement | null>
  graphRef: Ref<HTMLElement | null>
  nodeOverlaysRef: Ref<InstanceType<typeof CanvasNodeOverlays> | null>
  fileInputComponentRef: Ref<InstanceType<typeof CanvasHiddenFileInput> | null>
  bottomLeftDockRef: Ref<InstanceType<typeof CanvasBottomLeftDock> | null>
  textExpandEditorComponentRef: Ref<InstanceType<typeof CanvasTextExpandEditor> | null>
}

export function useCanvas(emit: CanvasEmit, domRefs: CanvasDomRefs) {
const router = useRouter()
const modalStore = useModalStore()

const modelType = ref<'img2prompt' | 'text2xhs' | 'free'>('free')
const promptSourcePreviewUrl = ref('')
const promptSourceFileName = ref('')
const promptSourcePreviews = ref<ImageSourceRef[]>([])
const promptSubmitting = ref(false)
const userMenuName = ref('李阳')
const userMenuRole = ref('普通用户')
const userMenuPoints = ref(3)
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

let canvasHistory: ReturnType<typeof createCanvasHistory> | null = null
let historyPushTimer: ReturnType<typeof setTimeout> | null = null
let scrollerScrollTarget: HTMLElement | null = null

const showMinimap = ref(false)
const showBackToNodesBanner = ref(false)
const isRecenteringToNodes = ref(false)
const showProjectMenu = ref(false)
const showUserMenu = ref(false)
const canvasProjects = ref([...CANVAS_PROJECTS])
const activeProjectId = ref('draft-2')
const showAddMenu = ref(false)
const showConnectMenu = ref(false)
const connectMenuPos = ref({ left: 0, top: 0 })
const connectReleasePoint = ref<{ x: number; y: number } | null>(null)
const addMenuPos = ref({ left: 0, top: 0 })
const addMenuDropPoint = ref<{ x: number; y: number } | null>(null)
const connectSourceNodeId = ref('')
const showAssetsPanel = ref(false)
const showHistoryPanel = ref(false)
const assetsTab = ref<'all' | 'mine'>('mine')
const assetsLoading = ref(false)
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
const edgeDeleteBtnPos = ref({ left: 0, top: 0 })
const showEdgeDeleteButton = computed(() => false)
function handleEdgeDeletePointerEnter() {}
function handleEdgeDeletePointerLeave() {}
function removeHoveredEdge() {}
const pendingUploadNodeId = ref('')
const fileInputAccept = ref('image/*,video/*')
const fileInputMultiple = ref(true)
const isCanvasFileDragOver = ref(false)
const canvasFileDragDepth = ref(0)
type UploadFilter = 'image' | 'video' | 'any'
const pendingUploadFilter = ref<UploadFilter>('any')
const toolbarPos = ref({ left: 0, top: 0 })
const multiSelectToolbarPos = ref({ left: 0, top: 0 })
const groupToolbarPos = ref({ left: 0, top: 0 })
const groupOverlayBox = ref<{
  left: number
  top: number
  width: number
  height: number
} | null>(null)
const groupOverlayDrag = {
  active: false,
  lastGraphX: 0,
  lastGraphY: 0,
  nodeIds: [] as string[],
}
const groupMoveState = {
  anchorId: '',
  lastX: 0,
  lastY: 0,
}
const dialoguePos = ref({ left: 0, top: 0, width: 360 })
const promptPos = ref({ left: 0, top: 0, width: 360 })
const imageGenPromptPos = ref({ left: 0, top: 0, width: 480 })
const videoGenPromptPos = ref({ left: 0, top: 0, width: 520 })
const videoGenPromptDragOffset = ref({ x: 0, y: 0 })
const showElementSelectMode = ref(false)
const elementSelectReturnNodeId = ref('')
const imageCropPos = ref({ left: 0, top: 0, width: 360, height: 420 })
const videoHdPos = ref({ left: 0, top: 0, width: 320 })
const selectedKind = ref<NodeKind | null>(null)
const showImageToolbarMore = ref(false)
const showImageToolbarMoreMenu = ref(false)
const showImageHdMenu = ref(false)
const showImageDialogue = ref(false)
const showImageCrop = ref(false)
const cropSourceNodeId = ref('')
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

const textEditorApis = new Map<string, TextEditorApi>()

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu() {
  showUserMenu.value = false
}

function goUserCenter() {
  closeUserMenu()
  router.push({ name: 'userInfo' })
}

function openComboModal() {
  closeUserMenu()
  modalStore.openModal('combo')
}

function handleUserMenuAction(key: UserMenuKey) {
  if (key === 'projects') {
    closeUserMenu()
    router.push({ name: 'project' })
    return
  }
  closeUserMenu()
}

function handleLogout() {
  closeUserMenu()
  modalStore.openModal('login')
}

const zoomPercent = computed(() => `${Math.round(zoomLevel.value * 100)}%`)
const currentProjectName = computed(
  () => canvasProjects.value.find((project) => project.id === activeProjectId.value)?.name ?? '未命名创作',
)
const canvasBgThemeLabel = computed(
  () => getCanvasBgThemeMeta(canvasBgTheme.value).label,
)
const activeGroupSelection = computed(() => {
  void toolbarRevision.value
  const g = graph.value
  if (!g || selectedNodeIds.value.length < 2) return null
  return getCompleteGroupSelection(g, selectedNodeIds.value)
})

const showGroupToolbar = computed(() => activeGroupSelection.value != null)

const showPromptBar = computed(() => {
  if (showMultiSelectToolbar.value || showGroupToolbar.value) return false
  const id = activePickerNodeId.value
  if (!id || nodeCount.value === 0 || showImageCrop.value) return false
  return true
})
const showImageGenPromptBar = computed(
  () =>
    !showMultiSelectToolbar.value &&
    !showGroupToolbar.value &&
    Boolean(activeImageGenPromptNodeId.value) &&
    nodeCount.value > 0 &&
    !showImageCrop.value,
)
const showVideoGenPromptBar = computed(
  () =>
    !showMultiSelectToolbar.value &&
    !showGroupToolbar.value &&
    Boolean(activeVideoGenPromptNodeId.value) &&
    nodeCount.value > 0 &&
    !showImageCrop.value,
)

const videoGenSourceRefs = computed(() => {
  void toolbarRevision.value
  const g = graph.value
  const id = activeVideoGenPromptNodeId.value
  if (!g || !id) return []
  return getVideoSourceRefs(g, id)
})

const showImageCreativeToolbar = computed(() => {
  void toolbarRevision.value
  if (!showElementSelectMode.value) return false
  if (selectedKind.value !== 'image' || !selectedNodeId.value) return false
  return canShowImageToolbar(getSelectedNodeData())
})
const showTextFormatToolbar = computed(() => {
  void toolbarRevision.value
  if (showMultiSelectToolbar.value || showGroupToolbar.value) return false
  if (!selectedNodeId.value || showImageCrop.value || textExpandOpen.value) return false
  const data = getSelectedNodeData()
  return (
    data?.kind === 'text' &&
    data.mode === 'editor' &&
    data.textGenState !== 'loading'
  )
})
const isImg2PromptTask = computed(() => {
  void toolbarRevision.value
  const id = activePickerNodeId.value
  if (!id) return false
  const data = graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
  return data?.textPickerTask === 'img2prompt'
})

const canSubmitTextPrompt = computed(() => {
  if (isImg2PromptTask.value) {
    return Boolean(promptSourcePreviewUrl.value) && !promptSubmitting.value
  }
  return Boolean(promptText.value.trim()) && !promptSubmitting.value
})

const imageCropSource = computed(() => {
  const data = getSelectedNodeData()
  if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return null
  return {
    previewUrl: data.previewUrl,
    mediaWidth: data.mediaWidth,
    mediaHeight: data.mediaHeight,
  }
})

const imageDialoguePreviews = computed<ImageSourceRef[]>(() => {
  void toolbarRevision.value
  const data = getSelectedNodeData()
  if (!data) return []
  const refs = Array.isArray(data.imageSourceRefs)
    ? data.imageSourceRefs.filter((item) => item.previewUrl)
    : []
  if (refs.length) {
    return refs.map((item) => ({
      nodeId: item.nodeId,
      previewUrl: item.previewUrl,
      fileName: item.fileName ?? '',
    }))
  }
  const single = data.sourcePreviewUrl || ''
  if (single) {
    return [{ nodeId: data.sourceNodeId ?? '', previewUrl: single, fileName: data.sourceFileName ?? '' }]
  }
  return []
})

const imageDialoguePreviewUrl = computed(() => {
  void toolbarRevision.value
  const data = getSelectedNodeData()
  return data?.sourcePreviewUrl || data?.previewUrl || ''
})

const showNodeToolbar = computed(
  () => Boolean(selectedNodeId.value) && !showGroupToolbar.value,
)
const showMultiSelectToolbar = computed(
  () => selectedNodeIds.value.length >= 2 && !showGroupToolbar.value,
)
const toolbarRevision = ref(0)

function onGoHome() {
  router.push({ name: 'home' })
}

function getSelectedNodeData(): CanvasNodeData | undefined {
  const id = selectedNodeId.value
  if (!id) return undefined
  return graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
}

function canShowImageToolbar(data: CanvasNodeData | undefined) {
  if (!data || data.kind !== 'image') return false
  if (data.imageGenTask === 'picker') return false
  if (data.imageGenTask === 'img2img' || data.imageGenTask === 'hd') return true
  return data.mode === 'editor'
}

function canShowVideoToolbar(data: CanvasNodeData | undefined) {
  if (!data || data.kind !== 'video') return false
  if (data.uploadState === 'uploading') return true
  if (data.previewUrl) return true
  return data.mode === 'editor'
}

function bumpToolbarRevision() {
  toolbarRevision.value += 1
}

const showToolbarFeatureButtons = computed(() => {
  void toolbarRevision.value

  if (selectedKind.value === 'image' && selectedNodeId.value) {
    return canShowImageToolbar(getSelectedNodeData())
  }
  if (selectedKind.value === 'video' && selectedNodeId.value) {
    return canShowVideoToolbar(getSelectedNodeData())
  }
  return false
})

const isLightNodeToolbar = computed(
  () =>
    (selectedKind.value === 'image' || selectedKind.value === 'video') &&
    showToolbarFeatureButtons.value,
)

function openImageToolbarMore() {
  showImageToolbarMore.value = true
  showImageToolbarMoreMenu.value = false
  showImageHdMenu.value = false
}

function closeImageToolbarMore() {
  showImageToolbarMore.value = false
  showImageToolbarMoreMenu.value = false
}

function toggleImageToolbarMoreMenu() {
  showImageToolbarMoreMenu.value = !showImageToolbarMoreMenu.value
}

function toggleImageHdMenu() {
  showImageHdMenu.value = !showImageHdMenu.value
  if (showImageHdMenu.value) {
    showImageToolbarMoreMenu.value = false
  }
}

function onImageToolbarAction(key: string) {
  showImageHdMenu.value = false
  if (key === 'more') {
    openImageToolbarMore()
    return
  }
  if (key === 'crop') {
    openImageCrop()
  }
}

function openImageCrop() {
  const data = getSelectedNodeData()
  if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return

  showImageHdMenu.value = false
  showImageDialogue.value = false
  showImageToolbarMore.value = false
  showImageToolbarMoreMenu.value = false
  cropSourceNodeId.value = selectedNodeId.value
  showImageCrop.value = true
  updateNodeToolbar()
}

function closeImageCrop() {
  showImageCrop.value = false
  cropSourceNodeId.value = ''
  updateNodeToolbar()
}

function resetImageCrop() {
  showImageCrop.value = false
  cropSourceNodeId.value = ''
}

function onImageCropComplete(payload: { dataUrl: string; width: number; height: number }) {
  const g = graph.value
  const id = cropSourceNodeId.value || selectedNodeId.value
  if (!g || !id) {
    closeImageCrop()
    return
  }

  const cell = g.getCellById(id)
  if (!cell?.isNode()) {
    closeImageCrop()
    return
  }

  const sourceNode = cell as Node
  const croppedNode = spawnCroppedImageNode(g, sourceNode, payload)
  selectedNodeId.value = croppedNode.id
  selectedKind.value = 'image'
  syncNodeSelectionHighlight(croppedNode.id)
  syncNodeCount()
  closeImageCrop()

  nextTick(() => {
    const scroller = getScroller(g)
    const bbox = croppedNode.getBBox()
    scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
      duration: '280ms',
    })
    updateNodeToolbar()
  })
}

function resetImageToolbarMore() {
  showImageToolbarMore.value = false
  showImageToolbarMoreMenu.value = false
  showImageHdMenu.value = false
}

function closeVideoSubPanels(except?: 'dialogue' | 'hd' | 'frames') {
  if (except !== 'dialogue') showVideoDialogue.value = false
  if (except !== 'hd') showVideoHdPanel.value = false
  if (except !== 'frames') showVideoFramesPanel.value = false
}

function openImageDialogue(nodeId?: string) {
  const g = graph.value
  if (!g) return
  const id = nodeId ?? selectedNodeId.value
  if (!id) return
  const cell = g.getCellById(id)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData
  if (data.kind !== 'image') return

  selectedNodeId.value = id
  selectedKind.value = 'image'
  showImageDialogue.value = true
  showImageHdMenu.value = false
  closeImageGenPromptBar()
  syncNodeSelectionHighlight(id)
  updateNodeToolbar()
}

function toggleImageDialogue() {
  if (showImageDialogue.value) {
    resetImageDialogue()
  } else {
    openImageDialogue()
  }
  showImageHdMenu.value = false
}

function handleImageNodeDblClick({ node }: { node: Node }) {
  openImageDialogue(node.id)
}

function toggleVideoDialogue() {
  showVideoDialogue.value = !showVideoDialogue.value
  if (showVideoDialogue.value) {
    closeVideoSubPanels('dialogue')
    updateNodeToolbar()
  }
}

function toggleVideoHdPanel() {
  showVideoHdPanel.value = !showVideoHdPanel.value
  if (showVideoHdPanel.value) {
    closeVideoSubPanels('hd')
    updateNodeToolbar()
  }
}

function toggleVideoFramesPanel() {
  showVideoFramesPanel.value = !showVideoFramesPanel.value
  if (showVideoFramesPanel.value) {
    closeVideoSubPanels('frames')
    updateNodeToolbar()
  }
}

function toggleImageAddToDialogMenu() {
  const g = graph.value
  const id = selectedNodeId.value
  if (!g || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  const data = cell.getData() as CanvasNodeData
  if (data.kind !== 'image' || !data.previewUrl || data.uploadState === 'uploading') return

  emit('add-to-chat', {
    previewUrl: data.previewUrl,
    fileName: data.fileName || data.title || 'image.jpg',
  })
}

function resetVideoHdPanel() {
  showVideoHdPanel.value = false
}

function resetVideoFramesPanel() {
  showVideoFramesPanel.value = false
}

function onVideoHdStart() {
  resetVideoHdPanel()
}

function resetImageDialogue() {
  showImageDialogue.value = false
}

function seedImageDialogueRefs(data: CanvasNodeData, targetNodeId: string): ImageSourceRef[] {
  const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
  if (refs.length) return refs

  if (data.sourceNodeId && data.sourcePreviewUrl) {
    refs.push({
      nodeId: data.sourceNodeId,
      previewUrl: data.sourcePreviewUrl,
      fileName: data.sourceFileName ?? '',
    })
    return refs
  }

  if (data.previewUrl) {
    refs.push({
      nodeId: targetNodeId,
      previewUrl: data.previewUrl,
      fileName: data.fileName || data.title || '',
    })
  }

  return refs
}

function addImageDialogueSourceRef(payload: {
  nodeId?: string
  previewUrl: string
  fileName?: string
}) {
  const g = graph.value
  const id = selectedNodeId.value
  if (!g || !id || !payload.previewUrl) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  const data = { ...(cell.getData() as CanvasNodeData) }
  if (data.kind !== 'image') return
  if (payload.nodeId && payload.nodeId === id) return

  const ref: ImageSourceRef = {
    nodeId: payload.nodeId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    previewUrl: payload.previewUrl,
    fileName: payload.fileName ?? '',
  }

  let refs = seedImageDialogueRefs(data, id)
  const existingIdx = payload.nodeId
    ? refs.findIndex((item) => item.nodeId === payload.nodeId)
    : refs.findIndex((item) => item.previewUrl === payload.previewUrl)

  if (existingIdx >= 0) {
    refs.splice(existingIdx, 1, ref)
  } else if (!refs.some((item) => item.previewUrl === payload.previewUrl)) {
    refs.push(ref)
  } else {
    return
  }

  data.imageSourceRefs = refs
  const latest = refs[refs.length - 1]
  data.sourceNodeId = latest?.nodeId ?? ''
  data.sourcePreviewUrl = latest?.previewUrl ?? ''
  data.sourceFileName = latest?.fileName ?? ''
  data.inputUpdated = refs.some((item) => Boolean(item.previewUrl))
  cell.setData(data, { overwrite: true })
  bumpToolbarRevision()
  scheduleHistoryPush()
}

async function linkImageNodeToImageDialogue(
  imageNodeId: string,
  targetNodeId = selectedNodeId.value,
) {
  const g = graph.value
  if (!g || !targetNodeId || !imageNodeId || imageNodeId === targetNodeId) return false

  const source = g.getCellById(imageNodeId)
  const target = g.getCellById(targetNodeId)
  if (!source?.isNode() || !target?.isNode()) return false

  const sourceData = source.getData() as CanvasNodeData
  const targetData = target.getData() as CanvasNodeData
  if (
    sourceData.kind !== 'image' ||
    targetData.kind !== 'image' ||
    !sourceData.previewUrl ||
    sourceData.uploadState === 'uploading' ||
    sourceData.imageGenTask === 'picker'
  ) {
    return false
  }

  const hasEdge = g.getEdges().some(
    (edge) =>
      edge.getSourceCellId() === imageNodeId && edge.getTargetCellId() === targetNodeId,
  )
  if (!hasEdge) {
    connectGenEdge(g, imageNodeId, targetNodeId)
  }

  addImageDialogueSourceRef({
    nodeId: imageNodeId,
    previewUrl: sourceData.previewUrl,
    fileName: sourceData.fileName || sourceData.title || '',
  })
  bumpToolbarRevision()
  scheduleHistoryPush()
  return true
}

async function onImageDialogueUploadFiles(files: File[]) {
  const g = graph.value
  const targetNodeId = selectedNodeId.value
  if (!g || !targetNodeId) return

  const targetCell = g.getCellById(targetNodeId)
  if (!targetCell?.isNode()) return

  const targetData = targetCell.getData() as CanvasNodeData
  if (targetData.kind !== 'image') return

  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  if (!imageFiles.length) return

  const bbox = targetCell.getBBox()

  for (let index = 0; index < imageFiles.length; index += 1) {
    const point = {
      x: bbox.x - 200 - index * 48,
      y: bbox.y + index * 36,
    }
    const node = await addImageFromFile(imageFiles[index], point)
    if (!node) continue
    await linkImageNodeToImageDialogue(node.id, targetNodeId)
  }

  selectGraphNodes(targetNodeId)
  updateNodeToolbar()
}

function onImageDialogueAddCanvasNode(sourceNodeId: string) {
  void linkImageNodeToImageDialogue(sourceNodeId).then((linked) => {
    if (linked) updateNodeToolbar()
  })
}

function clearImageDialoguePreview(sourceNodeId?: string) {
  const g = graph.value
  const id = selectedNodeId.value
  if (!g || !id) return
  const cell = g.getCellById(id)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData) }

  let refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
  if (sourceNodeId) {
    const removed = refs.filter((item) => item.nodeId === sourceNodeId)
    removed.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    refs = refs.filter((item) => item.nodeId !== sourceNodeId)
    // 同步删除该来源连入的连线
    g.getEdges().forEach((edge) => {
      if (edge.getSourceCellId() === sourceNodeId && edge.getTargetCellId() === id) {
        g.removeEdge(edge.id)
      }
    })
  } else {
    refs.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    refs = []
  }
  data.imageSourceRefs = refs

  const latest = refs[refs.length - 1]
  data.sourceNodeId = latest?.nodeId ?? ''
  data.sourcePreviewUrl = latest?.previewUrl ?? ''
  data.sourceFileName = latest?.fileName ?? ''
  data.inputUpdated = refs.some((item) => Boolean(item.previewUrl))
  // overwrite: true —— X6 默认深合并数组不会缩短，删除元素必须整体替换
  cell.setData(data, { overwrite: true })
  toolbarRevision.value += 1
  scheduleHistoryPush()
}

function resetVideoDialogue() {
  showVideoDialogue.value = false
}

function triggerFileInputClick(
  accept: string,
  filter: UploadFilter,
  multiple: boolean,
  nodeId = '',
) {
  pendingUploadNodeId.value = nodeId
  fileInputAccept.value = accept
  fileInputMultiple.value = multiple
  pendingUploadFilter.value = filter

  const input = fileInputRef.value
  if (!input) return
  // 同步写入 DOM，避免首次点击时 :accept 尚未更新导致文件类型无限制
  input.value = ''
  input.accept = accept
  input.multiple = multiple
  input.click()
}

function requestCanvasUpload(nodeId: string) {
  const g = graph.value
  const cell = g?.getCellById(nodeId)
  const data = cell?.getData() as CanvasNodeData | undefined
  const isVideo = data?.kind === 'video'
  triggerFileInputClick(
    isVideo ? 'video/*' : 'image/*',
    isVideo ? 'video' : 'image',
    false,
    nodeId,
  )
}

provide('requestCanvasUpload', requestCanvasUpload)

function uploadFileToCanvasNode(nodeId: string, file: File) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return

  const node = cell as Node
  const data = { ...(node.getData() as CanvasNodeData) }
  data.mode = 'editor'
  node.setData(data)

  pendingUploadNodeId.value = ''
  selectedNodeId.value = nodeId
  selectedKind.value = data.kind
  runUploadSimulation(node, file)
  updateNodeToolbar()
  scheduleHistoryPush()
}

provide('uploadFileToCanvasNode', uploadFileToCanvasNode)

function loadImageGenPromptFields(nodeId: string) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData
  imageGenPromptText.value = data.genPrompt ?? ''
  imageGenSeed.value = data.genSeed ?? 58
  imageGenSourcePreviewUrl.value = data.sourcePreviewUrl ?? ''
}

function persistImageGenPrompt() {
  const g = graph.value
  const nodeId = activeImageGenPromptNodeId.value
  if (!g || !nodeId) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData) }
  data.genPrompt = imageGenPromptText.value
  data.genSeed = imageGenSeed.value
  cell.setData(data)
}

function loadVideoGenPromptFields(nodeId: string) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData
  videoGenPromptText.value = data.genPrompt ?? ''
  videoGenActiveTab.value = data.videoGenTab ?? 'text2video'
}

function persistVideoGenPrompt() {
  const g = graph.value
  const nodeId = activeVideoGenPromptNodeId.value
  if (!g || !nodeId) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData) }
  data.genPrompt = videoGenPromptText.value
  data.videoGenTab = videoGenActiveTab.value
  cell.setData(data)
}

function seedPromptImageRefs(data: CanvasNodeData): ImageSourceRef[] {
  const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
  if (refs.length) return refs

  if (data.sourcePreviewUrl) {
    refs.push({
      nodeId: data.linkedImageNodeId || data.sourceNodeId || '',
      previewUrl: data.sourcePreviewUrl,
      fileName: data.sourceFileName ?? '',
    })
  }

  return refs
}

function refreshPromptSourcePreviews(data: CanvasNodeData) {
  promptSourcePreviewUrl.value = data.sourcePreviewUrl ?? ''
  promptSourceFileName.value = data.sourceFileName ?? ''
  promptSourcePreviews.value = Array.isArray(data.imageSourceRefs)
    ? data.imageSourceRefs.filter((item) => item.previewUrl)
    : []
}

function addPromptImageSourceRef(payload: {
  nodeId?: string
  previewUrl: string
  fileName?: string
}) {
  const g = graph.value
  const textNodeId = activePickerNodeId.value
  if (!g || !textNodeId || !payload.previewUrl) return

  const cell = g.getCellById(textNodeId)
  if (!cell?.isNode()) return

  const data = { ...(cell.getData() as CanvasNodeData) }
  if (data.kind !== 'text') return

  const ref: ImageSourceRef = {
    nodeId: payload.nodeId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    previewUrl: payload.previewUrl,
    fileName: payload.fileName ?? '',
  }

  let refs = seedPromptImageRefs(data)
  const existingIdx = payload.nodeId
    ? refs.findIndex((item) => item.nodeId === payload.nodeId)
    : refs.findIndex((item) => item.previewUrl === payload.previewUrl)

  if (existingIdx >= 0) {
    refs.splice(existingIdx, 1, ref)
  } else if (!refs.some((item) => item.previewUrl === payload.previewUrl)) {
    refs.push(ref)
  } else {
    return
  }

  data.imageSourceRefs = refs
  const latest = refs[refs.length - 1]
  data.sourceNodeId = latest?.nodeId ?? ''
  data.sourcePreviewUrl = latest?.previewUrl ?? ''
  data.sourceFileName = latest?.fileName ?? ''
  data.linkedImageNodeId = latest?.nodeId ?? ''
  cell.setData(data, { overwrite: true })
  refreshPromptSourcePreviews(data)
  scheduleHistoryPush()
}

function onPromptUploadFiles(files: File[]) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  imageFiles.forEach((file) => {
    addPromptImageSourceRef({
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
    })
  })
}

function onPromptAddCanvasNode(sourceNodeId: string) {
  const g = graph.value
  const textNodeId = activePickerNodeId.value
  if (!g || !textNodeId || !sourceNodeId || sourceNodeId === textNodeId) return

  const source = g.getCellById(sourceNodeId)
  const textCell = g.getCellById(textNodeId)
  if (!source?.isNode() || !textCell?.isNode()) return

  const sourceData = source.getData() as CanvasNodeData
  if (sourceData.kind !== 'image' || !sourceData.previewUrl || sourceData.uploadState === 'uploading') {
    return
  }

  ensureImageTextEdge(g, sourceNodeId, textNodeId)
  const synced = syncTextNodeImageSource(g, textCell as Node, source as Node)
  refreshPromptSourcePreviews(synced)
  scheduleHistoryPush()
}

/** 文本提示栏：删除某张来源图片 —— 移除其连线、从来源数组移除、刷新提示栏 */
function removePromptImageSource(sourceNodeId?: string) {
  const g = graph.value
  const textNodeId = activePickerNodeId.value
  if (!g || !textNodeId) return
  const cell = g.getCellById(textNodeId)
  if (!cell?.isNode()) return

  const data = { ...(cell.getData() as CanvasNodeData) }
  let refs = seedPromptImageRefs(data)

  if (!sourceNodeId) {
    refs.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    refs = []
  } else {
    const removed = refs.filter((item) => item.nodeId === sourceNodeId)
    removed.forEach((item) => {
      if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
    })
    refs = refs.filter((item) => item.nodeId !== sourceNodeId)

    g.getEdges().forEach((edge) => {
      const s = edge.getSourceCellId()
      const t = edge.getTargetCellId()
      if (
        (s === sourceNodeId && t === textNodeId) ||
        (s === textNodeId && t === sourceNodeId)
      ) {
        g.removeEdge(edge.id)
      }
    })
  }

  data.imageSourceRefs = refs
  const latest = refs[refs.length - 1]
  data.sourceNodeId = latest?.nodeId ?? ''
  data.sourcePreviewUrl = latest?.previewUrl ?? ''
  data.sourceFileName = latest?.fileName ?? ''
  data.linkedImageNodeId = latest?.nodeId ?? ''
  cell.setData(data, { overwrite: true })
  refreshPromptSourcePreviews(data)
  scheduleHistoryPush()
}

function loadPromptBarContext(nodeId: string) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return

  const synced = syncTextNodeImageSource(g, cell as Node)
  promptSourcePreviewUrl.value = synced.sourcePreviewUrl ?? ''
  promptSourceFileName.value = synced.sourceFileName ?? ''
  promptSourcePreviews.value = Array.isArray(synced.imageSourceRefs)
    ? synced.imageSourceRefs.filter((item) => item.previewUrl)
    : []

  if (synced.textPickerTask === 'img2prompt') {
    modelType.value = 'img2prompt'
    promptText.value = synced.genPrompt?.trim() || IMG2PROMPT_DEFAULT_INSTRUCTION
    return
  }

  modelType.value = 'free'
  promptText.value = synced.genPrompt ?? ''
}

function persistPromptBarDraft() {
  const g = graph.value
  const nodeId = activePickerNodeId.value
  if (!g || !nodeId) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData) }
  data.genPrompt = promptText.value
  cell.setData(data)
}

function plainTextToEditorHtml(text: string) {
  return text
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

async function submitTextPrompt() {
  if (!canSubmitTextPrompt.value || promptSubmitting.value) return

  const g = graph.value
  const nodeId = activePickerNodeId.value
  if (!g || !nodeId) return

  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return

  promptSubmitting.value = true
  persistPromptBarDraft()

  try {
    if (modelType.value === 'img2prompt' || isImg2PromptTask.value) {
      const imageNode = findIncomingImageNode(g, nodeId)
      const imgData = imageNode?.getData() as CanvasNodeData | undefined
      const loadingData = {
        ...(cell.getData() as CanvasNodeData),
        mode: 'editor' as const,
        textGenState: 'loading' as const,
        textGenProgress: 0,
      }
      cell.setData(loadingData)

      // 模拟生成进度：准备中 → 生成中 X%
      let progress = 0
      const timer = window.setInterval(() => {
        progress = Math.min(95, progress + Math.round(8 + Math.random() * 12))
        cell.setData({
          ...(cell.getData() as CanvasNodeData),
          textGenProgress: progress,
        })
      }, 280)

      let result = ''
      try {
        result = await mockImg2Prompt(promptText.value, {
          previewUrl: imgData?.previewUrl ?? promptSourcePreviewUrl.value,
          fileName: imgData?.fileName ?? promptSourceFileName.value,
          mediaWidth: imgData?.mediaWidth,
          mediaHeight: imgData?.mediaHeight,
        })
      } finally {
        window.clearInterval(timer)
      }

      const data = { ...(cell.getData() as CanvasNodeData) }
      data.content = plainTextToEditorHtml(result)
      data.mode = 'editor'
      data.textPickerTask = ''
      data.textGenState = 'done'
      data.textGenProgress = 100
      data.genPrompt = promptText.value
      cell.setData(data)
      selectedNodeId.value = nodeId
      selectedKind.value = 'text'
      syncNodeSelectionHighlight(nodeId)
      activePickerNodeId.value = ''
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }

    const trimmedPrompt = promptText.value.trim()
    const loadingData = {
      ...(cell.getData() as CanvasNodeData),
      mode: 'editor' as const,
      textGenState: 'loading' as const,
      textGenProgress: 0,
      genPrompt: trimmedPrompt,
      promptBarPinned: true,
      textPickerTask: '' as const,
    }
    cell.setData(loadingData)

    let progress = 0
    const timer = window.setInterval(() => {
      progress = Math.min(95, progress + Math.round(8 + Math.random() * 12))
      cell.setData({
        ...(cell.getData() as CanvasNodeData),
        textGenProgress: progress,
      })
    }, 280)

    let result = ''
    try {
      result = await mockTextGenerate(trimmedPrompt)
    } finally {
      window.clearInterval(timer)
    }

    const data = { ...(cell.getData() as CanvasNodeData) }
    data.content = plainTextToEditorHtml(result)
    data.mode = 'editor'
    data.textGenState = 'done'
    data.textGenProgress = 100
    data.genPrompt = trimmedPrompt
    data.promptBarPinned = true
    data.textPickerTask = ''
    cell.setData(data)
    selectedNodeId.value = nodeId
    selectedKind.value = 'text'
    syncNodeSelectionHighlight(nodeId)
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()
  } finally {
    promptSubmitting.value = false
  }
}

async function generateImageFromPrompt() {
  if (imageGenSubmitting.value) return
  const g = graph.value
  const nodeId = activeImageGenPromptNodeId.value
  if (!g || !nodeId) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return

  imageGenSubmitting.value = true
  persistImageGenPrompt()

  cell.setData({
    ...(cell.getData() as CanvasNodeData),
    imageGenState: 'loading',
    imageGenProgress: 0,
  })

  let progress = 0
  const timer = window.setInterval(() => {
    progress = Math.min(95, progress + Math.round(7 + Math.random() * 12))
    cell.setData({
      ...(cell.getData() as CanvasNodeData),
      imageGenProgress: progress,
    })
  }, 280)

  try {
    await new Promise((resolve) => window.setTimeout(resolve, 2600))
  } finally {
    window.clearInterval(timer)
  }

  cell.setData({
    ...(cell.getData() as CanvasNodeData),
    imageGenState: 'done',
    imageGenProgress: 100,
    previewUrl: exampleImage,
    fileName: IMG2PROMPT_EXAMPLE_FILENAME,
    uploadState: 'done',
  })
  imageGenSubmitting.value = false
  selectedNodeId.value = nodeId
  selectedKind.value = 'image'
  syncNodeSelectionHighlight(nodeId)
  bumpToolbarRevision()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function openVideoGenPromptBar(nodeId: string, tab = 'text2video') {
  closeImageGenPromptBar()

  const g = graph.value
  if (g) {
    const cell = g.getCellById(nodeId)
    if (cell?.isNode()) {
      const data = { ...(cell.getData() as CanvasNodeData) }
      if (data.kind === 'video' && data.mode === 'editor' && !data.previewUrl) {
        data.mode = 'picker'
      }
      data.videoGenTab = tab
      cell.setData(data)
    }
  }

  activeVideoGenPromptNodeId.value = nodeId
  activePickerNodeId.value = ''
  videoGenActiveTab.value = tab
  videoGenPromptDragOffset.value = { x: 0, y: 0 }
  loadVideoGenPromptFields(nodeId)
  updateVideoGenPromptBarPosition()
}

function closeVideoGenPromptBar() {
  activeVideoGenPromptNodeId.value = ''
}

function enterElementSelectMode() {
  elementSelectReturnNodeId.value = activeVideoGenPromptNodeId.value
  showElementSelectMode.value = true
}

function exitElementSelectMode() {
  showElementSelectMode.value = false
  elementSelectReturnNodeId.value = ''
}

function returnFromElementSelect() {
  const returnId = elementSelectReturnNodeId.value
  exitElementSelectMode()
  if (!returnId) return
  const g = graph.value
  const cell = g?.getCellById(returnId)
  if (!cell?.isNode()) return
  selectedNodeId.value = returnId
  selectedKind.value = 'video'
  syncNodeSelectionHighlight(returnId)
  openVideoGenPromptBar(returnId, videoGenActiveTab.value)
  updateNodeToolbar()
}

function onVideoGenQuickAction(key: string) {
  if (key === 'mark') {
    if (showElementSelectMode.value) {
      exitElementSelectMode()
      return
    }
    enterElementSelectMode()
  }
}

function openImageGenPromptBar(nodeId: string) {
  closeVideoGenPromptBar()

  const g = graph.value
  if (g) {
    const cell = g.getCellById(nodeId)
    if (cell?.isNode()) {
      const data = { ...(cell.getData() as CanvasNodeData) }
      if (data.kind === 'image' && data.imageGenTask === 'img2img') {
        data.imageGenTask = 'picker'
        data.mode = 'picker'
        cell.setData(data)
      }
    }
  }

  activeImageGenPromptNodeId.value = nodeId
  activePickerNodeId.value = ''
  loadImageGenPromptFields(nodeId)
  updateImageGenPromptBarPosition()
}

function closeImageGenPromptBar() {
  activeImageGenPromptNodeId.value = ''
}

function handleApplyImageGenTask(nodeId: string, task: ImageGenTask) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  selectedNodeId.value = nodeId

  if (task === 'img2img') {
    openImageGenPromptBar(nodeId)
    updateNodeToolbar()
    return
  }

  applyImageGenTaskToNode(cell as Node, task)
  closeImageGenPromptBar()
  updateNodeToolbar()
}

provide('applyImageGenTask', handleApplyImageGenTask)

function handleOpenVideoGenPromptBar(nodeId: string, tab?: string) {
  selectedNodeId.value = nodeId
  openVideoGenPromptBar(nodeId, tab ?? 'text2video')
  syncNodeSelectionHighlight(nodeId)
  updateNodeToolbar()
}

provide('openVideoGenPromptBar', handleOpenVideoGenPromptBar)

function removeConnectPreviewEdge() {
  const g = graph.value as CanvasGraph | null
  if (!g?.__connectPreviewEdgeId) return
  const edge = g.getCellById(g.__connectPreviewEdgeId)
  if (edge?.isEdge()) g.removeEdge(edge)
  g.__connectPreviewEdgeId = ''
}

function syncConnectPreviewEdgeTarget() {
  const g = graph.value as CanvasGraph | null
  if (!g?.__connectPreviewEdgeId || !canvasRef.value) return
  const edge = g.getCellById(g.__connectPreviewEdgeId)
  if (!edge?.isEdge()) return

  const rect = canvasRef.value.getBoundingClientRect()
  const clientX = rect.left + connectMenuPos.value.left
  const clientY = rect.top + connectMenuPos.value.top
  edge.setTarget(g.clientToLocal(clientX, clientY))
}

function closeConnectMenu() {
  removeConnectPreviewEdge()
  showConnectMenu.value = false
  connectSourceNodeId.value = ''
  connectReleasePoint.value = null
}

function closeAddMenu() {
  showAddMenu.value = false
  addMenuDropPoint.value = null
}

function toggleProjectMenu() {
  showProjectMenu.value = !showProjectMenu.value
}

function closeProjectMenu() {
  showProjectMenu.value = false
}

function closeZoomMenu() {
  showZoomMenu.value = false
}

function toggleZoomMenu() {
  showZoomMenu.value = !showZoomMenu.value
}

function applyZoomAfterChange() {
  syncZoom()
  updateNodeToolbar()
}

function zoomToScale(scale: number) {
  const g = graph.value
  if (!g) return
  const clamped = Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, scale))
  g.zoomTo(clamped)
  applyZoomAfterChange()
}

function zoomFitToScreen() {
  const g = graph.value
  if (!g) return
  g.zoomToFit({
    padding: 48,
    maxScale: CANVAS_MAX_ZOOM,
    minScale: CANVAS_MIN_ZOOM,
  })
  applyZoomAfterChange()
}

function onZoomMenuAction(
  action: 'in' | 'out' | 'fit' | 'preset',
  preset?: (typeof ZOOM_MENU_PRESETS)[number],
) {
  if (action === 'in') zoomIn()
  else if (action === 'out') zoomOut()
  else if (action === 'fit') zoomFitToScreen()
  else if (preset != null) zoomToScale(preset)
  closeZoomMenu()
}

function selectProject(projectId: string) {
  activeProjectId.value = projectId;
  closeProjectMenu()
}

function handleSaveCanvas() {
  const g = graph.value
  if (!g) return

  const snapshot: CanvasSnapshot = getCanvasSnapshot(g, {
    projectId: activeProjectId.value,
    projectName: currentProjectName.value,
    canvasBgTheme: canvasBgTheme.value,
    gridVisible: gridVisible.value,
    panMode: panMode.value,
    showMinimap: showMinimap.value,
  })

  saveCanvasSnapshotToStorage(snapshot)

  const project = canvasProjects.value.find((item) => item.id === activeProjectId.value)
  if (project) {
    project.saved = true
  }

  if (!activeProjectId.value) {
    console.warn('[Canvas] skip remote save: missing projectId')
    return
  }

  void api.saveProjectCanvas(activeProjectId.value, {
    revision: 1,
    saveType: 'MANUAL',
    canvasData: snapshot,
  }).then((res) => {
    console.info('[Canvas] saved to server', res)
  }).catch((error) => {
    console.error('[Canvas] save to server failed', error)
  })

  console.info('[Canvas] saved snapshot', snapshot)
}

function handleExportCanvas() {
  const g = graph.value
  if (!g) return

  const snapshot = getCanvasSnapshot(g, {
    projectId: activeProjectId.value,
    projectName: currentProjectName.value,
    canvasBgTheme: canvasBgTheme.value,
    gridVisible: gridVisible.value,
    panMode: panMode.value,
    showMinimap: showMinimap.value,
  })

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${activeProjectId.value || 'canvas'}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function openAddMenuAtGraphPoint(graphPoint: { x: number; y: number }) {
  const g = graph.value
  const overlayRoot = canvasRef.value
  if (!g || !overlayRoot) return

  closeConnectMenu()
  addMenuDropPoint.value = graphPoint

  const offset = graphLocalToContainerOffset(g, graphPoint.x, graphPoint.y, overlayRoot)
  const rect = overlayRoot.getBoundingClientRect()
  const menuWidth = 220
  const menuHeight = 420
  addMenuPos.value = {
    left: Math.max(12, Math.min(offset.left, rect.width - menuWidth - 12)),
    top: Math.max(60, Math.min(offset.top, rect.height - menuHeight - 12)),
  }
  showAddMenu.value = true
}

function updateAddMenuPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const drop = addMenuDropPoint.value
  if (!g || !overlayRoot || !showAddMenu.value || !drop) return

  const offset = graphLocalToContainerOffset(g, drop.x, drop.y, overlayRoot)
  const rect = overlayRoot.getBoundingClientRect()
  const menuWidth = 220
  const menuHeight = 420
  addMenuPos.value = {
    left: Math.max(12, Math.min(offset.left, rect.width - menuWidth - 12)),
    top: Math.max(60, Math.min(offset.top, rect.height - menuHeight - 12)),
  }
}

function updateConnectMenuPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const release = connectReleasePoint.value
  if (!g || !overlayRoot || !showConnectMenu.value || !release) return

  const source = g.getCellById(connectSourceNodeId.value)
  if (!source?.isNode()) return

  const { left, top } = getConnectMenuPosition(g, source as Node, overlayRoot, release)
  connectMenuPos.value = { left, top }
  syncConnectPreviewEdgeTarget()
}

function openConnectMenu(source: Node, releasePoint: { x: number; y: number }) {
  const g = graph.value
  const overlayRoot = canvasRef.value
  if (!g || !overlayRoot) return

  closeAddMenu()
  connectSourceNodeId.value = source.id
  connectReleasePoint.value = releasePoint
  const { left, top } = getConnectMenuPosition(
    g,
    source,
    overlayRoot,
    releasePoint,
  )
  connectMenuPos.value = { left, top }
  showConnectMenu.value = true
  ;(g as CanvasGraph).__suppressBlankCloseForConnect = true
  nextTick(() => syncConnectPreviewEdgeTarget())
}

function finishConnectSpawn(node: Node) {
  selectedNodeId.value = node.id
  syncNodeSelectionHighlight(node.id)
  updateNodeToolbar()
  syncNodeCount()
  closeConnectMenu()
}

function onConnectMenuItem(item: (typeof CONNECT_GENERATE_MENU)[number]) {
  if (item.disabled) return

  const g = graph.value
  const overlayRoot = canvasRef.value
  const sourceId = connectSourceNodeId.value
  if (!g || !overlayRoot || !sourceId) return

  const source = g.getCellById(sourceId)
  if (!source?.isNode()) return

  const point = resolveConnectSpawnPoint(
    g,
    overlayRoot,
    source as Node,
    connectMenuPos.value,
    item.key as ConnectMenuKey,
  )
  if (!point) return

  const spawned = createNodeFromConnectMenu(
    g,
    source as Node,
    point,
    item.key as ConnectMenuKey,
  )
  if (!spawned) return

  const data = spawned.getData() as CanvasNodeData
  if (data.mode === 'picker' && (data.kind === 'text' || data.kind === 'audio')) {
    activePickerNodeId.value = spawned.id
    if (data.kind === 'text') {
      loadPromptBarContext(spawned.id)
    }
  }

  finishConnectSpawn(spawned)

  // 文生图目标节点：在其下方打开图片生成提示栏，发送后图片进入加载
  if (data.kind === 'image' && data.imageGenState) {
    openImageGenPromptBar(spawned.id)
  } else if (data.kind === 'image') {
    // 由节点拖拽生成的图片节点（图生图占位），默认展示对话框
    openImageDialogue(spawned.id)
  }
}

function openConnectMenuByNodeId(nodeId: string, releasePoint: { x: number; y: number }) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  openConnectMenu(cell as Node, releasePoint)
}

provide('openConnectMenuByNodeId', openConnectMenuByNodeId)

function getEdgeReleasePoint(edge: Edge) {
  const target = edge.getTarget()
  if (target && typeof target === 'object' && 'x' in target && 'y' in target) {
    return { x: Number(target.x), y: Number(target.y) }
  }
  return null
}

function handleEdgeConnected({
  edge,
  isNew,
  currentCell,
  currentPoint,
}: {
  edge: Edge
  isNew?: boolean
  currentCell?: { isNode?: () => boolean } | null
  currentPoint?: { x: number; y: number } | null
}) {
  if (!isNew) return

  const g = graph.value
  if (!g) return

  if (currentCell?.isNode?.()) {
    const target = currentCell as Node
    const targetData = target.getData() as CanvasNodeData
    if (targetData.kind === 'text' || targetData.kind === 'video') {
      handleNodeEdgeLinked(target.id)
    } else if (targetData.kind === 'image' && canImageNodeAcceptIncoming(targetData)) {
      linkImageSourceFromEdge(g, edge, target)
    } else {
      g.removeEdge(edge.id)
    }
    return
  }

  const source = edge.getSourceCell()
  if (!source?.isNode() || !canOpenConnectMenu(source as Node)) {
    g.removeEdge(edge.id)
    return
  }

  const canvasGraph = g as CanvasGraph
  if (canvasGraph.__connectPreviewEdgeId === edge.id && showConnectMenu.value) return

  const releasePoint = currentPoint ?? getEdgeReleasePoint(edge)
  if (!releasePoint) return

  canvasGraph.__connectPreviewEdgeId = edge.id
  openConnectMenu(source as Node, releasePoint)
}

/** 将源图片节点追加到目标图片节点的输入源列表（按 nodeId 去重，支持多个不同源节点连入） */
function applyIncomingImageSource(target: Node, source: Node) {
  if (source.id === target.id) return false
  const sourceData = source.getData() as CanvasNodeData
  const data = { ...(target.getData() as CanvasNodeData) }

  const ref: ImageSourceRef = {
    nodeId: source.id,
    previewUrl: sourceData.previewUrl ?? '',
    fileName: sourceData.fileName ?? '',
  }
  const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
  // 兼容生成节点时写入的单一来源（如节点3 由节点1 连线生成），首次追加时先补回原始来源
  if (!refs.length && data.sourceNodeId && data.sourcePreviewUrl) {
    refs.push({
      nodeId: data.sourceNodeId,
      previewUrl: data.sourcePreviewUrl,
      fileName: data.sourceFileName ?? '',
    })
  }
  const existingIdx = refs.findIndex((item) => item.nodeId === source.id)
  if (existingIdx >= 0) refs.splice(existingIdx, 1, ref)
  else refs.push(ref)
  data.imageSourceRefs = refs

  // 兼容旧逻辑：主来源保留为最新连入的一张
  data.sourceNodeId = source.id
  data.sourcePreviewUrl = ref.previewUrl
  data.sourceFileName = ref.fileName
  data.inputUpdated = refs.some((item) => Boolean(item.previewUrl))
  // overwrite: true —— 避免 X6 默认深合并对 imageSourceRefs 数组按索引合并导致脏数据
  target.setData(data, { overwrite: true })
  return true
}

/** 将拖入连线的源节点图片写入目标图片节点的输入源，并保留连线 */
function linkImageSourceFromEdge(g: Graph, edge: Edge, target: Node) {
  const source = edge.getSourceCell()
  if (!source?.isNode() || !applyIncomingImageSource(target, source)) {
    g.removeEdge(edge.id)
    return
  }

  bumpToolbarRevision()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function onRemoveVideoSourceRef(imageNodeId: string) {
  const g = graph.value
  const videoNodeId = activeVideoGenPromptNodeId.value
  if (!g || !videoNodeId || !imageNodeId) return
  if (!disconnectImageFromVideo(g, imageNodeId, videoNodeId)) return
  bumpToolbarRevision()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function getVideoGenSourceLimit() {
  const rule = VIDEO_GEN_TAB_IMAGE_RULES[videoGenActiveTab.value]
  return rule?.max ?? 9
}

async function linkImageNodeToVideoGen(imageNodeId: string) {
  const g = graph.value
  const videoNodeId = activeVideoGenPromptNodeId.value
  if (!g || !videoNodeId || !imageNodeId || imageNodeId === videoNodeId) return false

  const source = g.getCellById(imageNodeId)
  if (!source?.isNode()) return false

  const sourceData = source.getData() as CanvasNodeData
  if (
    sourceData.kind !== 'image' ||
    !sourceData.previewUrl ||
    sourceData.uploadState === 'uploading' ||
    sourceData.imageGenTask === 'picker'
  ) {
    return false
  }

  if (findImageToVideoEdge(g, imageNodeId, videoNodeId)) return false

  const currentCount = getVideoSourceRefs(g, videoNodeId).length
  if (currentCount >= getVideoGenSourceLimit()) return false

  connectGenEdge(g, imageNodeId, videoNodeId)
  bumpToolbarRevision()
  scheduleHistoryPush()
  return true
}

async function onVideoGenUploadFiles(files: File[]) {
  const g = graph.value
  const videoNodeId = activeVideoGenPromptNodeId.value
  if (!g || !videoNodeId) return

  const videoCell = g.getCellById(videoNodeId)
  if (!videoCell?.isNode()) return

  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  if (!imageFiles.length) return

  let currentCount = getVideoSourceRefs(g, videoNodeId).length
  const limit = getVideoGenSourceLimit()
  const bbox = videoCell.getBBox()

  for (let index = 0; index < imageFiles.length; index += 1) {
    if (currentCount >= limit) break

    const point = {
      x: bbox.x - 200 - index * 48,
      y: bbox.y + index * 36,
    }
    const node = await addImageFromFile(imageFiles[index], point)
    if (!node) continue

    const linked = await linkImageNodeToVideoGen(node.id)
    if (linked) currentCount += 1
  }

  updateNodeToolbar()
}

function onVideoGenAddCanvasNode(sourceNodeId: string) {
  void linkImageNodeToVideoGen(sourceNodeId).then((linked) => {
    if (linked) updateNodeToolbar()
  })
}

/** 节点被删除时，清理所有下游图片节点中引用它的输入源（对话框缩略图随之移除） */
function detachImageSourceFromDownstream(g: Graph, deletedNodeId: string) {
  g.getNodes().forEach((node) => {
    if (node.id === deletedNodeId) return
    const data = node.getData() as CanvasNodeData
    if (data.kind !== 'image' && data.kind !== 'text') return

    const refs = Array.isArray(data.imageSourceRefs) ? data.imageSourceRefs : []
    const hasRef = refs.some((item) => item.nodeId === deletedNodeId)
    const hasSingle = data.sourceNodeId === deletedNodeId || data.linkedImageNodeId === deletedNodeId
    if (!hasRef && !hasSingle) return

    const next = { ...data }
    const filtered = refs.filter((item) => item.nodeId !== deletedNodeId)
    next.imageSourceRefs = filtered
    const latest = filtered[filtered.length - 1]
    next.sourceNodeId = latest?.nodeId ?? ''
    next.sourcePreviewUrl = latest?.previewUrl ?? ''
    next.sourceFileName = latest?.fileName ?? ''
    next.inputUpdated = filtered.some((item) => Boolean(item.previewUrl))
    if (data.kind === 'text') next.linkedImageNodeId = latest?.nodeId ?? ''
    node.setData(next, { overwrite: true })
  })
}

function removeNodeById(nodeId: string) {
  const g = graph.value
  if (!g || !nodeId) return

  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return

  normalizeGroupMembership(g, nodeId)
  detachImageSourceFromDownstream(g, nodeId)
  g.removeCell(cell)
  bumpToolbarRevision()
  textEditorApis.delete(nodeId)
  if (activePickerNodeId.value === nodeId) {
    activePickerNodeId.value = ''
  }
  if (activeImageGenPromptNodeId.value === nodeId) {
    closeImageGenPromptBar()
  }
  if (activeVideoGenPromptNodeId.value === nodeId) {
    closeVideoGenPromptBar()
  }
  syncSelectionFromGraph()
  syncNodeCount()
  scheduleHistoryPush()
}

provide('deleteCanvasNode', removeNodeById)

function openTextExpand(nodeId: string) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData
  textExpandNodeId.value = nodeId
  textExpandTitle.value = data.title || '文本节点'
  textExpandOpen.value = true
  nextTick(() => {
    const el = textExpandEditorRef.value
    if (!el) return
    el.innerHTML = data.content || ''
    el.focus()
  })
}

function closeTextExpand() {
  persistTextExpandContent()
  textExpandOpen.value = false
  textExpandNodeId.value = ''
}

function onTextExpandInput() {
  persistTextExpandContent()
}

function persistTextExpandContent() {
  const g = graph.value
  const nodeId = textExpandNodeId.value
  const el = textExpandEditorRef.value
  if (!g || !nodeId || !el) return
  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData), content: el.innerHTML }
  cell.setData(data)
}

// value：颜色/字体/字号等带参命令的取值
function onTextFormatAction(cmd: TextFormatCommand, value?: string) {
  if (cmd === 'download') {
    downloadSelectedTextNode()
    return
  }
  if (cmd === 'delete') {
    removeSelectedNodes()
    return
  }
  const api = textEditorApis.get(selectedNodeId.value)
  if (!api) return
  if (cmd === 'expand') {
    openTextExpand(selectedNodeId.value)
    return
  }
  api.execFormat(cmd, value)
}

function downloadSelectedTextNode() {
  const api = textEditorApis.get(selectedNodeId.value)
  const text = api?.getPlainText() ?? ''
  if (!text.trim()) return
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${getSelectedNodeData()?.title || '文本节点'}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

function handleTextPickerAction(key: string, nodeId: string) {
  const g = graph.value
  if (!g) return

  selectedNodeId.value = nodeId
  selectedKind.value = 'text'
  syncNodeSelectionHighlight(nodeId)

  if (key === 'text2video') {
    activePickerNodeId.value = nodeId
    const source = g.getCellById(nodeId)
    if (!source?.isNode()) return
    const spawned = createNodeFromConnectMenu(
      g,
      source as Node,
      getLinkedSpawnPoint(source as Node, 'video', { mode: 'picker' }),
      'video',
    )
    if (spawned) {
      finishConnectSpawn(spawned)
      openVideoGenPromptBar(spawned.id, 'text2video')
    }
    updateNodeToolbar()
    return
  }

  if (key === 'img2prompt') {
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const textNode = cell as Node

    const data = { ...(textNode.getData() as CanvasNodeData) }
    data.mode = 'picker'
    data.textPickerTask = 'img2prompt'
    data.textGenState = 'idle'
    if (!data.genPrompt?.trim()) {
      data.genPrompt = IMG2PROMPT_DEFAULT_INSTRUCTION
    }
    textNode.setData(data)

    // 若文本节点尚未连接图片，则在左侧自动生成一张默认示例图并连线（图片 → 文本）
    let imageNode = findIncomingImageNode(g, nodeId)
    if (!imageNode) {
      const bbox = textNode.getBBox()
      const point = { x: bbox.x - 160, y: bbox.y + bbox.height / 2 }
      imageNode = addCanvasNode(g, 'image', point, {
        mode: 'editor',
        previewUrl: exampleImage,
        fileName: IMG2PROMPT_EXAMPLE_FILENAME,
        uploadState: 'done',
      })
      connectGenEdge(g, imageNode.id, nodeId)
    }

    syncTextNodeImageSource(g, textNode, imageNode)
    modelType.value = 'img2prompt'

    // 与视频一致：生成图片节点后先选中图片节点（其工具栏出现），
    // 待用户点击文本节点时再在其下方弹出提示词输入框
    activePickerNodeId.value = ''
    selectedNodeId.value = imageNode.id
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(imageNode.id)
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()
    return
  }

  const cell = g.getCellById(nodeId)
  if (!cell?.isNode()) return
  const data = { ...(cell.getData() as CanvasNodeData) }
  data.content = ''
  data.mode = 'editor'
  cell.setData(data)
  bumpToolbarRevision()
  updateNodeToolbar()
}

function handleNodeEdgeLinked(targetNodeId: string, sourceNodeId?: string) {
  const g = graph.value
  if (!g) return
  const cell = g.getCellById(targetNodeId)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData

  if (data.kind === 'text') {
    syncTextNodeImageSource(g, cell as Node)
    if (activePickerNodeId.value === targetNodeId) {
      loadPromptBarContext(targetNodeId)
    }
  } else if (data.kind === 'image' && canImageNodeAcceptIncoming(data)) {
    const source = sourceNodeId ? g.getCellById(sourceNodeId) : null
    if (source?.isNode()) {
      applyIncomingImageSource(cell as Node, source as Node)
      openImageDialogue(targetNodeId)
    }
  }

  bumpToolbarRevision()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function syncNodeCount() {
  nodeCount.value = graph.value?.getNodes().length ?? 0
  if (nodeCount.value === 0) {
    activePickerNodeId.value = ''
    closeImageGenPromptBar()
    closeVideoGenPromptBar()
    selectedNodeId.value = ''
    showBackToNodesBanner.value = false
    return
  }
  syncViewportNodeVisibility()
}

function syncViewportNodeVisibility() {
  const g = graph.value
  const root = canvasRef.value
  if (!g || !root || nodeCount.value === 0 || isRecenteringToNodes.value) {
    if (!isRecenteringToNodes.value) {
      showBackToNodesBanner.value = false
    }
    return
  }
  showBackToNodesBanner.value = !hasVisibleNodesInViewport(g, root)
}

function recenterToNodes() {
  const g = graph.value
  if (!g || isRecenteringToNodes.value) return

  isRecenteringToNodes.value = true
  showBackToNodesBanner.value = false

  centerGraphContent(g, {
    animate: true,
    duration: '360ms',
    onComplete: () => {
      isRecenteringToNodes.value = false
      syncZoom()
      syncViewportNodeVisibility()
      updateNodeToolbar()
    },
  })
}

function syncZoom(scale?: number) {
  if (typeof scale === 'number' && !Number.isNaN(scale)) {
    zoomLevel.value = scale
    return
  }
  zoomLevel.value = graph.value?.zoom() ?? 1
}

function getGraphCenter() {
  const g = graph.value
  if (!g) return { x: 400, y: 320 }
  return getViewportCenterLocal(g)
}

function getGraphSelectedNodeIds() {
  const g = graph.value
  if (!g) return []
  return g
    .getSelectedCells()
    .filter((cell) => cell.isNode())
    .map((cell) => cell.id)
}

function syncNodeSelectionHighlight(selectedIds: string | string[] = []) {
  const g = graph.value
  if (!g) return

  const idSet = new Set(
    Array.isArray(selectedIds)
      ? selectedIds
      : selectedIds
        ? [selectedIds]
        : getGraphSelectedNodeIds(),
  )

  g.getNodes().forEach((node) => {
    const data = node.getData() as CanvasNodeData
    const isSelected = idSet.has(node.id)
    if (Boolean(data.isSelected) === isSelected) return
    node.setData({ ...data, isSelected })
  })
}

function syncSelectionFromGraph() {
  const g = graph.value
  if (!g) return

  const ids = getGraphSelectedNodeIds()
  selectedNodeIds.value = ids

  if (ids.length > 0) {
    selectedEdgeId.value = ''
    syncEdgeSelectionHighlight(g, '')
    const primaryId = ids[ids.length - 1]
    const cell = g.getCellById(primaryId)
    if (cell?.isNode()) {
      selectedNodeId.value = primaryId
      selectedKind.value = (cell.getData() as CanvasNodeData).kind
    }
  } else {
    selectedNodeId.value = ''
    selectedKind.value = null
  }

  syncNodeSelectionHighlight(ids)
  bumpToolbarRevision()
  updateNodeToolbar()
}

function selectGraphNodes(target: Node | string | (Node | string)[]) {
  const g = graph.value
  if (!g) return

  const cells = (Array.isArray(target) ? target : [target])
    .map((item) => (typeof item === 'string' ? g.getCellById(item) : item))
    .filter((cell): cell is Node => cell != null && cell.isNode())

  clearEdgeSelection()
  g.cleanSelection()
  if (cells.length) g.select(cells)
  syncSelectionFromGraph()
}

function clearEdgeSelection() {
  const g = graph.value
  if (!g || !selectedEdgeId.value) return
  selectedEdgeId.value = ''
  syncEdgeSelectionHighlight(g, '')
}

function handleEdgeClick({ edge, e }: { edge: Edge; e?: MouseEvent }) {
  if (!isPersistedEdge(edge)) return
  e?.stopPropagation()

  const g = graph.value
  if (!g) return

  g.cleanSelection()
  selectedNodeId.value = ''
  selectedNodeIds.value = []
  selectedKind.value = null
  syncNodeSelectionHighlight([])

  selectedEdgeId.value = edge.id
  syncEdgeSelectionHighlight(g, edge.id)
  updateNodeToolbar()
}

function removeSelectedEdge() {
  const g = graph.value
  const edgeId = selectedEdgeId.value
  if (!g || !edgeId) return false

  const cell = g.getCellById(edgeId)
  if (!cell?.isEdge() || !isPersistedEdge(cell as Edge)) return false

  const edge = cell as Edge
  const relation = detachEdgeRelation(g, edge)

  const canvasGraph = g as CanvasGraph
  if (canvasGraph.__connectPreviewEdgeId === edgeId) {
    canvasGraph.__connectPreviewEdgeId = ''
  }

  g.removeEdge(edgeId)
  selectedEdgeId.value = ''
  syncEdgeSelectionHighlight(g, '')

  if (relation?.targetId === activePickerNodeId.value) {
    loadPromptBarContext(relation.targetId)
  }
  if (relation?.targetId === activeImageGenPromptNodeId.value) {
    loadImageGenPromptFields(relation.targetId)
  }
  if (relation?.targetId === selectedNodeId.value) {
    bumpToolbarRevision()
  }

  updateNodeToolbar()
  scheduleHistoryPush()
  return true
}

function updatePromptBarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const id = activePickerNodeId.value
  if (!g || !overlayRoot || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  promptPos.value = getNodePromptPosition(g, cell as Node, overlayRoot)
}

function updateTextFormatToolbarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const id = selectedNodeId.value
  if (!g || !overlayRoot || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return
  const data = cell.getData() as CanvasNodeData
  if (data.kind !== 'text' || data.mode !== 'editor') return

  textFormatToolbarPos.value = getNodeTextFormatToolbarPosition(g, cell as Node, overlayRoot)
  textDownloadPos.value = getNodeTextDownloadPosition(g, cell as Node, overlayRoot)
}

function updateImageGenPromptBarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const id = activeImageGenPromptNodeId.value
  if (!g || !overlayRoot || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  imageGenPromptPos.value = getNodeImageGenPromptPosition(g, cell as Node, overlayRoot)
}

function updateVideoGenPromptBarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const id = activeVideoGenPromptNodeId.value
  if (!g || !overlayRoot || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  const base = getNodeVideoGenPromptPosition(g, cell as Node, overlayRoot)
  videoGenPromptPos.value = {
    ...base,
    left: base.left + videoGenPromptDragOffset.value.x,
    top: base.top + videoGenPromptDragOffset.value.y,
  }
}

function onVideoGenPromptDragStart(event: MouseEvent) {
  const startX = event.clientX
  const startY = event.clientY
  const base = { ...videoGenPromptDragOffset.value }

  const onMove = (moveEvent: MouseEvent) => {
    videoGenPromptDragOffset.value = {
      x: base.x + (moveEvent.clientX - startX),
      y: base.y + (moveEvent.clientY - startY),
    }
    updateVideoGenPromptBarPosition()
  }

  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function updateMultiSelectToolbarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const ids = selectedNodeIds.value
  if (!g || !overlayRoot || ids.length < 2) return
  multiSelectToolbarPos.value = getMultiSelectionToolbarPosition(g, ids, overlayRoot)
}

function updateGroupToolbarPosition() {
  const g = graph.value
  const overlayRoot = canvasRef.value
  const group = activeGroupSelection.value
  if (!g || !overlayRoot || !group) {
    groupOverlayBox.value = null
    return
  }
  const box = getGroupScreenBox(g, group.nodeIds, overlayRoot)
  groupOverlayBox.value = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  }
  groupToolbarPos.value = {
    left: box.centerX,
    top: box.anchorTop - 10,
  }
}

function updateNodeToolbar() {
  updatePromptBarPosition()
  updateTextFormatToolbarPosition()
  updateImageGenPromptBarPosition()
  updateVideoGenPromptBarPosition()
  updateAddMenuPosition()
  updateConnectMenuPosition()
  updateMultiSelectToolbarPosition()
  updateGroupToolbarPosition()

  const g = graph.value
  const overlayRoot = canvasRef.value
  const id = selectedNodeId.value
  if (!g || !overlayRoot || !id) return

  const cell = g.getCellById(id)
  if (!cell?.isNode()) return

  const data = cell.getData() as CanvasNodeData
  selectedKind.value = data.kind
  const node = cell as Node
  toolbarPos.value = getNodeToolbarPosition(g, node, overlayRoot)
  dialoguePos.value = getNodeDialoguePosition(g, node, overlayRoot)
  if (showImageCrop.value) {
    imageCropPos.value = getNodeCropOverlayPosition(g, node, overlayRoot)
  }
  if (data.kind === 'video' && showVideoHdPanel.value) {
    videoHdPos.value = getNodeSidePanelPosition(g, node, overlayRoot)
  }
}

function addNode(kind: NodeKind, point?: { x: number; y: number }) {
  const g = graph.value
  if (!g) return

  const position = point ?? addMenuDropPoint.value ?? getGraphCenter()
  const node = addCanvasNode(g, kind, position)
  const data = node.getData() as CanvasNodeData

  if (data.mode === 'picker' && (kind === 'text' || kind === 'audio')) {
    activePickerNodeId.value = node.id
    if (kind === 'text') {
      loadPromptBarContext(node.id)
    }
  }

  selectedNodeId.value = node.id
  updateNodeToolbar()
  closeAddMenu()
  syncNodeCount()
  scheduleHistoryPush()
  return node
}

function addFromMenu(kind: NodeKind) {
  const drop = addMenuDropPoint.value
  if (drop) {
    addNode(kind, drop)
    return
  }

  const center = getGraphCenter()
  addNode(kind, {
    x: center.x + (Math.random() - 0.5) * 100,
    y: center.y + (Math.random() - 0.5) * 80,
  })
}

function isImageUploadFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(file.name)
  )
}

function isVideoUploadFile(file: File) {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)
  )
}

function filterUploadFiles(files: File[], filter: UploadFilter) {
  return files.filter((file) => {
    if (filter === 'image') return isImageUploadFile(file)
    if (filter === 'video') return isVideoUploadFile(file)
    return isImageUploadFile(file) || isVideoUploadFile(file)
  })
}

function hasCanvasFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function getHorizontalUploadSpawnPoint(
  base: { x: number; y: number },
  index: number,
  kind: NodeKind,
) {
  if (index === 0) return base
  const size = getNodeSize(kind, 'editor')
  return {
    x: base.x + index * (size.width + NODE_SPAWN_GAP_X),
    y: base.y,
  }
}

function spawnMediaFilesAtPoint(
  files: File[],
  basePoint: { x: number; y: number },
  options: { pendingNodeId?: string } = {},
) {
  const g = graph.value
  if (!g || !files.length) return

  const pendingId = options.pendingNodeId ?? ''
  let lastNodeId = ''
  let lastKind: NodeKind = 'image'

  files.forEach((file, index) => {
    const kind: NodeKind = isVideoUploadFile(file) ? 'video' : 'image'

    let node: Node | undefined
    if (index === 0 && pendingId) {
      const cell = g.getCellById(pendingId)
      if (cell?.isNode()) node = cell as Node
    }

    if (!node) {
      const point = getHorizontalUploadSpawnPoint(basePoint, index, kind)
      node = addCanvasNode(g, kind, point, {
        mode: 'editor',
        title: file.name,
        fileName: file.name,
      })
    } else {
      const data = { ...(node.getData() as CanvasNodeData) }
      data.mode = 'editor'
      data.title = file.name
      data.fileName = file.name
      node.setData(data)
    }

    runUploadSimulation(node, file)
    lastNodeId = node.id
    lastKind = kind
  })

  if (lastNodeId) {
    selectGraphNodes(lastNodeId)
    selectedKind.value = lastKind
  }
  syncNodeCount()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function onCanvasDragEnter(event: DragEvent) {
  if (!hasCanvasFileDrag(event)) return
  canvasFileDragDepth.value += 1
  isCanvasFileDragOver.value = true
}

function onCanvasDragOver(event: DragEvent) {
  if (!hasCanvasFileDrag(event)) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onCanvasDragLeave(event: DragEvent) {
  if (!hasCanvasFileDrag(event)) return
  canvasFileDragDepth.value = Math.max(0, canvasFileDragDepth.value - 1)
  if (canvasFileDragDepth.value === 0) {
    isCanvasFileDragOver.value = false
  }
}

function onCanvasFileDrop(event: DragEvent) {
  canvasFileDragDepth.value = 0
  isCanvasFileDragOver.value = false

  const g = graph.value
  if (!g) return

  const files = filterUploadFiles(Array.from(event.dataTransfer?.files ?? []), 'any')
  if (!files.length) return

  const point = clientPointToGraphLocal(g, event.clientX, event.clientY)
  spawnMediaFilesAtPoint(files, point)
}

function openFileUploadPicker(
  accept: string,
  filter: UploadFilter,
  multiple = true,
) {
  triggerFileInputClick(accept, filter, multiple)
}

function getMultiUploadSpawnPoint(
  base: { x: number; y: number },
  index: number,
  kind: NodeKind,
) {
  if (index === 0) return base
  const size = getNodeSize(kind, 'editor')
  return {
    x: base.x,
    y: base.y + index * (size.height + NODE_SPAWN_GAP_Y),
  }
}

function onMenuItem(item: (typeof ADD_NODE_GROUPS)[number]['items'][number]) {
  if ('action' in item && item.action === 'upload-image') {
    openFileUploadPicker('image/*', 'image', true)
    showAddMenu.value = false
    return
  }
  if ('action' in item && item.action === 'upload-video') {
    openFileUploadPicker('video/*', 'video', true)
    showAddMenu.value = false
    return
  }
  if ('action' in item && item.action === 'upload') {
    openFileUploadPicker('image/*,video/*', 'any', true)
    showAddMenu.value = false
    return
  }
  // if ('action' in item && item.action === 'history') {
  //   closeAddMenu()
  //   openAssetsPanel()
  //   return
  // }
  addFromMenu(item.kind)
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = filterUploadFiles(
    Array.from(input.files ?? []),
    pendingUploadFilter.value,
  )
  input.value = ''
  if (!files.length || !graph.value) return

  const basePoint = addMenuDropPoint.value ?? getGraphCenter()
  spawnMediaFilesAtPoint(files, basePoint, {
    pendingNodeId: pendingUploadNodeId.value,
  })

  pendingUploadNodeId.value = ''
  addMenuDropPoint.value = null
  closeAddMenu()
}

function toggleAddMenu() {
  if (showAddMenu.value) {
    closeAddMenu()
    return
  }

  addMenuDropPoint.value = null
  const overlayRoot = canvasRef.value
  if (overlayRoot) {
    const rect = overlayRoot.getBoundingClientRect()
    addMenuPos.value = {
      left: rect.width / 2,
      top: rect.height - 120,
    }
  }
  showAddMenu.value = true
  showAssetsPanel.value = false
  closeHistoryPanel()
  closeConnectMenu()
}

function openAssetsPanel() {
  showAssetsPanel.value = true
  closeAddMenu()
  assetsLoading.value = true
  window.setTimeout(() => {
    assetsLoading.value = false
  }, 800)
}

function toggleAssetsPanel() {
  if (showAssetsPanel.value) {
    showAssetsPanel.value = false
  } else {
    closeHistoryPanel()
    openAssetsPanel()
  }
}

function closeHistoryPanel() {
  showHistoryPanel.value = false
}

function toggleHistoryPanel() {
  if (showHistoryPanel.value) {
    closeHistoryPanel()
    return
  }
  showHistoryPanel.value = true
  showAssetsPanel.value = false
  closeAddMenu()
  closeConnectMenu()
  closeShortcutsPanel()
  closeZoomMenu()
}

function closeShortcutsPanel() {
  showShortcutsPanel.value = false
}

function toggleShortcutsPanel() {
  showShortcutsPanel.value = !showShortcutsPanel.value
  if (!showShortcutsPanel.value) return
  showZoomMenu.value = false
  closeAddMenu()
  closeConnectMenu()
  showAssetsPanel.value = false
  closeHistoryPanel()
}

function setRubberbandEnabled(enabled: boolean) {
  const g = graph.value
  if (!g) return
  if (enabled) g.enableRubberband()
  else g.disableRubberband()
}

function togglePanMode() {
  panMode.value = !panMode.value
  const scroller = graph.value ? getScroller(graph.value) : null
  if (!scroller) return
  scroller.togglePanning(panMode.value)
  setRubberbandEnabled(!panMode.value)
}

function handleTidyCanvas() {
  const g = graph.value
  if (!g || g.getNodes().length === 0) return
  tidyCanvas(g)
  updateNodeToolbar()
}

async function setupMinimap() {
  const g = graph.value
  const container = minimapContainerRef.value
  if (!g || !container || !showMinimap.value) return

  if (g.getPlugin('minimap')) {
    destroyMinimap(g)
  }

  await nextTick()
  createMinimap(g, container, canvasBgTheme.value)
}

async function toggleCanvasBgTheme() {
  canvasBgTheme.value = canvasBgTheme.value === 'dark' ? 'light' : 'dark'
  applyCanvasBgTheme(graph.value, canvasBgTheme.value, gridVisible.value)

  if (showMinimap.value) {
    teardownMinimap()
    await setupMinimap()
  }
}

function teardownMinimap() {
  const g = graph.value
  if (!g || !g.getPlugin('minimap')) return
  destroyMinimap(g)
}

async function toggleMinimap() {
  showMinimap.value = !showMinimap.value
  if (showMinimap.value) {
    await setupMinimap()
  } else {
    teardownMinimap()
  }
}

function toggleGrid() {
  const g = graph.value
  if (!g) return
  gridVisible.value = !gridVisible.value
  if (gridVisible.value) {
    g.showGrid()
    applyCanvasBgTheme(g, canvasBgTheme.value, gridVisible.value)
  } else {
    g.hideGrid()
  }
}

function zoomIn() {
  graph.value?.zoom(0.12)
  applyZoomAfterChange()
}

function zoomOut() {
  graph.value?.zoom(-0.12)
  applyZoomAfterChange()
}

function removeSelectedNodes() {
  const g = graph.value
  if (!g) return

  let ids = getGraphSelectedNodeIds()
  if (!ids.length && selectedNodeId.value) {
    ids = [selectedNodeId.value]
  }
  if (!ids.length) return

  clearEdgeSelection()
  g.cleanSelection()

  ids.forEach((id) => {
    if (activePickerNodeId.value === id) activePickerNodeId.value = ''
    if (activeImageGenPromptNodeId.value === id) closeImageGenPromptBar()
    if (activeVideoGenPromptNodeId.value === id) closeVideoGenPromptBar()
    textEditorApis.delete(id)
    detachImageSourceFromDownstream(g, id)
    normalizeGroupMembership(g, id)
    const cell = g.getCellById(id)
    if (cell?.isNode()) g.removeCell(cell)
  })

  selectedNodeId.value = ''
  selectedNodeIds.value = []
  selectedKind.value = null
  resetImageToolbarMore()
  resetImageDialogue()
  resetImageCrop()
  resetVideoDialogue()
  resetVideoHdPanel()
  resetVideoFramesPanel()
  syncNodeSelectionHighlight([])
  bumpToolbarRevision()
  updateNodeToolbar()
  syncNodeCount()
  scheduleHistoryPush()
}

function handleBlankDblClick(event: { x: number; y: number }) {
  openAddMenuAtGraphPoint({ x: event.x, y: event.y })
}

function handleNodeClick({ node, e }: { node: Node; e?: MouseEvent }) {
  let data = node.getData() as CanvasNodeData
  if (data.kind === 'video' && data.previewUrl && data.mode === 'picker') {
    data = { ...data, mode: 'editor' }
    node.setData(data)
  }
  const multiSelect = Boolean(e?.ctrlKey || e?.metaKey)

  clearEdgeSelection()
  selectedNodeId.value = node.id
  selectedKind.value = data.kind

  if (data.groupId && !multiSelect) {
    syncSelectionFromGraph()
    return
  }

  if (multiSelect) {
    syncSelectionFromGraph()
    return
  }

  resetImageToolbarMore()
  resetImageDialogue()
  resetImageCrop()
  resetVideoDialogue()
  resetVideoHdPanel()
  resetVideoFramesPanel()
  bumpToolbarRevision()

  if (showElementSelectMode.value && data.kind === 'image' && data.previewUrl) {
    syncSelectionFromGraph()
    return
  }

  const showImageGenPrompt =
    data.kind === 'image' &&
    data.imageGenTask === 'img2img'

  const showVideoGenPrompt =
    data.kind === 'video' &&
    data.mode === 'picker' &&
    !data.previewUrl &&
    data.uploadState !== 'uploading'

  if (showImageGenPrompt) {
    openImageGenPromptBar(node.id)
  } else if (showVideoGenPrompt) {
    openVideoGenPromptBar(node.id, data.videoGenTab ?? 'text2video')
  } else {
    closeImageGenPromptBar()
    closeVideoGenPromptBar()
    const showTextPromptBar =
      (data.kind === 'text' || data.kind === 'audio') &&
      (data.mode === 'picker' || (data.kind === 'text' && data.promptBarPinned))

    activePickerNodeId.value = showTextPromptBar ? node.id : ''
    if (activePickerNodeId.value && data.kind === 'text') {
      loadPromptBarContext(node.id)
    }
  }

  syncSelectionFromGraph()
}

function resetCanvasInteractionState() {
  closeAddMenu()
  closeProjectMenu()
  closeUserMenu()
  closeZoomMenu()
  closeShortcutsPanel()
  closeHistoryPanel()
  closeConnectMenu()
  activePickerNodeId.value = ''
  graph.value?.cleanSelection()
  selectedNodeId.value = ''
  selectedNodeIds.value = []
  selectedEdgeId.value = ''
  selectedKind.value = null
  resetImageToolbarMore()
  resetImageDialogue()
  resetImageCrop()
  resetVideoDialogue()
  resetVideoHdPanel()
  resetVideoFramesPanel()
  closeImageGenPromptBar()
  closeVideoGenPromptBar()
  closeTextExpand()
  exitElementSelectMode()
  syncNodeSelectionHighlight([])
  if (graph.value) syncEdgeSelectionHighlight(graph.value, '')
}

function dismissOneCanvasLayer() {
  if (imagePreviewUrl.value) {
    closeImagePreview()
    return true
  }
  if (showShortcutsPanel.value) {
    closeShortcutsPanel()
    return true
  }
  if (showImageCrop.value) {
    closeImageCrop()
    return true
  }
  if (nodeOverlaysRef.value?.dismissVideoGenPromptOverlay()) {
    return true
  }
  if (showImageHdMenu.value) {
    showImageHdMenu.value = false
    return true
  }
  if (showImageToolbarMoreMenu.value) {
    showImageToolbarMoreMenu.value = false
    return true
  }
  if (showImageToolbarMore.value) {
    resetImageToolbarMore()
    return true
  }
  const g = graph.value as CanvasGraph | null
  if (g?.__suppressBlankCloseForConnect) {
    g.__suppressBlankCloseForConnect = false
    return true
  }
  if (showConnectMenu.value) {
    closeConnectMenu()
    return true
  }
  if (showAddMenu.value) {
    closeAddMenu()
    return true
  }
  if (showProjectMenu.value) {
    closeProjectMenu()
    return true
  }
  if (showUserMenu.value) {
    closeUserMenu()
    return true
  }
  if (showZoomMenu.value) {
    closeZoomMenu()
    return true
  }
  if (showAssetsPanel.value) {
    showAssetsPanel.value = false
    return true
  }
  if (showHistoryPanel.value) {
    closeHistoryPanel()
    return true
  }
  if (showVideoFramesPanel.value) {
    resetVideoFramesPanel()
    return true
  }
  if (showVideoHdPanel.value) {
    resetVideoHdPanel()
    return true
  }
  if (showVideoDialogue.value) {
    resetVideoDialogue()
    return true
  }
  if (showImageDialogue.value) {
    resetImageDialogue()
    return true
  }
  if (textExpandOpen.value) {
    closeTextExpand()
    return true
  }
  if (activeImageGenPromptNodeId.value) {
    closeImageGenPromptBar()
    return true
  }
  if (activeVideoGenPromptNodeId.value) {
    closeVideoGenPromptBar()
    return true
  }
  if (activePickerNodeId.value) {
    activePickerNodeId.value = ''
    return true
  }
  if (showElementSelectMode.value) {
    exitElementSelectMode()
    return true
  }
  if (selectedEdgeId.value) {
    clearEdgeSelection()
    updateNodeToolbar()
    return true
  }
  if (selectedNodeId.value || selectedNodeIds.value.length) {
    graph.value?.cleanSelection()
    selectedNodeId.value = ''
    selectedNodeIds.value = []
    selectedKind.value = null
    resetImageToolbarMore()
    resetImageDialogue()
    resetImageCrop()
    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()
    syncNodeSelectionHighlight([])
    updateNodeToolbar()
    return true
  }
  return false
}

function handleNodeDataChange({ node }: { node: Node }) {
  const data = node.getData() as CanvasNodeData
  if (
    data.mode === 'editor' &&
    activePickerNodeId.value === node.id &&
    !data.promptBarPinned
  ) {
    activePickerNodeId.value = ''
  }
  if (activePickerNodeId.value === node.id && data.kind === 'text') {
    promptSourcePreviewUrl.value = data.sourcePreviewUrl ?? ''
    promptSourceFileName.value = data.sourceFileName ?? ''
    promptSourcePreviews.value = Array.isArray(data.imageSourceRefs)
      ? data.imageSourceRefs.filter((item) => item.previewUrl)
      : []
  }
  if (selectedNodeId.value === node.id) {
    selectedKind.value = data.kind
    bumpToolbarRevision()
    updateNodeToolbar()
  }
}

function getHistoryMeta() {
  return {
    projectId: activeProjectId.value,
    projectName: currentProjectName.value,
    canvasBgTheme: canvasBgTheme.value,
    gridVisible: gridVisible.value,
    panMode: panMode.value,
    showMinimap: showMinimap.value,
  }
}

function syncHistoryState() {
  canUndo.value = canvasHistory?.canUndo() ?? false
  canRedo.value = canvasHistory?.canRedo() ?? false
}

function scheduleHistoryPush() {
  const g = graph.value
  if (!g || !canvasHistory) return
  if (historyPushTimer) clearTimeout(historyPushTimer)
  historyPushTimer = setTimeout(() => {
    canvasHistory?.push(g)
    syncHistoryState()
    historyPushTimer = null
  }, 280)
}

function handleUndo() {
  const g = graph.value
  if (!g || !canvasHistory?.undo(g)) return
  syncHistoryState()
  syncNodeCount()
  resetCanvasInteractionState()
  nextTick(() => updateNodeToolbar())
}

function handleRedo() {
  const g = graph.value
  if (!g || !canvasHistory?.redo(g)) return
  syncHistoryState()
  syncNodeCount()
  resetCanvasInteractionState()
  nextTick(() => updateNodeToolbar())
}

function getActiveSelectedNodeIds() {
  if (selectedNodeIds.value.length >= 2) return [...selectedNodeIds.value]
  if (selectedNodeId.value) return [selectedNodeId.value]
  return []
}

function copySelectedNode() {
  const g = graph.value
  const ids = getActiveSelectedNodeIds()
  if (!g || !ids.length) return
  if (ids.length === 1) {
    const cell = g.getCellById(ids[0])
    if (!cell?.isNode()) return
    nodeClipboard.value = (cell as Node).toJSON()
    return
  }
  nodeClipboard.value = ids
    .map((id) => g.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())
    .map((cell) => (cell as Node).toJSON())
}

function copySelectedNodes() {
  copySelectedNode()
}

function duplicateSelectedNodes() {
  const g = graph.value
  const ids = getActiveSelectedNodeIds()
  if (!g || !ids.length) return

  const idSet = new Set(ids)
  const idMap = new Map<string, string>()
  const newNodes: Node[] = []

  ids.forEach((id) => {
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return
    const clone = (cell as Node).clone() as Node
    const cloneData = clone.getData() as CanvasNodeData
    const { groupId: _groupId, ...cloneRest } = cloneData
    clone.setData(cloneRest as CanvasNodeData)
    const pos = clone.getPosition()
    clone.position(pos.x + 32, pos.y + 32)
    g.addCell(clone)
    idMap.set(id, clone.id)
    newNodes.push(clone)
  })

  g.getEdges().forEach((edge) => {
    const sourceId = edge.getSourceCellId()
    const targetId = edge.getTargetCellId()
    if (!sourceId || !targetId || !idSet.has(sourceId) || !idSet.has(targetId)) return
    const nextSourceId = idMap.get(sourceId)
    const nextTargetId = idMap.get(targetId)
    if (!nextSourceId || !nextTargetId) return
    g.addEdge({
      source: { cell: nextSourceId, port: 'right' },
      target: { cell: nextTargetId, port: 'left' },
      attrs: edge.getAttrs(),
      zIndex: edge.getZIndex(),
    })
  })

  if (!newNodes.length) return
  selectGraphNodes(newNodes)
  syncNodeCount()
  scheduleHistoryPush()
}

function handleMultiSelectLayout() {
  const g = graph.value
  const ids = selectedNodeIds.value
  if (!g || ids.length < 2) return
  const nodes = ids
    .map((id) => g.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())
  tidyNodes(g, nodes)
  updateNodeToolbar()
  scheduleHistoryPush()
}

function handleMultiSelectSaveToAssets() {
  showAssetsPanel.value = true
}

function handleMultiSelectGroup() {
  const g = graph.value
  const ids = selectedNodeIds.value
  if (!g || ids.length < 2) return

  ungroupSelection(g, ids)
  const groupId = assignGroupId(g, ids)
  if (!groupId) return

  selectGraphNodes(ids)
  bumpToolbarRevision()
  scheduleHistoryPush()
}

function handleMergeStoryboardGroup() {
  const g = graph.value
  const ids = selectedNodeIds.value
  if (!g || ids.length < 2) return

  const groupId = mergeStoryboardGroup(g, ids)
  if (!groupId) return

  const memberIds = getNodesInGroup(g, groupId).map((node) => node.id)
  selectGraphNodes(memberIds)
  bumpToolbarRevision()
  scheduleHistoryPush()
}

function handleUngroup() {
  const g = graph.value
  const group = activeGroupSelection.value
  if (!g || !group) return

  const memberIds = [...group.nodeIds]
  ungroupSelection(g, memberIds)
  groupOverlayBox.value = null
  selectGraphNodes(memberIds)
  bumpToolbarRevision()
  updateNodeToolbar()
  scheduleHistoryPush()
}

function handleGroupLayout(direction: GroupLayoutDirection = 'horizontal') {
  const g = graph.value
  const group = activeGroupSelection.value
  if (!g || !group) return

  const nodes = group.nodeIds
    .map((id) => g.getCellById(id))
    .filter((cell): cell is Node => cell != null && cell.isNode())
  layoutNodesInGroup(nodes, direction)
  updateNodeToolbar()
  scheduleHistoryPush()
}

function handleGroupExecute() {
  // 整组执行：后续可接入流水线批量运行
}

function handleGroupAddToToolbox() {
  showAssetsPanel.value = true
}

function handleGroupToStoryboard() {
  const g = graph.value
  const group = activeGroupSelection.value
  if (!g || !group) return

  mergeStoryboardGroup(g, group.nodeIds)
  selectGraphNodes(group.nodeIds)
  bumpToolbarRevision()
  scheduleHistoryPush()
}

function handleGroupBatchDownload() {
  const g = graph.value
  const group = activeGroupSelection.value
  if (!g || !group) return

  group.nodeIds.forEach((id, index) => {
    const node = g.getCellById(id)
    if (!node?.isNode()) return
    const data = node.getData() as CanvasNodeData
    if (!data.previewUrl) return
    const link = document.createElement('a')
    link.href = data.previewUrl
    link.download = data.fileName || `group-image-${index + 1}.png`
    link.rel = 'noopener'
    link.click()
  })
}

function syncGroupedNodeMove(node: Node) {
  const g = graph.value
  if (!g) return

  const data = node.getData() as CanvasNodeData
  if (!data.groupId) {
    groupMoveState.anchorId = ''
    return
  }

  const members = getNodesInGroup(g, data.groupId)
  if (members.length < 2) return

  const pos = node.getPosition()
  if (groupMoveState.anchorId !== node.id) {
    groupMoveState.anchorId = node.id
    groupMoveState.lastX = pos.x
    groupMoveState.lastY = pos.y
    return
  }

  const dx = pos.x - groupMoveState.lastX
  const dy = pos.y - groupMoveState.lastY
  if (!dx && !dy) return

  members.forEach((member) => {
    if (member.id === node.id) return
    const memberPos = member.getPosition()
    member.position(memberPos.x + dx, memberPos.y + dy)
  })
  groupMoveState.lastX = pos.x
  groupMoveState.lastY = pos.y
}

function onGroupOverlayDragStart(event: MouseEvent) {
  const g = graph.value
  const root = canvasRef.value
  const group = activeGroupSelection.value
  if (!g || !root || !group) return

  groupOverlayDrag.active = true
  groupOverlayDrag.nodeIds = [...group.nodeIds]
  const local = clientPointToGraphLocal(g, event.clientX, event.clientY)
  groupOverlayDrag.lastGraphX = local.x
  groupOverlayDrag.lastGraphY = local.y

  const onMove = (moveEvent: MouseEvent) => {
    if (!groupOverlayDrag.active) return
    const current = clientPointToGraphLocal(g, moveEvent.clientX, moveEvent.clientY)
    const dx = current.x - groupOverlayDrag.lastGraphX
    const dy = current.y - groupOverlayDrag.lastGraphY
    if (!dx && !dy) return

    groupOverlayDrag.nodeIds.forEach((id) => {
      const node = g.getCellById(id)
      if (!node?.isNode()) return
      const pos = node.getPosition()
      node.position(pos.x + dx, pos.y + dy)
    })
    groupOverlayDrag.lastGraphX = current.x
    groupOverlayDrag.lastGraphY = current.y
    updateNodeToolbar()
  }

  const onUp = () => {
    groupOverlayDrag.active = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    scheduleHistoryPush()
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function pasteNodePayload(payload: Record<string, unknown>, offsetIndex = 0) {
  const g = graph.value
  if (!g) return null

  const source = g.getCellById(String(payload.id ?? ''))
  let node: Node
  if (source?.isNode()) {
    node = (source as Node).clone() as Node
    const clonedData = node.getData() as CanvasNodeData
    const { groupId: _groupId, ...clonedRest } = clonedData
    node.setData(clonedRest as CanvasNodeData)
    const pos = node.getPosition()
    node.position(pos.x + 32 + offsetIndex * 16, pos.y + 32 + offsetIndex * 16)
    g.addCell(node)
  } else {
    const { id: _removed, x, y, ...rest } = payload
    node = g.addNode({
      ...rest,
      x: (typeof x === 'number' ? x : 0) + 32 + offsetIndex * 16,
      y: (typeof y === 'number' ? y : 0) + 32 + offsetIndex * 16,
    })
  }

  return node
}

function pasteNode() {
  const g = graph.value
  const payload = nodeClipboard.value
  if (!g || !payload) return

  if (Array.isArray(payload)) {
    const newNodes = payload
      .map((item, index) => pasteNodePayload(item, index))
      .filter((node): node is Node => node != null)
    if (!newNodes.length) return
    selectGraphNodes(newNodes)
    syncNodeCount()
    scheduleHistoryPush()
    return
  }

  const node = pasteNodePayload(payload)
  if (!node) return

  const data = node.getData() as CanvasNodeData
  node.setData({ ...data, isSelected: true })

  selectGraphNodes(node)
  syncNodeCount()
  scheduleHistoryPush()
}

function getSelectedNode() {
  const g = graph.value
  const id = selectedNodeId.value
  if (!g || !id) return null
  const cell = g.getCellById(id)
  return cell?.isNode() ? (cell as Node) : null
}

function moveNodeLayer(step: 'front' | 'back' | 'forward' | 'backward') {
  const g = graph.value
  const node = getSelectedNode()
  if (!g || !node) return

  if (step === 'front') {
    node.toFront()
  } else if (step === 'back') {
    node.toBack()
  } else {
    const nodes = g
      .getNodes()
      .slice()
      .sort((a, b) => (a.getZIndex() ?? 0) - (b.getZIndex() ?? 0))
    const idx = nodes.findIndex((n) => n.id === node.id)
    const targetIdx = step === 'forward' ? idx + 1 : idx - 1
    const current = nodes[idx]
    const target = nodes[targetIdx]
    if (!current || !target || targetIdx < 0 || targetIdx >= nodes.length) return
    const zA = current.getZIndex() ?? 0
    const zB = target.getZIndex() ?? 0
    current.setZIndex(zB)
    target.setZIndex(zA)
  }
  scheduleHistoryPush()
}

function openImagePreview() {
  const node = getSelectedNode()
  if (!node) return
  const data = node.getData() as CanvasNodeData
  if (data.kind !== 'image' || !data.previewUrl) return
  imagePreviewUrl.value = data.previewUrl
}

function closeImagePreview() {
  imagePreviewUrl.value = ''
}

function cancelCurrentOperation() {
  return dismissOneCanvasLayer()
}

function triggerCanvasUploadShortcut() {
  addMenuDropPoint.value = getGraphCenter()
  openFileUploadPicker('image/*,video/*', 'any', true)
}

const { altVoiceTimer, bindKeyboard, unbindKeyboard, endSpacePan } = useCanvasKeyboard({
  graph,
  panMode,
  selectedNodeId,
  cancelCurrentOperation,
  zoomIn,
  zoomOut,
  zoomToScale,
  zoomFitToScreen,
  handleSaveCanvas,
  copySelectedNode,
  pasteNode,
  handleUndo,
  handleRedo,
  moveNodeLayer,
  openImageDialogue,
  getSelectedNode,
  removeSelectedNodes,
  removeSelectedEdge,
  hasSelectedNodes: () => getGraphSelectedNodeIds().length > 0 || Boolean(selectedNodeId.value),
  hasSelectedEdge: () => Boolean(selectedEdgeId.value),
  openImagePreview,
  triggerCanvasUploadShortcut,
  getScroller,
  setRubberbandEnabled,
})

function onScrollerScroll() {
  updateNodeToolbar()
  syncViewportNodeVisibility()
}

function bindScrollerScrollListener(g: Graph) {
  const scroller = getScroller(g)
  if (!scroller) return
  scrollerScrollTarget = scroller.container
  scrollerScrollTarget.addEventListener('scroll', onScrollerScroll, { passive: true })
}

function unbindScrollerScrollListener() {
  if (!scrollerScrollTarget) return
  scrollerScrollTarget.removeEventListener('scroll', onScrollerScroll)
  scrollerScrollTarget = null
}

onMounted(() => {
  if (!graphRef.value) return

  const instance = createGraph(graphRef.value) as CanvasGraph
  instance.__openConnectMenu = openConnectMenuByNodeId
  instance.__openImageDialogue = openImageDialogue
  instance.__deleteCanvasNode = removeNodeById
  instance.__requestTextExpand = openTextExpand
  instance.__onTextPickerAction = handleTextPickerAction
  instance.__onTextNodeEdgeLinked = handleNodeEdgeLinked
  instance.__onNodeEdgeLinked = handleNodeEdgeLinked
  instance.__notifyTextNodeUpdated = bumpToolbarRevision
  instance.__notifyNodeDragMove = updateNodeToolbar
  instance.__notifyNodeDragEnd = () => {
    updateNodeToolbar()
    scheduleHistoryPush()
  }
  instance.__textEditorRegistry = {
    register(nodeId: string, api: TextEditorApi) {
      textEditorApis.set(nodeId, api)
    },
    unregister(nodeId: string) {
      textEditorApis.delete(nodeId)
    },
    get(nodeId: string) {
      return textEditorApis.get(nodeId)
    },
  }
  graph.value = instance
  bindGraphInteraction(instance)
  bindScrollerScrollListener(instance)
  bindKeyboard()

  // 挂载即把全画布各层背景刷成当前主题色，避免拖拽到内容区外露出建图时的深色底（视图分层感）
  applyCanvasBgTheme(instance, canvasBgTheme.value, gridVisible.value)

  instance.on('blank:dblclick', handleBlankDblClick)
  instance.on('scale', ({ sx }) => {
    syncZoom(sx)
    requestAnimationFrame(() => {
      updateNodeToolbar()
      syncViewportNodeVisibility()
    })
  })
  instance.on('translate', () => {
    updateNodeToolbar()
    syncViewportNodeVisibility()
  })
  instance.on('node:moving', ({ node }) => {
    syncGroupedNodeMove(node)
    if (activeGroupSelection.value) {
      updateGroupToolbarPosition()
    }
    updateNodeToolbar()
  })
  instance.on('node:moved', () => {
    groupMoveState.anchorId = ''
    updateNodeToolbar()
    syncViewportNodeVisibility()
    scheduleHistoryPush()
  })
  instance.on('node:added', syncNodeCount)
  instance.on('node:removed', syncNodeCount)
  instance.on('node:click', handleNodeClick)
  instance.on('edge:click', handleEdgeClick)
  instance.on('selection:changed', () => {
    const g = graph.value
    if (!g) {
      syncSelectionFromGraph()
      return
    }

    const ids = getGraphSelectedNodeIds()
    const expanded = expandSelectionToGroup(g, ids)
    if (
      expanded.length > 1 &&
      (expanded.length !== ids.length || expanded.some((id, index) => id !== ids[index]))
    ) {
      selectGraphNodes(expanded)
      return
    }

    syncSelectionFromGraph()
    nextTick(() => {
      if (showGroupToolbar.value) {
        updateGroupToolbarPosition()
      } else if (showMultiSelectToolbar.value) {
        updateMultiSelectToolbarPosition()
      }
    })
  })
  instance.on('node:dblclick', ({ node }) => {
    const data = node.getData() as CanvasNodeData
    if (data.kind === 'image') {
      handleImageNodeDblClick({ node })
      return
    }
    if (data.kind === 'text' && data.mode === 'picker') {
      node.setData({ ...data, mode: 'editor', promptBarPinned: false })
      selectGraphNodes(node)
      bumpToolbarRevision()
    }
  })
  instance.on('blank:click', () => {
    dismissOneCanvasLayer()
  })
  instance.on('node:change:data', handleNodeDataChange)
  instance.on('edge:connected', handleEdgeConnected)

  canvasHistory = createCanvasHistory(getHistoryMeta)
  canvasHistory.seed(instance)
  syncHistoryState()

  const scroller = getScroller(instance)
  scroller?.togglePanning(panMode.value)
  setRubberbandEnabled(!panMode.value)

  syncZoom()
  syncNodeCount()

  nextTick(() => {
    syncAllNodeSizes(instance)
    refreshCanvasNodeViews(instance)
    ensureInfiniteCanvasArea(instance, { recenter: true })
    syncViewportNodeVisibility()
  })

  if (showMinimap.value) {
    nextTick(() => setupMinimap())
  }
})

function waitForNodeUploadDone(node: Node) {
  const data = node.getData() as CanvasNodeData
  if (data.uploadState === 'done' && data.previewUrl) {
    return Promise.resolve(node)
  }

  return new Promise<Node>((resolve) => {
    const handler = () => {
      const current = node.getData() as CanvasNodeData
      if (current.uploadState === 'done' && current.previewUrl) {
        node.off('change:data', handler)
        resolve(node)
      }
    }
    node.on('change:data', handler)
  })
}

function addImageFromFile(file: File, point?: { x: number; y: number }) {
  const g = graph.value
  if (!g) return Promise.resolve(null)

  const position = point ?? getGraphCenter()
  const node = addCanvasNode(g, 'image', position, {
    mode: 'editor',
    title: file.name,
    fileName: file.name,
  })

  runUploadSimulation(node, file)
  selectGraphNodes(node)
  syncNodeCount()
  scheduleHistoryPush()

  return waitForNodeUploadDone(node)
}

async function addImagesFromFiles(files: File[]) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'))
  if (!imageFiles.length) return []

  const basePoint = getGraphCenter()
  const nodes: Node[] = []

  for (let index = 0; index < imageFiles.length; index += 1) {
    const point = getMultiUploadSpawnPoint(basePoint, index, 'image')
    const node = await addImageFromFile(imageFiles[index], point)
    if (node) nodes.push(node)
  }

  return nodes
}

onBeforeUnmount(() => {
  unbindKeyboard()
  if (historyPushTimer) clearTimeout(historyPushTimer)
  if (altVoiceTimer.value) clearTimeout(altVoiceTimer.value)
  endSpacePan()
  canvasHistory = null
  unbindScrollerScrollListener()
  teardownMinimap()
  graph.value?.dispose()
  graph.value = null
})

const openNewProject = () => {
  api.createProject({ title: '新项目' }).then((_res: unknown) => {
    // router.push({ name: 'createOrEdit', params: { id: res.id } })
  })
}

const onLoadProjects = async () => {
  let params = {
    page: 1,
    pageSize: 10,
  }
  const res = await api.getProjects(params);
  console.log('res', res);
}

onMounted(()=>{
  onLoadProjects();
});

  return {
    emit,
    TEXT_EDITOR_PLACEHOLDER,
    activeGroupSelection,
    activeImageGenPromptNodeId,
    activePickerNodeId,
    activeProjectId,
    activeVideoGenPromptNodeId,
    addFromMenu,
    addImageDialogueSourceRef,
    addImageFromFile,
    addImagesFromFiles,
    addMenuDropPoint,
    addMenuPos,
    addNode,
    addPromptImageSourceRef,
    altVoiceTimer,
    applyIncomingImageSource,
    applyZoomAfterChange,
    assetsLoading,
    assetsTab,
    bindKeyboard,
    bindScrollerScrollListener,
    bottomLeftDockRef,
    bumpToolbarRevision,
    canRedo,
    canShowImageToolbar,
    canShowVideoToolbar,
    canSubmitTextPrompt,
    canUndo,
    cancelCurrentOperation,
    canvasBgTheme,
    canvasBgThemeLabel,
    canvasCredits,
    canvasFileDragDepth,
    canvasProjects,
    canvasRef,
    clearEdgeSelection,
    clearImageDialoguePreview,
    closeAddMenu,
    closeConnectMenu,
    closeHistoryPanel,
    closeImageCrop,
    closeImageGenPromptBar,
    closeImagePreview,
    closeImageToolbarMore,
    closeProjectMenu,
    closeShortcutsPanel,
    closeTextExpand,
    closeUserMenu,
    closeVideoGenPromptBar,
    closeVideoSubPanels,
    closeZoomMenu,
    connectMenuPos,
    connectReleasePoint,
    connectSourceNodeId,
    copySelectedNode,
    copySelectedNodes,
    cropSourceNodeId,
    currentProjectName,
    detachImageSourceFromDownstream,
    dialoguePos,
    dismissOneCanvasLayer,
    downloadSelectedTextNode,
    duplicateSelectedNodes,
    edgeDeleteBtnPos,
    elementSelectReturnNodeId,
    endSpacePan,
    enterElementSelectMode,
    exitElementSelectMode,
    fileInputAccept,
    fileInputComponentRef,
    fileInputMultiple,
    filterUploadFiles,
    finishConnectSpawn,
    generateImageFromPrompt,
    getActiveSelectedNodeIds,
    getEdgeReleasePoint,
    getGraphCenter,
    getGraphSelectedNodeIds,
    getHistoryMeta,
    getHorizontalUploadSpawnPoint,
    getMultiUploadSpawnPoint,
    getSelectedNode,
    getSelectedNodeData,
    getNodeCount: () => nodeCount.value,
    getVideoGenSourceLimit,
    goUserCenter,
    graph,
    graphRef,
    gridVisible,
    groupMoveState,
    groupOverlayBox,
    groupOverlayDrag,
    groupToolbarPos,
    handleApplyImageGenTask,
    handleBlankDblClick,
    handleEdgeClick,
    handleEdgeConnected,
    handleEdgeDeletePointerEnter,
    handleEdgeDeletePointerLeave,
    handleExportCanvas,
    handleGroupAddToToolbox,
    handleGroupBatchDownload,
    handleGroupExecute,
    handleGroupLayout,
    handleGroupToStoryboard,
    handleImageNodeDblClick,
    handleLogout,
    handleMergeStoryboardGroup,
    handleMultiSelectGroup,
    handleMultiSelectLayout,
    handleMultiSelectSaveToAssets,
    handleNodeClick,
    handleNodeDataChange,
    handleNodeEdgeLinked,
    handleOpenVideoGenPromptBar,
    handleRedo,
    handleSaveCanvas,
    handleTextPickerAction,
    handleTidyCanvas,
    handleUndo,
    handleUngroup,
    handleUserMenuAction,
    hasCanvasFileDrag,
    imageCropPos,
    imageCropSource,
    imageDialoguePreviewUrl,
    imageDialoguePreviews,
    imageDialogueText,
    imageGenPromptPos,
    imageGenPromptText,
    imageGenSeed,
    imageGenSourcePreviewUrl,
    imageGenSubmitting,
    imagePreviewUrl,
    isCanvasFileDragOver,
    isImageUploadFile,
    isImg2PromptTask,
    isLightNodeToolbar,
    isRecenteringToNodes,
    isVideoUploadFile,
    linkImageNodeToImageDialogue,
    linkImageNodeToVideoGen,
    linkImageSourceFromEdge,
    loadImageGenPromptFields,
    loadPromptBarContext,
    loadVideoGenPromptFields,
    modalStore,
    modelType,
    moveNodeLayer,
    multiSelectToolbarPos,
    nodeClipboard,
    nodeCount,
    nodeOverlaysRef,
    onCanvasDragEnter,
    onCanvasDragLeave,
    onCanvasDragOver,
    onCanvasFileDrop,
    onConnectMenuItem,
    onFileSelected,
    onGoHome,
    onGroupOverlayDragStart,
    onImageCropComplete,
    onImageDialogueAddCanvasNode,
    onImageDialogueUploadFiles,
    onImageToolbarAction,
    onLoadProjects,
    onMenuItem,
    onPromptAddCanvasNode,
    onPromptUploadFiles,
    onRemoveVideoSourceRef,
    onScrollerScroll,
    onTextExpandInput,
    onTextFormatAction,
    onVideoGenAddCanvasNode,
    onVideoGenPromptDragStart,
    onVideoGenQuickAction,
    onVideoGenUploadFiles,
    onVideoHdStart,
    onZoomMenuAction,
    openAddMenuAtGraphPoint,
    openAssetsPanel,
    openComboModal,
    openConnectMenu,
    openConnectMenuByNodeId,
    openFileUploadPicker,
    openImageCrop,
    openImageDialogue,
    openImageGenPromptBar,
    openImagePreview,
    openImageToolbarMore,
    openNewProject,
    openTextExpand,
    openVideoGenPromptBar,
    panMode,
    pasteNode,
    pasteNodePayload,
    pendingUploadFilter,
    pendingUploadNodeId,
    persistImageGenPrompt,
    persistPromptBarDraft,
    persistTextExpandContent,
    persistVideoGenPrompt,
    plainTextToEditorHtml,
    promptPos,
    promptSourceFileName,
    promptSourcePreviewUrl,
    promptSourcePreviews,
    promptSubmitting,
    promptText,
    recenterToNodes,
    refreshPromptSourcePreviews,
    removeConnectPreviewEdge,
    removeHoveredEdge,
    removeNodeById,
    removePromptImageSource,
    removeSelectedEdge,
    removeSelectedNodes,
    requestCanvasUpload,
    resetCanvasInteractionState,
    resetImageCrop,
    resetImageDialogue,
    resetImageToolbarMore,
    resetVideoDialogue,
    resetVideoFramesPanel,
    resetVideoHdPanel,
    returnFromElementSelect,
    router,
    scheduleHistoryPush,
    seedImageDialogueRefs,
    seedPromptImageRefs,
    selectGraphNodes,
    selectProject,
    selectedEdgeId,
    selectedKind,
    selectedNodeId,
    selectedNodeIds,
    setRubberbandEnabled,
    setupMinimap,
    showAddMenu,
    showAssetsPanel,
    showBackToNodesBanner,
    showConnectMenu,
    showEdgeDeleteButton,
    showElementSelectMode,
    showGroupToolbar,
    showHistoryPanel,
    showImageCreativeToolbar,
    showImageCrop,
    showImageDialogue,
    showImageGenPromptBar,
    showImageHdMenu,
    showImageToolbarMore,
    showImageToolbarMoreMenu,
    showMinimap,
    showMultiSelectToolbar,
    showNodeToolbar,
    showProjectMenu,
    showPromptBar,
    showShortcutsPanel,
    showTextFormatToolbar,
    showToolbarFeatureButtons,
    showUserMenu,
    showVideoDialogue,
    showVideoFramesPanel,
    showVideoGenPromptBar,
    showVideoHdPanel,
    showZoomMenu,
    spawnMediaFilesAtPoint,
    submitTextPrompt,
    syncConnectPreviewEdgeTarget,
    syncGroupedNodeMove,
    syncHistoryState,
    syncNodeCount,
    syncNodeSelectionHighlight,
    syncSelectionFromGraph,
    syncViewportNodeVisibility,
    syncZoom,
    teardownMinimap,
    textDownloadPos,
    textEditorApis,
    textExpandEditorComponentRef,
    textExpandNodeId,
    textExpandOpen,
    textExpandTitle,
    textFormatToolbarPos,
    toggleAddMenu,
    toggleAssetsPanel,
    toggleCanvasBgTheme,
    toggleGrid,
    toggleHistoryPanel,
    toggleImageAddToDialogMenu,
    toggleImageDialogue,
    toggleImageHdMenu,
    toggleImageToolbarMoreMenu,
    toggleMinimap,
    togglePanMode,
    toggleProjectMenu,
    toggleShortcutsPanel,
    toggleUserMenu,
    toggleVideoDialogue,
    toggleVideoFramesPanel,
    toggleVideoHdPanel,
    toggleZoomMenu,
    toolbarPos,
    toolbarRevision,
    triggerCanvasUploadShortcut,
    triggerFileInputClick,
    unbindKeyboard,
    unbindScrollerScrollListener,
    updateAddMenuPosition,
    updateConnectMenuPosition,
    updateGroupToolbarPosition,
    updateImageGenPromptBarPosition,
    updateMultiSelectToolbarPosition,
    updateNodeToolbar,
    updatePromptBarPosition,
    updateTextFormatToolbarPosition,
    updateVideoGenPromptBarPosition,
    uploadFileToCanvasNode,
    userMenuName,
    userMenuPoints,
    userMenuRole,
    videoDialogueText,
    videoGenActiveTab,
    videoGenPromptDragOffset,
    videoGenPromptPos,
    videoGenPromptText,
    videoGenSourceRefs,
    videoHdMagnification,
    videoHdPos,
    videoNum,
    waitForNodeUploadDone,
    zoomFitToScreen,
    zoomIn,
    zoomLevel,
    zoomOut,
    zoomPercent,
    zoomToScale,
  }
}
