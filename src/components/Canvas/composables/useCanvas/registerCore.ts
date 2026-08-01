import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'
import { message } from 'ant-design-vue'
import type { Edge, Graph, Node } from '@antv/x6'
import type { CanvasBindings } from './types'
import type { UploadFilter } from './state'
import { unpackBind } from './bindContext'
import { useUserInfo } from '@stores/useUserInfo';
import {
  clearCanvasAssetDrag,
  consumeCanvasAssetDragPayload,
  consumeCanvasElementGroupDragPayload,
  isCanvasAssetDragActive,
  setCanvasAssetDropHandler,
  wasCanvasAssetDropHandled,
} from '../../canvasAssetDrag'
import {
  ADD_NODE_GROUPS, CANVAS_ASSET_DRAG_TYPE, CANVAS_ELEMENT_GROUP_DRAG_TYPE, CANVAS_MAX_ZOOM, CANVAS_MIN_ZOOM, CONNECT_GENERATE_MENU,
  NODE_SPAWN_GAP_X, NODE_SPAWN_GAP_Y,
  ZOOM_MENU_PRESETS, IMG2PROMPT_DEFAULT_INSTRUCTION, applyImageGenTaskToNode, connectGenEdge,
  spawnCroppedImageNode, spawnErasedImageNode, spawnGenerationResultNode, spawnCompletedImageResultNode, spawnGridSplitResultNodes, spawnModel3DResultNode, spawnVideoGenerationResultNode, spawnTextPromptResultNode, canImageNodeAcceptIncoming, canOpenConnectMenu, createNodeFromConnectMenu, planOutgoingResultPoints,
  getConnectMenuPosition, resolveConnectSpawnPoint, getLinkedSpawnPoint, detachEdgeRelation, isPersistedEdge,
  syncEdgeSelectionHighlight, applyFlowEdgeStyle, getFlowEdgeAttrs, getPreviewEdgeAttrs, addCanvasNode, bindGraphInteraction, createGraph,
  ensureInfiniteCanvasArea, clientPointToGraphLocal, getViewportCenterLocal, getRandomViewportLocalPoint, hasVisibleNodesInViewport,
  centerGraphContent, getNodeCropOverlayPosition, getNodeDialoguePosition, getNodeImageGenPromptPosition,
  getNodeVideoGenPromptPosition, getNodePromptPosition, getNodeSidePanelPosition, getNodeTextDownloadPosition,
  getNodeTextFormatToolbarPosition, getGroupScreenBox, getMultiSelectionToolbarPosition, getNodeToolbarPosition,
  getNodeSize, getScroller, getEdgeDeleteButtonPosition, graphLocalToContainerOffset, refreshCanvasNodeViews, syncAllNodeSizes, syncNodeShapeFromData, getImageNodeMediaScreenBox, getImageExpandOverlayLayout, syncImageNodeSizeToMediaAspect, startImageNodeCornerResize,
  hydrateImageNodeDimensions, hydrateMissingImageNodeDimensions,
  applyCanvasBgTheme, getCanvasBgThemeMeta, layoutNodesInGroup, tidyCanvas, assignGroupId,
  expandSelectionToGroup, getCompleteGroupSelection, getNodesInGroup, mergeStoryboardGroup, normalizeGroupMembership, ungroupSelection,
  ensureImageTextEdge, syncTextNodeImageSource,
  createMinimap, destroyMinimap, applyRemoteImageToNode, applyRemoteVideoToNode, runUploadSimulation, uploadAssetFile, previewUrlToUploadFile, setCanvasUploadProjectId, setCanvasNodeMutationCompleteHandler, getCanvasSnapshot, saveCanvasSnapshotToStorage,
  normalizeCanvasSnapshot, applyCanvasSnapshot, createCanvasHistory, disconnectImageFromVideo, findImageToVideoEdge, findIncomingTextNodes, getVideoSourceRefs, getVideoTextSourceRefs, shouldOpenImageGenPromptBar, resolveVideoSourceRefsForNode, toPersistedVideoSourceRefs, plainTextFromNodeContent, VIDEO_GEN_TAB_IMAGE_RULES, isVideoGenerationFailedNode, findReusableVideoGenerationNode, resolveVideoGenerationSubmitContext, resetVideoGenerationNodeForRetry,
  useCanvasKeyboard, api, buildGroupSkillMarkdown, extractGroupSubgraph, parseElementGroupRecord,
} from './sharedImports';
import {
  normalizeOcrRecognizeResult,
  type ImageEditTextChange,
} from '../../editTextUtils'
import { addElementGroupRecordToCanvas } from '../../elementGroupCanvas'
import { downloadCanvasMedia } from '../../mediaDownload'
import {
  appendElementMarkToNode,
  appendImageMarkToNode,
  buildImageMarkItem,
  clientPointToImageNaturalCoords,
  parseImageMarkRecognizeResult,
  setImageMarkAnalyzing,
  isImageMarkAnalyzing,
  updateImageMarkLabelOnNode,
} from '../../imageMarkUtils'
import { toVideoApiPrompt } from '../../promptMention'
import {
  bindGenerationTaskId,
  followModelGenerationTaskOnNode,
  followTextGenerationTaskOnNode,
  isGenerationTaskTerminal,
  markGenerationNodeFailed,
  markTextGenerationNodeFailed,
  markVideoGenerationNodeFailed,
  normalizeGenerationTaskDetail,
  pickImageGenerationResults,
  pollGenerationTask,
  applyGenerationResultToNode,
  resetResumedGenerationTaskCache,
  recoverOrphanedGenerationTasks,
  resumePendingGenerationTasks,
  runImageGenerationOnNode,
  setGenerationTaskSucceededHandler,
  startImageGenerationOnNode,
  startVideoGenerationTaskFollow,
  resolveGenerationResultPreview,
  type GenerationTaskDetail,
  type GenerationTaskResult,
} from '../../generationTask'
import type { CanvasElementGroupDragPayload } from '../../constants'
import {
  resolveImageAssetId,
  resolveVideoAssetId,
  buildImageActionResultTitle,
  buildVideoActionResultTitle,
  IMAGE_GENERAL_CAPABILITY_CODE,
  VIDEO_GENERAL_CAPABILITY_CODE,
  resolveVideoToolbarUiKey,
  toVideoApiClarity,
  type VideoGenAspectRatio,
  type ImageToolbarClickPayload,
  type ImageToolbarClickEvent,
  type VideoToolbarClickPayload,
  type VideoToolbarClickEvent,
  type ImageDialogueSubmitPayload,
  type VideoDialogueSubmitPayload,
  type VideoGenPromptSubmitPayload,
  type VideoDialogueSettings,
  type VideoGenResolution,
  type VideoGenDuration,
  createDefaultImageDialogueSettings,
  createDefaultVideoDialogueSettings,
  isVideoNodeGenerating,
} from '../../constants'
import { splitImageIntoGrid, snapGridSplitNodePosition, areAllGridSplitResultNodes } from '../../gridSplitUtils'
import {
  loadImageToolbarCustomizeSettings,
  saveImageToolbarCustomizeSettings,
  type ImageToolbarCustomizeSettings,
} from '../../imageToolbarCustomize'
import {
  createSkillId,
  listSavedCanvasSkills,
  mergeCanvasSkill,
  saveCanvasSkill,
  type SavedCanvasSkill,
} from '../../skillStorage'
import type { AssetCenterItem } from '../../assetCenterData'
import type { GroupLayoutDirection, ImageResizeCorner } from './sharedImports'
import type { ProjectCanvasResponse } from '@/services/api'
import { isRequestError } from '@/utils/request'
import type { Project } from '@/stores/useProject'
import type {
  CanvasNodeData, ImageSourceRef, NodeKind, TextFormatCommand,
  ImageGenTask, ConnectMenuKey, CanvasGraph, CanvasSnapshot, TextEditorApi, UserMenuKey, CanvasAssetDragPayload,
} from './sharedImports'
// import { v4 as uuidv4 } from 'uuid';

export function registerCore(bind: CanvasBindings) {
  const {
    emit,
    canvasRef,
    graphRef,
    nodeOverlaysRef,
    fileInputRef,
    minimapContainerRef,
    textExpandEditorRef,
    modelType,
    promptSourcePreviewUrl,
    promptSourceFileName,
    promptSourcePreviews,
    promptSubmitting,
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
    assetsLoading,
    assetCenterLoading,
    assetCenterItems,
    promptText,
    activePickerNodeId,
    activeImageGenPromptNodeId,
    imageGenPromptText,
    imageGenSeed,
    imageGenSourcePreviewUrl,
    imageGenSourceTextPreview,
    imageGenSubmitting,
    activeVideoGenPromptNodeId,
    videoGenPromptText,
    videoGenActiveTab,
    videoGenAspectRatio,
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
    groupOverlayBox,
    showSaveSkillPopover,
    saveSkillPopoverPos,
    saveSkillItems,
    saveSkillSubmitting,
    dialoguePos,
    promptPos,
    imageGenPromptPos,
    videoGenPromptPos,
    videoGenPromptDragOffset,
    imageInpaintDragOffset,
    imageExpandDragOffset,
    showElementSelectMode,
    showVideoGenCanvasPickMode,
    showImageDialogueCanvasPickMode,
    elementSelectContext,
    elementSelectReturnNodeId,
    imageCropPos,
    imageResizeOverlay,
    showImageResizeOverlay,
    imageGridSplitPos,
    videoHdPos,
    selectedKind,
    showImageToolbarMore,
    showImageToolbarMoreMenu,
    showImageToolbarCustomize,
    imageToolbarCustomizeSettings,
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
    mentionInsertSerial,
    mentionInsertToken,
    imageDialogueSettings,
    videoDialogueText,
    videoDialogueSettings,
    videoHdMagnification,
    textFormatToolbarPos,
    textDownloadPos,
    textEditorToolbarActive,
    textExpandOpen,
    textExpandNodeId,
    textExpandTitle,
    toolbarRevision,
    router,
    modalStore,
    textEditorApis,
    groupOverlayDrag,
    groupMoveState,
  } = unpackBind(bind)
  const userInfoStore = useUserInfo();
  let canvasHistory: ReturnType<typeof createCanvasHistory> | null = null
  let historyPushTimer: ReturnType<typeof setTimeout> | null = null
  let activeImageDialogueNodeId = ''
  let activeVideoDialogueNodeId = ''
  let autoSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  let autoSaveEnabled = true
  let canvasContentReady = false
  let saveInFlight = false
  let pendingRemoteSaveType: 'MANUAL' | 'AUTO' | null = null
  let scrollerScrollTarget: HTMLElement | null = null
  let pendingProjectCanvas: ProjectCanvasResponse | null = null
  let videoToolbarDeferTimer: ReturnType<typeof setTimeout> | null = null
  const videoToolbarClickDeferred = ref(false)
  const imageMarkRecognizing = ref(false)
  const VIDEO_TOOLBAR_CLICK_DEFER_MS = 280

  function cancelVideoToolbarDefer() {
    if (videoToolbarDeferTimer) {
      clearTimeout(videoToolbarDeferTimer)
      videoToolbarDeferTimer = null
    }
    videoToolbarClickDeferred.value = false
  }

  function scheduleVideoToolbarDefer() {
    cancelVideoToolbarDefer()
    videoToolbarClickDeferred.value = true
    videoToolbarDeferTimer = setTimeout(() => {
      videoToolbarDeferTimer = null
      videoToolbarClickDeferred.value = false
      bumpToolbarRevision()
    }, VIDEO_TOOLBAR_CLICK_DEFER_MS)
  }

  function shouldDeferVideoToolbarOnClick(data: CanvasNodeData) {
    return data.kind === 'video' && !data.groupId
  }

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
    closeUserMenu()
    if (key === 'assets') {
      router.push({ name: 'userInfo' })
      return
    }
    if (key === 'UserAgreement' || key === 'PrivacyPolicy') {
      const { href } = router.resolve({ name: 'pdf', query: { type: key } })
      window.open(href, '_blank')
      return
    }
  }

  function handleLogout() {
    closeUserMenu()
    modalStore.openModal('login')
  }

  const zoomPercent = computed(() => `${Math.round(zoomLevel.value * 100)}%`)
  const currentProjectName = computed(
    () => canvasProjects.value.find((project) => project.id === activeProjectId.value)?.title ?? '未命名创作',
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

  const showGroupToolbar = computed(() => {
    if (imagePreviewUrl.value) return false
    const group = activeGroupSelection.value
    if (!group) return false
    const g = graph.value
    if (g && areAllGridSplitResultNodes(g, group.nodeIds)) return false
    return true
  })

  const showMultiSelectToolbar = computed(() => {
    if (selectedNodeIds.value.length < 2 || showGroupToolbar.value || imagePreviewUrl.value) {
      return false
    }
    const g = graph.value
    if (g && areAllGridSplitResultNodes(g, selectedNodeIds.value)) return false
    return true
  })

  const showPromptBar = computed(() => {
    if (showMultiSelectToolbar.value || showGroupToolbar.value) return false
    const id = activePickerNodeId.value
    if (!id || nodeCount.value === 0 || showImageCrop.value || showImageGridSplit.value || showImageErase.value || showImageInpaint.value || showImageExpand.value || showImageEditText.value) return false
    return true
  })
  const showImageGenPromptBar = computed(
    () =>
      !showMultiSelectToolbar.value &&
      !showGroupToolbar.value &&
      Boolean(activeImageGenPromptNodeId.value) &&
      nodeCount.value > 0 &&
      !showImageCrop.value &&
      !showImageGridSplit.value &&
      !showImageErase.value &&
      !showImageInpaint.value &&
      !showImageExpand.value &&
      !showImageEditText.value,
  )
  const showVideoGenPromptBar = computed(
    () => {
      if (
        showMultiSelectToolbar.value ||
        showGroupToolbar.value ||
        !activeVideoGenPromptNodeId.value ||
        nodeCount.value === 0 ||
        showImageCrop.value ||
        showImageGridSplit.value ||
        showImageErase.value ||
        showImageInpaint.value ||
        showImageExpand.value ||
        showImageEditText.value
      ) {
        return false
      }
      const g = graph.value
      const id = activeVideoGenPromptNodeId.value
      if (g && id) {
        const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined
        if (isVideoNodeGenerating(data)) return false
      }
      return true
    },
  )

  const showVideoDialoguePanel = computed(() => {
    if (!showVideoDialogue.value || selectedKind.value !== 'video') return false
    const g = graph.value
    const id = selectedNodeId.value
    if (!g || !id) return showVideoDialogue.value
    const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined
    if (isVideoNodeGenerating(data)) return false
    return true
  })

  const videoGenSourceRefs = computed(() => {
    void toolbarRevision.value
    const g = graph.value
    const id = activeVideoGenPromptNodeId.value
    if (!g || !id) return []

    const cell = g.getCellById(id)
    const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : undefined
    const imageRefs = resolveVideoSourceRefsForNode(
      g,
      id,
      data?.videoSourceRefs,
      isVideoGenerationFailedNode(data),
    )
    if (imageRefs.length) {
      return imageRefs.map((ref) => ({ ...ref, kind: ref.kind ?? 'image' }))
    }

    return getVideoTextSourceRefs(g, id, getTextNodePlainContent)
  })

  const imageGenSourceRefs = computed(() => {
    void toolbarRevision.value
    const g = graph.value
    const id = activeImageGenPromptNodeId.value
    if (!g || !id) return []

    const textRefs = getVideoTextSourceRefs(g, id, getTextNodePlainContent)
    if (textRefs.length) return textRefs

    const cell = g.getCellById(id)
    const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : undefined
    if (data?.sourcePreviewUrl) {
      return [{
        nodeId: data.sourceNodeId ?? '',
        kind: 'image' as const,
        previewUrl: data.sourcePreviewUrl,
        fileName: data.sourceFileName ?? '',
        title: data.title || '图片',
        index: 1,
      }]
    }
    return []
  })

  const videoGenSavedSettings = computed(() => {
    void toolbarRevision.value
    const g = graph.value
    const id = activeVideoGenPromptNodeId.value
    if (!g || !id) return undefined
    const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined
    return data?.videoDialogueSettings
  })

  const videoDialogueSourceRefs = computed(() => {
    void toolbarRevision.value
    const g = graph.value
    const id =
      showVideoDialogue.value && selectedKind.value === 'video' ? selectedNodeId.value : ''
    if (!g || !id) return []
    const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined
    // 对话框优先展示生成溯源快照
    return resolveVideoSourceRefsForNode(g, id, data?.videoSourceRefs, true)
  })

  /** 将当前连入图片快照写入视频节点，供对话框溯源与画布落库 */
  function syncVideoSourceRefsSnapshot(
    nodeId: string,
    options?: { force?: boolean },
  ) {
    const g = graph.value
    if (!g || !nodeId) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = { ...(cell.getData() as CanvasNodeData) }
    if (data.kind !== 'video') return

    const livePersisted = toPersistedVideoSourceRefs(getVideoSourceRefs(g, nodeId))
    const stored = Array.isArray(data.videoSourceRefs) ? data.videoSourceRefs : []

    if (options?.force) {
      data.videoSourceRefs = livePersisted
    } else if (!data.previewUrl || !stored.length) {
      // 未成片或尚无快照：以当前连线为准
      data.videoSourceRefs = livePersisted
    } else {
      // 已成片：合并追加新连线，不因画布删线收缩溯源
      const map = new Map(stored.map((item) => [item.nodeId, { ...item }]))
      for (const ref of livePersisted) {
        map.set(ref.nodeId, ref)
      }
      data.videoSourceRefs = Array.from(map.values())
    }

    cell.setData(data, { overwrite: true })
  }

  function buildVideoDialogueSettingsFromPayload(payload: {
    model: string
    ratio: string
    clarity: string
    duration: number
    generateAudio: boolean
    videoCount: number
    mode: VideoDialogueSettings['mode']
  }): VideoDialogueSettings {
    return {
      modelKey: payload.model,
      aspectRatio: payload.ratio as VideoGenAspectRatio,
      resolution: payload.clarity as VideoGenResolution,
      duration: payload.duration as VideoGenDuration,
      generateAudio: payload.generateAudio,
      videoCount: payload.videoCount,
      mode: payload.mode,
    }
  }

  /** 把本次生成的文案 / 参数 / 参考图写入节点，打开「对话」可溯源 */
  function applyVideoGenerationProvenance(
    node: Node,
    payload: {
      prompt: string
      model: string
      ratio: string
      clarity: string
      duration: number
      generateAudio: boolean
      videoCount: number
      mode: VideoDialogueSettings['mode']
    },
    sourceRefs?: ReturnType<typeof getVideoSourceRefs>,
  ) {
    const g = graph.value
    const data = { ...(node.getData() as CanvasNodeData) }
    const refs =
      sourceRefs ??
      (g ? getVideoSourceRefs(g, node.id) : [])
    const settings = buildVideoDialogueSettingsFromPayload(payload)
    data.genPrompt = payload.prompt
    data.videoDialogueText = payload.prompt
    data.videoDialogueSettings = { ...settings }
    data.videoSourceRefs = toPersistedVideoSourceRefs(refs)
    data.videoGenAspectRatio = payload.ratio
    node.setData(data, { overwrite: true })
  }

  function getActiveVideoTargetNodeId() {
    if (activeVideoGenPromptNodeId.value) return activeVideoGenPromptNodeId.value
    if (showVideoDialogue.value && selectedKind.value === 'video' && selectedNodeId.value) {
      return selectedNodeId.value
    }
    return ''
  }

  const showImageCreativeToolbar = computed(() => {
    void toolbarRevision.value
    if (!showElementSelectMode.value) return false
    if (selectedKind.value !== 'image' || !selectedNodeId.value) return false
    return canShowImageToolbar(getSelectedNodeData())
  })
  const showElementSelectBar = computed(() => {
    void toolbarRevision.value
    if (!showElementSelectMode.value) return false
    if (imageMarkRecognizing.value) return false
    const g = graph.value
    if (g && isImageMarkAnalyzing(g)) return false
    return true
  })
  const showTextFormatToolbar = computed(() => {
    void toolbarRevision.value
    if (showMultiSelectToolbar.value || showGroupToolbar.value) return false
    if (
      !selectedNodeId.value ||
      !textEditorToolbarActive.value ||
      showConnectMenu.value ||
      showPromptBar.value ||
      showImageCrop.value ||
      showImageGridSplit.value ||
      showImageErase.value ||
      showImageInpaint.value ||
      showImageExpand.value ||
      showImageEditText.value ||
      textExpandOpen.value
    ) {
      return false
    }
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
    return data?.textPickerTask === 'img2prompt' || modelType.value === 'img2prompt'
  })

  const isText2VideoTask = computed(() => {
    void toolbarRevision.value
    const id = activePickerNodeId.value
    if (!id) return false
    const data = graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
    return data?.textPickerTask === 'text2video' || modelType.value === 'text2video'
  })

  const isText2ImageTask = computed(() => {
    void toolbarRevision.value
    const id = activePickerNodeId.value
    if (!id) return false
    const data = graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
    return data?.textPickerTask === 'text2image' || modelType.value === 'text2image'
  })

  const promptSubmitLabel = computed(() => {
    if (isText2VideoTask.value || modelType.value === 'text2video') return '文生视频'
    if (isText2ImageTask.value || modelType.value === 'text2image') return '文生图'
    if (isImg2PromptTask.value || modelType.value === 'img2prompt') return '反推提示词'
    return '自由创作'
  })

  const canSubmitTextPrompt = computed(() => {
    const hasPrompt = Boolean(promptText.value.trim())
    if (isImg2PromptTask.value) {
      return Boolean(promptSourcePreviewUrl.value) && !promptSubmitting.value
    }
    if (isText2VideoTask.value || isText2ImageTask.value) {
      return hasPrompt
    }
    return hasPrompt && !promptSubmitting.value
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

  const imageGridSplitSource = computed(() => {
    const g = graph.value
    const id = gridSplitSourceNodeId.value || selectedNodeId.value
    if (!g || !id) return null
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return null
    const data = cell.getData() as CanvasNodeData
    if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return null
    return {
      previewUrl: data.previewUrl,
      mediaWidth: data.mediaWidth,
      mediaHeight: data.mediaHeight,
    }
  })

  const imageEraseSource = computed(() => {
    const g = graph.value
    const id = eraseSourceNodeId.value || selectedNodeId.value
    if (!g || !id) return null
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return null
    const data = cell.getData() as CanvasNodeData
    if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return null
    return {
      previewUrl: data.previewUrl,
      mediaWidth: data.mediaWidth,
      mediaHeight: data.mediaHeight,
    }
  })

  const imageInpaintSource = computed(() => {
    const g = graph.value
    const id = inpaintSourceNodeId.value || selectedNodeId.value
    if (!g || !id) return null
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return null
    const data = cell.getData() as CanvasNodeData
    if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return null
    return {
      previewUrl: data.previewUrl,
      mediaWidth: data.mediaWidth,
      mediaHeight: data.mediaHeight,
    }
  })

  const imageExpandSource = computed(() => {
    const g = graph.value
    const id = expandSourceNodeId.value || selectedNodeId.value
    if (!g || !id) return null
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return null
    const data = cell.getData() as CanvasNodeData
    if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight) return null
    return {
      previewUrl: data.previewUrl,
      mediaWidth: data.mediaWidth,
      mediaHeight: data.mediaHeight,
    }
  })

  function getImageDialoguePreviewsForNode(nodeId: string): ImageSourceRef[] {
    const g = graph.value
    const cell = g?.getCellById(nodeId)
    if (!cell?.isNode()) return []
    const data = cell.getData() as CanvasNodeData
    const refs = Array.isArray(data.imageSourceRefs)
      ? data.imageSourceRefs.filter((item) => item.previewUrl)
      : []
    if (refs.length) {
      return refs.map((item) => ({
        nodeId: item.nodeId,
        assetId: item.assetId,
        previewUrl: item.previewUrl,
        fileName: item.fileName ?? '',
      }))
    }
    const single = data.sourcePreviewUrl || ''
    if (single) {
      return [{
        nodeId: data.sourceNodeId ?? '',
        assetId: data.sourceAssetId,
        previewUrl: single,
        fileName: data.sourceFileName ?? '',
      }]
    }
    return []
  }

  const imageDialoguePreviews = computed<ImageSourceRef[]>(() => {
    void toolbarRevision.value
    const id = activeImageGenPromptNodeId.value
      || (showImageDialogue.value
        ? (activeImageDialogueNodeId || (selectedKind.value === 'image' ? selectedNodeId.value : ''))
        : selectedNodeId.value)
    if (!id) return []
    return getImageDialoguePreviewsForNode(id)
  })

  const imageDialoguePreviewUrl = computed(() => {
    void toolbarRevision.value
    const id = activeImageGenPromptNodeId.value
      || (showImageDialogue.value
        ? (activeImageDialogueNodeId || (selectedKind.value === 'image' ? selectedNodeId.value : ''))
        : selectedNodeId.value)
    if (!id) return ''
    const data = graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
    return data?.sourcePreviewUrl || data?.previewUrl || ''
  })

  const elementMarks = computed(() => {
    void toolbarRevision.value
    const returnId = elementSelectReturnNodeId.value
      || activeImageGenPromptNodeId.value
      || (showImageDialogue.value ? getActiveImageDialogueTargetNodeId() : '')
      || (showVideoGenPromptBar.value ? activeVideoGenPromptNodeId.value : '')
    if (!returnId) return []
    const data = graph.value?.getCellById(returnId)?.getData() as CanvasNodeData | undefined
    return Array.isArray(data?.elementMarks) ? data!.elementMarks! : []
  })

  const showNodeToolbar = computed(() => {
    void toolbarRevision.value
    if (videoToolbarClickDeferred.value) return false
    if (showVideoGenCanvasPickMode.value || showImageDialogueCanvasPickMode.value) return false
    if (showVideoDialogue.value && selectedKind.value === 'video') return false
    return (
      Boolean(selectedNodeId.value) &&
      selectedNodeIds.value.length <= 1 &&
      !showGroupToolbar.value &&
      !imagePreviewUrl.value
    )
  })

  function onGoHome() {
    router.push({ name: 'home' })
  }

  function getSelectedNodeData(): CanvasNodeData | undefined {
    const id = selectedNodeId.value
    if (!id) return undefined
    return graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined
  }

  async function ensureSelectedImageNodeDimensions(): Promise<CanvasNodeData | null> {
    const g = graph.value
    const id = selectedNodeId.value
    if (!g || !id) return null

    const cell = g.getCellById(id)
    if (!cell?.isNode()) return null

    const data = cell.getData() as CanvasNodeData
    if (!data.previewUrl?.trim()) return null
    if (data.mediaWidth > 0 && data.mediaHeight > 0) return data

    const hydrated = await hydrateImageNodeDimensions(cell as Node)
    if (!hydrated) return null

    bumpToolbarRevision()
    return cell.getData() as CanvasNodeData
  }

  async function ensureImageEditorReady(
    actionLabel: string,
    loadingText = '正在读取图片尺寸...',
  ): Promise<CanvasNodeData | null> {
    const data = getSelectedNodeData()
    if (!data?.previewUrl) {
      message.warning(`请等待图片加载完成后再${actionLabel}`)
      return null
    }

    const needsHydration = !(data.mediaWidth > 0 && data.mediaHeight > 0)
    const hideLoading = needsHydration ? message.loading(loadingText, 0) : null
    try {
      const ready = await Promise.race([
        ensureSelectedImageNodeDimensions(),
        new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 15_000)
        }),
      ])
      if (!ready?.mediaWidth || !ready?.mediaHeight) {
        message.warning(
          needsHydration
            ? `图片尺寸读取失败，请检查网络后重试`
            : `请等待图片加载完成后再${actionLabel}`,
        )
        return null
      }
      return ready
    } finally {
      hideLoading?.()
    }
  }

  function isNodeGenerating(data: CanvasNodeData | undefined) {
    if (!data) return false
    if (data.uploadState === 'uploading') return true
    if (data.imageGenState === 'loading') return true
    if (data.textGenState === 'loading') return true
    return false
  }

  function canShowImageToolbar(data: CanvasNodeData | undefined) {
    if (!data || data.kind !== 'image') return false
    if (isNodeGenerating(data)) return false
    if (data.imageGenTask === 'picker') return false
    if (data.imageGenTask === 'img2img' || data.imageGenTask === 'hd') return true
    return data.mode === 'editor'
  }

  function canShowVideoToolbar(data: CanvasNodeData | undefined) {
    if (!data || data.kind !== 'video') return false
    if (isNodeGenerating(data)) return false
    if (data.previewUrl) return true
    return data.mode === 'editor'
  }

  function bumpToolbarRevision() {
    toolbarRevision.value += 1
  }

  function setTextEditorToolbarActive(active: boolean) {
    if (textEditorToolbarActive.value === active) return
    textEditorToolbarActive.value = active
    bumpToolbarRevision()
  }

  const showToolbarFeatureButtons = computed(() => {
    void toolbarRevision.value

    if (showConnectMenu.value) return false

    const data = getSelectedNodeData()
    if (isNodeGenerating(data)) return false

    if (selectedKind.value === 'image' && selectedNodeId.value) {
      return canShowImageToolbar(data)
    }
    if (selectedKind.value === 'video' && selectedNodeId.value) {
      return canShowVideoToolbar(data)
    }
    return false
  })

  const isLightNodeToolbar = computed(
    () =>
      (selectedKind.value === 'image' || selectedKind.value === 'video') &&
      showToolbarFeatureButtons.value,
  )

  function openImageToolbarMore() {
    showImageToolbarMore.value = !showImageToolbarMore.value
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

  function onImageToolbarAction(payload: ImageToolbarClickPayload) {
    const data = getSelectedNodeData()
    const event: ImageToolbarClickEvent = {
      key: payload.key,
      option: payload.option,
      label: payload.label,
      assetId: resolveImageAssetId(data),
    }
    console.log('onImageToolbarAction', payload, event);

    if (event.key !== 'hd') {
      showImageHdMenu.value = false
    }
    if (event.key === 'chat') {
      toggleImageDialogue()
    } else if (event.key === 'IMAGE_CROP') {
      openImageCrop()
    } else if (event.key === 'IMAGE_REMOVE_BG') {
      if (event.option === 'erase') {
        handleImageEraseAction(event);
      } else {
        handleImageCapabilityAction(event);
      }
    } else if (event.key === 'more') {
      openImageToolbarMore()
    } else if (event.key === 'addToDialog') {
      toggleImageAddToDialogMenu()
    } else if (event.key === 'download') {
      handleImageDownloadAction(event)
    } else if (event.key === 'IMAGE_TO_3D') {
      void runImageTo3DTask(event)
    } else if (event.key === 'IMAGE_PROMPT_REVERSE') {
      handleImagePromptReverseAction(event)
    } else if (event.key === 'IMAGE_PREVIEW' || event.key === 'preview') {
      openImagePreview()
    } else if (event.key === 'IMAGE_GRID_SPLIT') {
      handleImageGridSplitAction(event)
    } else if (event.key === 'erase') {
      handleImageEraseAction(event)
    } else if (event.key === 'IMAGE_INPAINT') {
      handleImageInpaintAction(event)
    } else if (event.key === 'IMAGE_EDIT_TEXT') {
      handleImageEditTextAction(event)
    } else if (event.key === 'IMAGE_EXPAND') {
      handleImageExpandAction(event)
    } else if (event.key === 'IMAGE_CUSTOM' || event.key === 'customize') {
      handleImageCustomAction(event)
    } else {
      handleImageCapabilityAction(event)
    }
    // switch (event.key) {
    //   case 'chat':
    //     toggleImageDialogue()
    //     return
    //   case 'more':
    //     openImageToolbarMore()
    //     return
    //   case 'crop':
    //     openImageCrop()
    //     return
    //   case 'hd':
    //     if (event.option) {
    //       handleImageHdAction(event)
    //     } else {
    //       toggleImageHdMenu()
    //     }
    //     return
    //   case 'IMAGE_REMOVE_BG':
    //     // dropdown：必须选择 mode 后才执行
    //     if (!event.option) return
    //     handleImageCutoutAction(event)
    //     return
    //   case 'preview':
    //     openImagePreview()
    //     return
    //   case 'addToDialog':
    //     toggleImageAddToDialogMenu()
    //     return
    //   case 'download':
    //     handleImageDownloadAction(event)
    //     return
    //   case 'inpaint':
    //     handleImageInpaintAction(event)
    //     return
    //   default:
    //     break
    // }
  }

  const handleImageCustomAction = (_event: ImageToolbarClickEvent) => {
    void openImageCustom()
  }

  /**
   * 扩图
   */
  const handleImageExpandAction = (_event: ImageToolbarClickEvent) => {
    void openImageExpand()
  }

  /**
   * 图片编辑文字
   */
  const handleImageEditTextAction = (_event: ImageToolbarClickEvent) => {
    void openImageEditText()
  }

  async function openImageEditText() {
    const ready = await ensureImageEditorReady('进行文字编辑')
    if (!ready) return

    const data = getSelectedNodeData()
    const assetId = resolveImageAssetId(data)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageCrop()
    closeImageGridSplit()
    closeImageErase()
    closeImageInpaint()
    closeImageExpand()
    closeImageEditText()

    editTextSourceNodeId.value = selectedNodeId.value
    imageEditTextEntries.value = []
    imageEditTextRecognizing.value = true
    showImageEditText.value = true
    updateNodeToolbar()

    try {
      const result = await api.ocrRecognize({ assetId })
      imageEditTextEntries.value = normalizeOcrRecognizeResult(result)
      if (!imageEditTextEntries.value.length) {
        message.info('未识别到文字，可手动添加后应用')
      }
    } catch (error) {
      console.error('[image-edit-text] ocr failed', error)
      message.error('文字识别失败，请稍后重试')
      closeImageEditText()
    } finally {
      imageEditTextRecognizing.value = false
    }
  }

  function closeImageEditText() {
    showImageEditText.value = false
    editTextSourceNodeId.value = ''
    imageEditTextEntries.value = []
    imageEditTextRecognizing.value = false
    updateNodeToolbar()
  }

  function resetImageEditText() {
    showImageEditText.value = false
    editTextSourceNodeId.value = ''
    imageEditTextEntries.value = []
    imageEditTextRecognizing.value = false
  }

  function onImageEditTextApply(changes: ImageEditTextChange[]) {
    const g = graph.value
    const sourceNodeId = editTextSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageEditText()
      return
    }

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) {
      closeImageEditText()
      return
    }

    const sourceData = cell.getData() as CanvasNodeData
    const assetId = resolveImageAssetId(sourceData)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    if (!changes.length) {
      message.warning('请修改文字后再应用')
      return
    }

    closeImageEditText()
    selectedNodeId.value = sourceNodeId
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(sourceNodeId)

    const title = buildImageActionResultTitle('编辑文字')
    const sourceFileName = sourceData.fileName || sourceData.title || ''
    void runImageGenerationTask(
      {
        key: 'IMAGE_EDIT_TEXT',
        label: '编辑文字',
        assetId,
      },
      {
        capabilityCode: 'IMAGE_EDIT_TEXT',
        title,
        buildFileName: (name) => {
          const base = name || sourceFileName
          return base ? `编辑文字-${base}` : '编辑文字.png'
        },
        buildParameters: () => ({
          assetId,
          edits: changes.map((change) => ({
            originalText: change.originalText,
            text: change.text,
            editAction: change.editAction,
            ...(change.bbox
              ? {
                  x: change.bbox.x,
                  y: change.bbox.y,
                  width: change.bbox.width,
                  height: change.bbox.height,
                }
              : {}),
          })),
        }),
      },
    )
  }

  async function openImageCustom() {
    const ready = await ensureImageEditorReady('进行自定义')
    if (!ready) return

    showImageHdMenu.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    showImageToolbarCustomize.value = true
  }

  function closeImageToolbarCustomize() {
    showImageToolbarCustomize.value = false
  }

  async function saveImageToolbarCustomize(settings: ImageToolbarCustomizeSettings) {
    try {
      await api.updateToolbarPreferences({
        nodeType: 'IMAGE',
        orderedCodes: [...settings.orderedKeys],
        hiddenCodes: [],
      })
    } catch (error) {
      console.error('[Canvas] save toolbar preferences failed', error)
      message.error('工具栏偏好保存失败，请稍后重试')
      return
    }

    imageToolbarCustomizeSettings.value = {
      orderedKeys: [...settings.orderedKeys],
      showToolNames: settings.showToolNames,
    }
    saveImageToolbarCustomizeSettings(imageToolbarCustomizeSettings.value)
    closeImageToolbarCustomize()
    bumpToolbarRevision()
    emit('toolbar-preferences-saved', { nodeType: 'IMAGE' })
  }

  function resetImageToolbarCustomize() {
    imageToolbarCustomizeSettings.value = loadImageToolbarCustomizeSettings()
    bumpToolbarRevision()
  }

  async function openImageExpand() {
    const ready = await ensureImageEditorReady('进行扩图')
    if (!ready) return

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageCrop()
    closeImageGridSplit()
    closeImageErase()
    closeImageInpaint()
    closeImageEditText()

    expandSourceNodeId.value = selectedNodeId.value
    showImageExpand.value = true
    updateNodeToolbar()
  }

  function closeImageExpand() {
    showImageExpand.value = false
    expandSourceNodeId.value = ''
    updateNodeToolbar()
  }

  function resetImageExpand() {
    showImageExpand.value = false
    expandSourceNodeId.value = ''
  }

  function onImageExpandComplete(payload: {
    expandDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'ALL'
    expandRatio: number
  }) {
    const g = graph.value
    const sourceNodeId = expandSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageExpand()
      return
    }

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) {
      closeImageExpand()
      return
    }

    const sourceData = cell.getData() as CanvasNodeData
    const assetId = resolveImageAssetId(sourceData)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    closeImageExpand()
    selectedNodeId.value = sourceNodeId
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(sourceNodeId)

    const title = buildImageActionResultTitle('扩图')
    const sourceFileName = sourceData.fileName || sourceData.title || ''
    void runImageGenerationTask(
      {
        key: 'IMAGE_EXPAND',
        label: '扩图',
        assetId,
      },
      {
        capabilityCode: 'IMAGE_EXPAND',
        title,
        buildFileName: (name) => {
          const base = name || sourceFileName
          return base ? `扩图-${base}` : '扩图.png'
        },
        buildParameters: () => ({
          assetId,
          expandDirection: payload.expandDirection,
          expandRatio: payload.expandRatio,
        }),
      },
    )
  }

  /** 视频节点工具栏点击（与图片工具栏平行，逻辑独立） */
  function onVideoToolbarAction(payload: VideoToolbarClickPayload) {
    const data = getSelectedNodeData()
    const event: VideoToolbarClickEvent = {
      key: payload.key,
      option: payload.option,
      label: payload.label,
      assetId: resolveVideoAssetId(data),
    }
    const uiKey = resolveVideoToolbarUiKey(event.key)

    if (event.key === 'chat') {
      toggleVideoDialogue()
      return
    }
    if (event.key === 'addToDialog') {
      addVideoToDialog()
      return
    }
    if (event.key === 'download') {
      handleVideoDownloadAction(event)
      return
    }
    if (uiKey === 'hd' || event.key === 'VIDEO_HD') {
      // 工具栏点击只打开高清面板；真正开任务由面板「开始高清」触发（带 magnification）
      if (event.option) {
        handleVideoCapabilityAction({
          ...event,
          key: 'VIDEO_HD',
          label: event.label || '高清补帧',
        })
      } else {
        toggleVideoHdPanel()
      }
      return
    }
    if (uiKey === 'frames' || event.key.includes('FRAME')) {
      toggleVideoFramesPanel()
      return
    }

    handleVideoCapabilityAction(event)
  }

  function handleVideoCapabilityAction(event: VideoToolbarClickEvent) {
    const title = buildVideoActionResultTitle(event.label)
    const namePrefix = event.label?.trim() || '视频处理'
    void runVideoGenerationTask(event, {
      capabilityCode: event.key,
      title,
      buildFileName: (sourceFileName) =>
        sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.mp4`,
      buildParameters: (ctx) => {
        const params: Record<string, unknown> = {
          assetId: ctx.assetId,
        }
        if (ctx.key === 'VIDEO_HD' && ctx.option) {
          params.magnification = ctx.option
        } else if (ctx.option) {
          params.mode = ctx.option
        }
        return params
      },
    })
  }

  async function runVideoGenerationTask(
    event: VideoToolbarClickEvent,
    config: {
      capabilityCode: string
      title: string
      prompt?: string
      requireAssetId?: boolean
      requireSourcePreview?: boolean
      buildFileName: (sourceFileName: string) => string
      buildParameters: (event: VideoToolbarClickEvent) => Record<string, unknown>
      resolveReferenceAssetIds?: (event: VideoToolbarClickEvent) => string[]
    },
  ) {
    const requireAssetId = config.requireAssetId !== false
    if (requireAssetId && !event.assetId) {
      message.warning('视频素材 ID 不存在，请等待上传完成')
      return
    }

    const g = graph.value
    const sourceNodeId = selectedNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (sourceData.kind !== 'video') return

    const requireSourcePreview = config.requireSourcePreview !== false
    if (requireSourcePreview && !sourceData.previewUrl) return
    if (sourceData.uploadState === 'uploading') {
      message.warning('视频上传中，请稍后再试')
      return
    }

    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()

    const sourceFileName = sourceData.fileName || sourceData.title || ''
    const taskParameters = config.buildParameters(event)
    const referenceAssetIds =
      config.resolveReferenceAssetIds?.(event) ??
      (event.assetId ? [event.assetId] : [])

    const prompt = config.prompt?.trim() ?? ''
    const liveSourceRefs = getVideoSourceRefs(g, sourceNodeId)
    syncVideoSourceRefsSnapshot(sourceNodeId)

    // 调用方（对话框/能力条）应已写入溯源；此处补齐文案与参考图快照后复制到结果节点
    const midData = { ...(sourceNode.getData() as CanvasNodeData) }
    if (prompt && !midData.videoDialogueText?.trim()) {
      midData.videoDialogueText = prompt
      midData.genPrompt = prompt
    }
    if (prompt && !midData.genPrompt?.trim()) {
      midData.genPrompt = prompt
    }
    midData.videoSourceRefs = toPersistedVideoSourceRefs(liveSourceRefs)
    sourceNode.setData(midData, { overwrite: true })

    const refreshedSource = sourceNode.getData() as CanvasNodeData
    const requestedCount = Math.max(1, Math.floor(Number(taskParameters.videoCount)) || 1)
    const singleTaskParameters = { ...taskParameters, videoCount: 1 }
    const buildIndexedFileName = (index: number) =>
      resolveGenerationResultFileName(
        config.buildFileName,
        sourceFileName,
        index,
        requestedCount,
      )

    const connectRefsToVideoNode = (node: Node) => {
      for (const ref of liveSourceRefs) {
        if (!findImageToVideoEdge(g, ref.nodeId, node.id)) {
          connectGenEdge(g, ref.nodeId, node.id)
        }
      }
    }

    const resultNodes: Node[] = []
    const reusableNode = requestedCount === 1 ? findReusableVideoGenerationNode(g, sourceNode) : null

    if (reusableNode) {
      resultNodes.push(reusableNode)
      resetVideoGenerationNodeForRetry(reusableNode, {
        title: config.title,
        fileName: buildIndexedFileName(0),
        prompt,
      })
      const retryData = { ...(reusableNode.getData() as CanvasNodeData) }
      retryData.videoDialogueText = refreshedSource.videoDialogueText || prompt
      retryData.genPrompt = refreshedSource.genPrompt || prompt
      retryData.videoDialogueSettings = refreshedSource.videoDialogueSettings
        ? { ...refreshedSource.videoDialogueSettings }
        : retryData.videoDialogueSettings
      retryData.videoSourceRefs = refreshedSource.videoSourceRefs?.length
        ? refreshedSource.videoSourceRefs.map((item) => ({ ...item }))
        : toPersistedVideoSourceRefs(liveSourceRefs)
      reusableNode.setData(retryData, { overwrite: true })
      connectRefsToVideoNode(reusableNode)
    } else {
      const layoutSize = resolveVideoResultLayoutSize(refreshedSource)
      const plannedPoints = planOutgoingResultPoints(
        g,
        sourceNode,
        layoutSize,
        requestedCount,
        'right',
      )

      for (let index = 0; index < requestedCount; index += 1) {
        const resultNode = spawnVideoGenerationResultNode(g, sourceNode, {
          title: config.title,
          fileName: buildIndexedFileName(index),
          videoDialogueText: refreshedSource.videoDialogueText || prompt,
          videoDialogueSettings: refreshedSource.videoDialogueSettings,
          videoSourceRefs: refreshedSource.videoSourceRefs,
          genPrompt: refreshedSource.genPrompt || prompt,
          centerPoint: plannedPoints[index],
        })
        connectRefsToVideoNode(resultNode)
        resultNodes.push(resultNode)
      }
    }

    const primaryNode = resultNodes[0]
    selectedNodeId.value = primaryNode.id
    selectedKind.value = 'video'
    syncNodeSelectionHighlight(primaryNode.id)
    syncNodeCount()
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()

    void Promise.all(
      resultNodes.map(async (resultNode, index) => {
        const nodeFileName = buildIndexedFileName(index)
        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `video-cap-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

        try {
          const created = normalizeGenerationTaskDetail(
            await api.createGenerationTask<GenerationTaskDetail>(
              {
                taskType: 'VIDEO',
                capabilityCode: config.capabilityCode,
                prompt: toVideoApiPrompt(config.prompt?.trim() ?? ''),
                parameters: singleTaskParameters,
                projectId: activeProjectId.value,
                nodeId: resultNode.id,
                referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
              },
              idempotencyKey,
            ),
          )

          const taskId = created.id
          if (!taskId) {
            throw new Error(`创建${config.title}任务失败`)
          }
          userInfoStore.queryPointAccount()
          bindGenerationTaskId(resultNode, taskId, 'VIDEO')
          persistGenerationTaskBinding()

          startVideoGenerationTaskFollow(resultNode, taskId, {
            title: config.title,
            fileName: nodeFileName,
            onError: (reason) => message.error(reason),
            onComplete: (success) => handleVideoGenerationTaskComplete(resultNode.id, success),
          })
        } catch (error) {
          markVideoGenerationNodeFailed(resultNode)
          revealVideoDialogueAfterGenerationFailure(resultNode.id)
          message.error(isRequestError(error) ? error.message : `${config.title}失败，请稍后重试`)
        }
      }),
    )
  }

  function handleVideoDownloadAction(event: VideoToolbarClickEvent) {
    void event.assetId
    const data = getSelectedNodeData()
    const url = data?.previewUrl
    if (!url) {
      message.warning('视频尚未生成完成，无法下载')
      return
    }
    void downloadCanvasMedia({
      url,
      fallbackName: 'video.mp4',
    }).catch((error) => {
      message.error(isRequestError(error) ? error.message : '视频下载失败，请稍后重试')
    })
  }

  function handleImageGridSplitAction(_event: ImageToolbarClickEvent) {
    void openImageGridSplit()
  }

  async function openImageGridSplit(rows = 2, cols = 2) {
    const ready = await ensureImageEditorReady('拆分')
    if (!ready) return

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageCrop()
    closeImageErase()
    closeImageInpaint()
    closeImageExpand()
    closeImageEditText()

    gridSplitSourceNodeId.value = selectedNodeId.value
    gridSplitRows.value = rows
    gridSplitCols.value = cols
    showImageGridSplit.value = true
    updateNodeToolbar()
  }

  function closeImageGridSplit() {
    showImageGridSplit.value = false
    gridSplitSourceNodeId.value = ''
    updateNodeToolbar()
  }

  function resetImageGridSplit() {
    showImageGridSplit.value = false
    gridSplitSourceNodeId.value = ''
  }

  async function onImageGridSplitComplete(payload: {
    rows: number
    cols: number
    rowStops: number[]
    colStops: number[]
  }) {
    const g = graph.value
    const sourceNodeId = gridSplitSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageGridSplit()
      return
    }

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) {
      closeImageGridSplit()
      return
    }

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (!sourceData.previewUrl) {
      closeImageGridSplit()
      return
    }

    const hide = message.loading(`正在拆分为 ${payload.rows}×${payload.cols} 宫格...`, 0)
    try {
      const tiles = await splitImageIntoGrid(sourceData.previewUrl, payload.rows, payload.cols, {
        rowStops: payload.rowStops,
        colStops: payload.colStops,
      }, {
        width: sourceData.mediaWidth ?? 0,
        height: sourceData.mediaHeight ?? 0,
      })
      if (!tiles.length) {
        message.warning('拆分结果为空')
        return
      }

      // 先用前端合成图拉出节点，再后台无感上传 OSS
      const nodes = spawnGridSplitResultNodes(g, sourceNode, tiles, {
        titlePrefix: '宫格',
        rows: payload.rows,
        cols: payload.cols,
        rowStops: payload.rowStops,
        colStops: payload.colStops,
      })

      closeImageGridSplit()

      selectedNodeId.value = ''
      selectedNodeIds.value = []
      selectedKind.value = null
      syncNodeSelectionHighlight([])
      g.cleanSelection()
      syncNodeCount()
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()

      nextTick(() => {
        const scroller = getScroller(g)
        if (!scroller || !nodes.length) return
        const boxes = nodes.map((node) => node.getBBox())
        const minX = Math.min(...boxes.map((box) => box.x))
        const minY = Math.min(...boxes.map((box) => box.y))
        const maxX = Math.max(...boxes.map((box) => box.x + box.width))
        const maxY = Math.max(...boxes.map((box) => box.y + box.height))
        scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, { duration: '280ms' })
      })

      void uploadGridSplitImagesInBackground(nodes)
    } catch (error) {
      console.error('[grid-split] failed', error)
      message.error(error instanceof Error ? error.message : '宫格拆分失败，请稍后重试')
    } finally {
      hide()
    }
  }

  async function uploadGridSplitImagesInBackground(nodes: Node[]) {
    const uploads = nodes.map(async (node) => {
      const data = node.getData() as CanvasNodeData
      if (data.assetId) return

      const previewUrl = data.previewUrl?.trim()
      if (!previewUrl) return

      await uploadLocalImageNodeInBackground(node, previewUrl, data.fileName || '宫格.png', {
        width: data.mediaWidth ?? 0,
        height: data.mediaHeight ?? 0,
        preserveTitle: true,
        silent: true,
      })
    })

    await Promise.allSettled(uploads)
    scheduleHistoryPush()
  }

  function handleImagePromptReverseAction(event: ImageToolbarClickEvent) {
    void runImagePromptReverseTask(event)
  }

  async function runImagePromptReverseTask(event: ImageToolbarClickEvent) {
    if (!event.assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    const g = graph.value
    const sourceNodeId = selectedNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (!sourceData.previewUrl || sourceData.uploadState === 'uploading') return

    // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
    //   message.info('当前图片已有进行中的生成任务')
    //   return
    // }

    const title = buildImageActionResultTitle(event.label || '图片反推提示词')
    const resultNode = spawnTextPromptResultNode(g, sourceNode, { title })

    selectedNodeId.value = resultNode.id
    selectedKind.value = 'text'
    syncNodeSelectionHighlight(resultNode.id)
    syncNodeCount()
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `prompt-reverse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const created = normalizeGenerationTaskDetail(
        await api.createGenerationTask<GenerationTaskDetail>(
          {
            taskType: 'TEXT',
            capabilityCode: 'IMAGE_PROMPT_REVERSE',
            prompt: '',
            parameters: {
              assetId: event.assetId,
              prompt: promptText.value.trim(),
            },
            projectId: activeProjectId.value,
            nodeId: resultNode.id,
            referenceAssetIds: [event.assetId],
          },
          idempotencyKey,
        ),
      )

      const taskId = created.id
      if (!taskId) {
        throw new Error('创建反推提示词任务失败')
      }
      userInfoStore.queryPointAccount();
      bindGenerationTaskId(resultNode, taskId, 'TEXT')
      persistGenerationTaskBinding()

      const succeeded = await followTextGenerationTaskOnNode(resultNode, taskId, {
        title,
        toHtml: plainTextToEditorHtml,
        onError: (reason) => message.error(reason),
      })

      if (!succeeded) return

      selectedNodeId.value = resultNode.id
      selectedKind.value = 'text'
      syncNodeSelectionHighlight(resultNode.id)
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()

      nextTick(() => {
        const scroller = getScroller(g)
        const bbox = resultNode.getBBox()
        scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
          duration: '280ms',
        })
      })
    } catch (error) {
      markTextGenerationNodeFailed(resultNode)
      message.error(isRequestError(error) ? error.message : '反推提示词失败，请稍后重试')
    }
  }

  async function runImageTo3DTask(event: ImageToolbarClickEvent) {
    if (!event.assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    const g = graph.value
    const sourceNodeId = selectedNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (!sourceData.previewUrl || sourceData.uploadState === 'uploading') return

    // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
    //   message.info('当前图片已有进行中的生成任务')
    //   return
    // }

    const title = buildImageActionResultTitle(event.label || '图片转3D')
    const resultNode = spawnModel3DResultNode(g, sourceNode, {
      title,
      fileName: `${event.label?.trim() || '图片转3D'}.glb`,
    })

    selectedNodeId.value = resultNode.id
    selectedKind.value = 'model3d'
    syncNodeSelectionHighlight(resultNode.id)
    syncNodeCount()
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `model3d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const created = normalizeGenerationTaskDetail(
        await api.createGenerationTask<GenerationTaskDetail>(
          {
            taskType: 'MODEL',
            capabilityCode: 'IMAGE_TO_3D',
            prompt: '',
            parameters: {
              assetId: event.assetId,
            },
            projectId: activeProjectId.value,
            nodeId: resultNode.id,
            referenceAssetIds: [event.assetId],
          },
          idempotencyKey,
        ),
      )

      const taskId = created.id
      if (!taskId) {
        throw new Error('创建 3D 生成任务失败')
      }
      userInfoStore.queryPointAccount();
      bindGenerationTaskId(resultNode, taskId, 'MODEL')
      persistGenerationTaskBinding()

      const succeeded = await followModelGenerationTaskOnNode(resultNode, taskId, {
        title,
        onError: (reason) => message.error(reason),
      })

      if (!succeeded) return

      selectedNodeId.value = resultNode.id
      selectedKind.value = 'model3d'
      syncNodeSelectionHighlight(resultNode.id)
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()

      nextTick(() => {
        const scroller = getScroller(g)
        const bbox = resultNode.getBBox()
        scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
          duration: '280ms',
        })
      })
    } catch (error) {
      markGenerationNodeFailed(resultNode)
      message.error(isRequestError(error) ? error.message : '3D 生成失败，请稍后重试')
    }
  }

  /**
   * 擦除
   * @param event 
   */
  function handleImageEraseAction(_event: ImageToolbarClickEvent) {
    void openImageErase()
  }

  /**
   * 局部修改
   * @param _event 
   */
  function handleImageInpaintAction(_event: ImageToolbarClickEvent) {
    void openImageInpaint()
  }

  async function openImageInpaint() {
    const ready = await ensureImageEditorReady('进行局部修改')
    if (!ready) return

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageCrop()
    closeImageGridSplit()
    closeImageErase()
    closeImageExpand()
    closeImageEditText()

    inpaintSourceNodeId.value = selectedNodeId.value
    imageInpaintDragOffset.value = { x: 0, y: 0 }
    showImageInpaint.value = true
    updateNodeToolbar()
  }

  function closeImageInpaint() {
    showImageInpaint.value = false
    inpaintSourceNodeId.value = ''
    updateNodeToolbar()
  }

  async function dataUrlToFile(dataUrl: string, fileName: string) {
    return previewUrlToUploadFile(dataUrl, fileName)
  }

  async function onImageInpaintComplete(payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
    settle?: () => void
  }) {
    await handleImageInpaintSubmit(payload)
  }

  function handleImageInpaintCapabilityAction(
    event: ImageToolbarClickEvent,
    options: {
      prompt: string
      maskAssetId: string
    },
  ) {
    const title = buildImageActionResultTitle(event.label || '局部修改')
    const namePrefix = event.label?.trim() || '局部修改'
    void runImageGenerationTask(event, {
      capabilityCode: 'IMAGE_INPAINT',
      title,
      prompt: options.prompt,
      buildFileName: (sourceFileName) =>
        sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.png`,
      buildParameters: (ctx) => ({
        assetId: ctx.assetId,
        maskAssetId: options.maskAssetId,
      }),
      resolveReferenceAssetIds: () => [event.assetId, options.maskAssetId].filter(Boolean),
    })
  }

  async function handleImageInpaintSubmit(payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
    settle?: () => void
  }) {
    const settle = () => payload.settle?.()
    const g = graph.value
    const sourceNodeId = inpaintSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageInpaint()
      settle()
      return
    }

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) {
      closeImageInpaint()
      settle()
      return
    }

    const sourceData = cell.getData() as CanvasNodeData
    const assetId = resolveImageAssetId(sourceData)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      settle()
      return
    }

    const hideLoading = message.loading('正在上传遮罩并提交任务...', 0)
    try {
      const maskFile = await dataUrlToFile(payload.mask.dataUrl, 'inpaint-mask.png')
      const maskUpload = await uploadAssetFile(maskFile, { projectId: activeProjectId.value })
      if (!maskUpload.assetId) {
        throw new Error('遮罩上传失败')
      }

      closeImageInpaint()

      selectedNodeId.value = sourceNodeId
      selectedKind.value = 'image'
      syncNodeSelectionHighlight(sourceNodeId)

      handleImageInpaintCapabilityAction(
        {
          key: 'IMAGE_INPAINT',
          label: '局部修改',
          assetId,
        },
        {
          prompt: payload.prompt,
          maskAssetId: maskUpload.assetId,
        },
      )
    } catch (error) {
      message.error(error instanceof Error ? error.message : '局部修改提交失败，请稍后重试')
    } finally {
      hideLoading()
      settle()
    }
  }

  async function openImageErase() {
    const ready = await ensureImageEditorReady('擦除')
    if (!ready) return

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageCrop()
    closeImageGridSplit()
    closeImageInpaint()
    closeImageExpand()
    closeImageEditText()

    eraseSourceNodeId.value = selectedNodeId.value
    showImageErase.value = true
    updateNodeToolbar()
  }

  function closeImageErase() {
    showImageErase.value = false
    eraseSourceNodeId.value = ''
    updateNodeToolbar()
  }

  function focusErasedResultNode(g: Graph, erasedNode: Node) {
    selectedNodeId.value = erasedNode.id
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(erasedNode.id)
    syncNodeCount()
    scheduleHistoryPush()

    nextTick(() => {
      const scroller = getScroller(g)
      const bbox = erasedNode.getBBox()
      scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
        duration: '280ms',
      })
      updateNodeToolbar()
    })
  }

  async function uploadLocalImageNodeInBackground(
    node: Node,
    localPreviewUrl: string,
    fileName: string,
    payload: { width: number; height: number; preserveTitle?: boolean; silent?: boolean },
  ) {
    try {
      const file = await previewUrlToUploadFile(localPreviewUrl, fileName, {
        width: payload.width,
        height: payload.height,
      })
      const upload = await uploadAssetFile(file, { projectId: activeProjectId.value })
      if (!upload.url || !upload.assetId) return

      const g = graph.value
      if (!g?.getCellById(node.id)) return

      const current = { ...(node.getData() as CanvasNodeData) }
      if (current.previewUrl !== localPreviewUrl) return

      const remoteUrl = upload.url
      if (payload.silent) {
        await new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('remote image preload failed'))
          img.src = remoteUrl
        })
      }

      const refreshed = { ...(node.getData() as CanvasNodeData) }
      if (refreshed.previewUrl !== localPreviewUrl) return

      const prevTitle = refreshed.title
      refreshed.assetId = upload.assetId
      refreshed.previewUrl = remoteUrl
      refreshed.uploadState = 'done'
      refreshed.uploadProgress = 100
      refreshed.fileName = fileName || refreshed.fileName
      refreshed.mediaWidth = upload.width ?? payload.width
      refreshed.mediaHeight = upload.height ?? payload.height
      if (payload.preserveTitle && prevTitle) {
        refreshed.title = prevTitle
      }
      node.setData(refreshed)

      if (!payload.silent) {
        syncNodeShapeFromData(node)
        const size = getNodeSize(refreshed.kind, refreshed.mode, refreshed)
        node.resize(size.width, size.height)
      }

      if (localPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    } catch (error) {
      console.error('[Canvas] local image background upload failed', error)
    }
  }

  async function onImageEraseComplete(payload: { dataUrl: string; width: number; height: number }) {
    const g = graph.value
    const sourceNodeId = eraseSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageErase()
      return
    }

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) {
      closeImageErase()
      return
    }

    const sourceNode = cell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    const fileName = sourceData.fileName ? `擦除-${sourceData.fileName}` : '擦除.png'
    const localPreviewUrl = payload.dataUrl

    closeImageErase()

    const erasedNode = spawnErasedImageNode(g, sourceNode, payload)
    focusErasedResultNode(g, erasedNode)

    void uploadLocalImageNodeInBackground(erasedNode, localPreviewUrl, fileName, payload).then(() => {
      scheduleHistoryPush()
    })
  }

  function handleImageCapabilityAction(event: ImageToolbarClickEvent) {
    const title = buildImageActionResultTitle(event.label)
    const namePrefix = event.label?.trim() || '生成'
    void runImageGenerationTask(event, {
      capabilityCode: event.key,
      title,
      buildFileName: (sourceFileName) =>
        sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.png`,
      buildParameters: (ctx) => {
        const params: Record<string, unknown> = {
          assetId: ctx.assetId,
        }
        if (ctx.option) {
          params.mode = normalizeCutoutMode(ctx.option)
        }
        return params
      },
    })
  }

  async function handleImageDialogueSubmit(payload: ImageDialogueSubmitPayload) {
    const prompt = payload.prompt.trim()
    if (!prompt) {
      message.warning('请输入提示词')
      return
    }

    const g = graph.value
    const fromImageGenPrompt = Boolean(activeImageGenPromptNodeId.value)
    const sourceNodeId =
      getActiveImageDialogueTargetNodeId() || selectedNodeId.value
    if (!g || !sourceNodeId) return

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) return

    const sourceNode = cell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (sourceData.uploadState === 'uploading' || sourceData.imageGenState === 'loading') return

    const dialoguePreviews = getImageDialoguePreviewsForNode(sourceNodeId)
    persistImageDialogueFields(sourceNodeId)
    if (fromImageGenPrompt) {
      closeImageGenPromptBar()
      exitImageDialogueCanvasPickMode()
    } else {
      resetImageDialogue()
    }

    const referenceAssetIds = dialoguePreviews
      .map((item) => item.assetId)
      .filter((id): id is string => Boolean(id))
    const assetId = referenceAssetIds[0] || resolveImageAssetId(sourceData) || ''

    const title = buildImageActionResultTitle('文生图')
    const sourceFileName = sourceData.fileName || sourceData.title || ''
    const buildFileName = (name: string) => (name ? `文生图-${name}` : '文生图.png')
    const requestedCount = Math.max(1, Math.floor(Number(payload.count)) || 1)
    const taskParameters: Record<string, unknown> = {
      model: payload.model,
      aspectRatio: payload.aspectRatio,
      count: 1,
    }
    if (payload.resolution) {
      taskParameters.resolution = payload.resolution
    }

    sourceNode.setData(
      {
        ...sourceData,
        imageGenState: 'loading',
        imageGenProgress: 0,
        genPrompt: prompt,
      },
      { overwrite: true },
    )

    selectedNodeId.value = sourceNodeId
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(sourceNodeId)
    bumpToolbarRevision()
    updateNodeToolbar()

    const resultNodes: Node[] = [sourceNode]
    const batchPreviewSize = getNodeSize('image', 'editor', {
      kind: 'image',
      mode: 'editor',
      imageGenState: 'loading',
    })
    const extraCount = Math.max(0, requestedCount - 1)
    const plannedPoints =
      extraCount > 0
        ? planOutgoingResultPoints(g, sourceNode, batchPreviewSize, extraCount, 'above')
        : []

    for (let index = 1; index < requestedCount; index += 1) {
      resultNodes.push(
        spawnGenerationResultNode(g, sourceNode, {
          title,
          fileName: resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount),
          centerPoint: plannedPoints[index - 1],
        }),
      )
    }

    const runners = resultNodes.map((resultNode, index) => {
      const fileName = resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount)

      return startImageGenerationOnNode(resultNode, {
        title,
        fileName,
        createTask: async () => {
          const idempotencyKey =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `img-dialogue-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

          const created = await api.createGenerationTask<GenerationTaskDetail>(
            {
              taskType: 'IMAGE',
              capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
              prompt,
              parameters: taskParameters,
              projectId: activeProjectId.value,
              nodeId: resultNode.id,
              referenceAssetIds:
                referenceAssetIds.length > 0
                  ? referenceAssetIds
                  : assetId
                    ? [assetId]
                    : undefined,
              workflowId: resolveGenerationTaskWorkflowId(payload.workflowId),
            },
            idempotencyKey,
          )
          userInfoStore.queryPointAccount()
          return created; 
        },
        onTaskBound: () => persistGenerationTaskBinding(),
        onError: (reason) => message.error(reason),
        onComplete: async (result) => {
          if (!result.success || index !== 0) return

          const extraResults = result.extraResults ?? []
          if (!extraResults.length) return

          const totalCount = 1 + extraResults.length
          const extraNodes = await spawnNodesForExtraGenerationResults(g, sourceNode, extraResults, {
            title,
            sourceFileName,
            buildFileName,
            resultIndexOffset: 1,
            totalCount,
            placement: 'above',
          })

          if (!extraNodes.length) return
          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
          scheduleHistoryPush()

          nextTick(() => {
            const scroller = getScroller(g)
            if (!scroller) return
            const boxes = [sourceNode, ...extraNodes].map((node) => node.getBBox())
            const minX = Math.min(...boxes.map((box) => box.x))
            const maxX = Math.max(...boxes.map((box) => box.x + box.width))
            const minY = Math.min(...boxes.map((box) => box.y))
            const maxY = Math.max(...boxes.map((box) => box.y + box.height))
            scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, {
              duration: '280ms',
            })
          })
        },
      })
    })

    try {
      const outcomes = await Promise.allSettled(runners)
      const started = outcomes.some(
        (outcome) => outcome.status === 'fulfilled' && outcome.value.started,
      )
      if (!started) {
        if (sourceNode.getData().imageGenState === 'loading') {
          markGenerationNodeFailed(sourceNode)
        }
        return
      }

      scheduleHistoryPush()
    } catch (error) {
      resultNodes.forEach((node) => {
        if (node.id !== sourceNodeId) markGenerationNodeFailed(node)
      })
      if (sourceNode.getData().imageGenState === 'loading') {
        markGenerationNodeFailed(sourceNode)
      }
      message.error(isRequestError(error) ? error.message : '生成失败，请稍后重试')
    } finally {
      bumpToolbarRevision()
      updateNodeToolbar()
    }
  }

  /** 视频节点对话框提交（与图片对话框平行，逻辑独立） */
  function handleVideoDialogueSubmit(payload: VideoDialogueSubmitPayload) {
    const prompt = payload.prompt.trim()
    if (!prompt) {
      message.warning('请输入提示词')
      return
    }

    const g = graph.value
    const sourceNodeId = selectedNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return
    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData

    const submitCtx = resolveVideoGenerationSubmitContext(g, sourceNodeId, sourceData, {
      payloadMode: payload.mode,
      preferStored: true,
    })
    const { imageAssetIds, videoAssetId, mode } = submitCtx
    const imageAssetId = imageAssetIds[0] || ''

    persistVideoDialogueFields(sourceNodeId)
    applyVideoGenerationProvenance(sourceNode, { ...payload, prompt, mode }, submitCtx.refs)
    resetVideoDialogue()

    const event: VideoToolbarClickEvent = {
      key: VIDEO_GENERAL_CAPABILITY_CODE,
      label: '视频生成',
      assetId: imageAssetId || videoAssetId,
    }

    void runVideoGenerationTask(event, {
      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
      title: buildVideoActionResultTitle('视频生成'),
      prompt,
      requireAssetId: false,
      requireSourcePreview: false,
      resolveReferenceAssetIds: () => imageAssetIds,
      buildFileName: (sourceFileName) =>
        sourceFileName ? `视频生成-${sourceFileName}` : '视频生成.mp4',
      buildParameters: () => {
        const params: Record<string, unknown> = {
          mode,
          model: payload.model,
          ratio: payload.ratio,
          clarity: toVideoApiClarity(payload.clarity),
          duration: payload.duration,
          generateAudio: payload.generateAudio,
          videoCount: payload.videoCount,
        }
        const primaryAssetId = imageAssetId || videoAssetId
        if (primaryAssetId) {
          params.assetId = primaryAssetId
        }
        return params
      },
    })
  }

  /** 视频生成提示面板提交（与图片生成提示平行，逻辑独立） */
  function handleVideoGenPromptSubmit(payload: VideoGenPromptSubmitPayload) {
    const prompt = payload.prompt.trim()
    if (!prompt) {
      message.warning('请输入提示词')
      return
    }

    const g = graph.value
    const sourceNodeId = activeVideoGenPromptNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    if (sourceData.kind !== 'video') return
    if (sourceData.uploadState === 'uploading') {
      message.warning('视频上传中，请稍后再试')
      return
    }

    const submitCtx = resolveVideoGenerationSubmitContext(g, sourceNodeId, sourceData, {
      payloadMode: payload.mode,
      preferStored: true,
    })
    const { imageAssetIds, mode: resolvedMode } = submitCtx
    const assetId = imageAssetIds[0] || submitCtx.videoAssetId || ''

    const needsImage =
      payload.mode === 'reference' ||
      payload.mode === 'image-to-video' ||
      payload.mode === 'first-last-frame'
    if (needsImage && !imageAssetIds.length) {
      message.warning('请先连接或上传参考图片')
      return
    }

    persistVideoGenPrompt()
    closeVideoGenPromptBar()
    applyVideoGenerationProvenance(
      sourceNode,
      {
        prompt,
        model: payload.model,
        ratio: payload.ratio,
        clarity: payload.clarity,
        duration: payload.duration,
        generateAudio: payload.generateAudio,
        videoCount: payload.videoCount,
        mode: resolvedMode,
      },
      submitCtx.refs,
    )

    videoGenAspectRatio.value = payload.ratio as VideoGenAspectRatio
    syncVideoNodeAspectRatio(sourceNodeId, payload.ratio as VideoGenAspectRatio)

    const title = buildVideoActionResultTitle('视频生成')
    const sourceFileName = sourceData.fileName || sourceData.title || ''
    const buildFileName = (name: string) => (name ? `视频生成-${name}` : '视频生成.mp4')
    const requestedCount = Math.max(1, Math.floor(Number(payload.videoCount)) || 1)
    const parameters: Record<string, unknown> = {
      mode: resolvedMode,
      model: payload.model,
      ratio: payload.ratio,
      clarity: toVideoApiClarity(payload.clarity),
      duration: payload.duration,
      generateAudio: payload.generateAudio,
      videoCount: 1,
    }
    if (assetId) {
      parameters.assetId = assetId
    }

    const connectRefsToVideoNode = (node: Node) => {
      for (const ref of submitCtx.refs) {
        if (!findImageToVideoEdge(g, ref.nodeId, node.id)) {
          connectGenEdge(g, ref.nodeId, node.id)
        }
      }
    }

    if (requestedCount > 1) {
      const refreshedSource = sourceNode.getData() as CanvasNodeData
      const layoutSize = resolveVideoResultLayoutSize(refreshedSource)
      const plannedPoints = planOutgoingResultPoints(
        g,
        sourceNode,
        layoutSize,
        requestedCount,
        'right',
      )
      const resultNodes: Node[] = []

      for (let index = 0; index < requestedCount; index += 1) {
        const resultNode = spawnVideoGenerationResultNode(g, sourceNode, {
          title,
          fileName: resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount),
          videoDialogueText: prompt,
          videoDialogueSettings: refreshedSource.videoDialogueSettings,
          videoSourceRefs: refreshedSource.videoSourceRefs,
          genPrompt: prompt,
          centerPoint: plannedPoints[index],
        })
        connectRefsToVideoNode(resultNode)
        resultNodes.push(resultNode)
      }

      const primaryNode = resultNodes[0]
      selectedNodeId.value = primaryNode.id
      selectedKind.value = 'video'
      syncNodeSelectionHighlight(primaryNode.id)
      syncNodeCount()
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()

      void Promise.all(
        resultNodes.map(async (resultNode, index) => {
          const nodeFileName = resolveGenerationResultFileName(
            buildFileName,
            sourceFileName,
            index,
            requestedCount,
          )
          const idempotencyKey =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `video-gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

          try {
            const created = normalizeGenerationTaskDetail(
              await api.createGenerationTask<GenerationTaskDetail>(
                {
                  taskType: 'VIDEO',
                  capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                  prompt: toVideoApiPrompt(prompt),
                  parameters,
                  projectId: activeProjectId.value,
                  nodeId: resultNode.id,
                  referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
                },
                idempotencyKey,
              ),
            )

            const taskId = created.id
            if (!taskId) {
              throw new Error('创建视频生成任务失败')
            }
            userInfoStore.queryPointAccount()
            bindGenerationTaskId(resultNode, taskId, 'VIDEO')
            persistGenerationTaskBinding()

            startVideoGenerationTaskFollow(resultNode, taskId, {
              title,
              fileName: nodeFileName,
              onError: (reason) => message.error(reason),
              onComplete: (success) => handleVideoGenerationTaskComplete(resultNode.id, success),
            })
          } catch (error) {
            markVideoGenerationNodeFailed(resultNode)
            revealVideoDialogueAfterGenerationFailure(resultNode.id)
            message.error(isRequestError(error) ? error.message : '视频生成失败，请稍后重试')
          }
        }),
      )
      return
    }

    const reusableNode = findReusableVideoGenerationNode(g, sourceNode)
    const targetNode = reusableNode ?? sourceNode
    const fileName = buildFileName(sourceFileName)

    if (reusableNode) {
      resetVideoGenerationNodeForRetry(reusableNode, { title, fileName, prompt })
    }

    const provenanceData = targetNode.getData() as CanvasNodeData
    targetNode.setData(
      {
        ...provenanceData,
        kind: 'video',
        mode: 'editor',
        uploadState: 'uploading',
        uploadProgress: 0,
        generationTaskType: 'VIDEO',
        genPrompt: prompt,
        videoDialogueText: prompt,
        title,
        fileName,
        videoGenAspectRatio: payload.ratio,
        videoGenTab: payload.tab,
        generationTaskId: undefined,
      },
      { overwrite: true },
    )
    connectRefsToVideoNode(targetNode)

    selectedNodeId.value = targetNode.id
    selectedKind.value = 'video'
    syncNodeSelectionHighlight(targetNode.id)
    syncNodeCount()
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `video-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    void (async () => {
      try {
        const created = normalizeGenerationTaskDetail(
          await api.createGenerationTask<GenerationTaskDetail>(
            {
              taskType: 'VIDEO',
              capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
              prompt: toVideoApiPrompt(prompt),
              parameters,
              projectId: activeProjectId.value,
              nodeId: targetNode.id,
              referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
            },
            idempotencyKey,
          ),
        )

        const taskId = created.id
        if (!taskId) {
          throw new Error('创建视频生成任务失败')
        }
        userInfoStore.queryPointAccount();
        bindGenerationTaskId(targetNode, taskId, 'VIDEO')
        persistGenerationTaskBinding()

        startVideoGenerationTaskFollow(targetNode, taskId, {
          title,
          fileName,
          onError: (reason) => message.error(reason),
          onComplete: (success) => handleVideoGenerationTaskComplete(targetNode.id, success),
        })
      } catch (error) {
        markVideoGenerationNodeFailed(targetNode)
        revealVideoDialogueAfterGenerationFailure(targetNode.id)
        message.error(isRequestError(error) ? error.message : '视频生成失败，请稍后重试')
      }
    })()
  }

  function normalizeCutoutMode(option?: string) {
    if (!option) return 'quick'
    if (option === '快速') return 'quick'
    if (option === '精准') return 'precise'
    if (option === '擦除') return 'erase'
    return option
  }

  function resolveGenerationTaskWorkflowId(
    workflowId?: string | number | null,
  ): string | null {
    if (workflowId === undefined || workflowId === null || workflowId === '') return null
    return String(workflowId)
  }

  function resolveGenerationResultFileName(
    buildFileName: (sourceFileName: string) => string,
    sourceFileName: string,
    index: number,
    total: number,
  ) {
    const base = buildFileName(sourceFileName)
    if (total <= 1) return base
    const dot = base.lastIndexOf('.')
    if (dot > 0) {
      return `${base.slice(0, dot)}-${index + 1}${base.slice(dot)}`
    }
    return `${base}-${index + 1}`
  }

  function resolveVideoResultLayoutSize(sourceData: CanvasNodeData) {
    const ratio =
      sourceData.videoGenAspectRatio ||
      sourceData.videoDialogueSettings?.aspectRatio
    return getNodeSize('video', 'editor', {
      kind: 'video',
      mode: 'editor',
      uploadState: 'uploading',
      generationTaskType: 'VIDEO',
      videoGenAspectRatio: ratio,
    })
  }

  function ensureGenerationResultLoadingNodes(
    g: Graph,
    sourceNode: Node,
    resultNodes: Node[],
    totalCount: number,
    config: {
      title: string
      sourceFileName: string
      buildFileName: (sourceFileName: string) => string
      placement?: import('../../imageGen').ResultPlacement
    },
  ) {
    if (totalCount <= resultNodes.length) return

    const batchPreviewSize = getNodeSize('image', 'editor', {
      kind: 'image',
      mode: 'editor',
      imageGenState: 'loading',
    })
    const plannedPoints = planOutgoingResultPoints(
      g,
      sourceNode,
      batchPreviewSize,
      totalCount,
      config.placement ?? 'right',
    )

    for (let index = resultNodes.length; index < totalCount; index += 1) {
      resultNodes.push(
        spawnGenerationResultNode(g, sourceNode, {
          title: config.title,
          fileName: resolveGenerationResultFileName(
            config.buildFileName,
            config.sourceFileName,
            index,
            totalCount,
          ),
          centerPoint: plannedPoints[index],
          layoutSlot: index,
          layoutTotal: totalCount,
        }),
      )
    }
  }

  async function distributeMultiImageGenerationResults(
    g: Graph,
    sourceNode: Node,
    resultNodes: Node[],
    allResults: GenerationTaskResult[],
    config: {
      title: string
      sourceFileName: string
      buildFileName: (sourceFileName: string) => string
      placement?: import('../../imageGen').ResultPlacement
    },
  ): Promise<Node[]> {
    const totalCount = allResults.length
    if (totalCount <= 1) return []

    ensureGenerationResultLoadingNodes(g, sourceNode, resultNodes, totalCount, config)

    const appliedNodes: Node[] = []
    const failedResults: { result: GenerationTaskResult; index: number }[] = []

    for (let index = 1; index < totalCount; index += 1) {
      const node = resultNodes[index]
      const result = allResults[index]
      if (!node || !result) continue

      const data = node.getData() as CanvasNodeData
      if (data.previewUrl?.trim() && data.imageGenState !== 'loading') {
        appliedNodes.push(node)
        continue
      }

      const resolved = await resolveGenerationResultPreview(result)
      if (!resolved?.previewUrl?.trim()) {
        failedResults.push({ result, index })
        continue
      }

      const didApply = await applyGenerationResultToNode(node, resolved, {
        title: config.title,
        fileName: resolveGenerationResultFileName(
          config.buildFileName,
          config.sourceFileName,
          index,
          totalCount,
        ),
      })
      if (didApply) {
        appliedNodes.push(node)
      } else {
        failedResults.push({ result, index })
      }
    }

    for (const item of failedResults) {
      const spawnedNodes = await spawnNodesForExtraGenerationResults(g, sourceNode, [item.result], {
        title: config.title,
        sourceFileName: config.sourceFileName,
        buildFileName: config.buildFileName,
        resultIndexOffset: item.index,
        totalCount,
        placement: config.placement,
      })
      appliedNodes.push(...spawnedNodes)
    }

    return appliedNodes
  }

  async function spawnNodesForExtraGenerationResults(
    g: Graph,
    sourceNode: Node,
    extraResults: GenerationTaskResult[],
    config: {
      title: string
      sourceFileName: string
      buildFileName: (sourceFileName: string) => string
      resultIndexOffset: number
      totalCount: number
      placement?: import('../../imageGen').ResultPlacement
    },
  ): Promise<Node[]> {
    const nodes: Node[] = []
    if (!extraResults.length) return nodes

    const batchPreviewSize = getNodeSize('image', 'editor', {
      kind: 'image',
      mode: 'editor',
      uploadState: 'done',
      previewUrl: 'placeholder',
    })
    const plannedPoints = planOutgoingResultPoints(
      g,
      sourceNode,
      batchPreviewSize,
      extraResults.length,
      config.placement ?? 'right',
    )
    let pointIndex = 0

    for (let index = 0; index < extraResults.length; index += 1) {
      const resolved = await resolveGenerationResultPreview(extraResults[index])
      if (!resolved?.previewUrl?.trim()) continue

      const node = spawnCompletedImageResultNode(g, sourceNode, {
        title: config.title,
        fileName: resolveGenerationResultFileName(
          config.buildFileName,
          config.sourceFileName,
          config.resultIndexOffset + index,
          config.totalCount,
        ),
        previewUrl: resolved.previewUrl,
        assetId: resolved.assetId,
        mediaWidth: resolved.width ?? undefined,
        mediaHeight: resolved.height ?? undefined,
        centerPoint: plannedPoints[pointIndex],
      })
      pointIndex += 1
      nodes.push(node)
    }

    return nodes
  }

  async function runImageGenerationTask(
    event: ImageToolbarClickEvent,
    config: {
      capabilityCode: string
      title: string
      prompt?: string
      workflowId?: string | number | null
      requireAssetId?: boolean
      requireSourcePreview?: boolean
      resultPlacement?: import('../../imageGen').ResultPlacement
      buildFileName: (sourceFileName: string) => string
      buildParameters: (event: ImageToolbarClickEvent) => Record<string, unknown>
      resolveReferenceAssetIds?: (event: ImageToolbarClickEvent) => string[]
    },
  ) {
    const requireAssetId = config.requireAssetId !== false
    if (requireAssetId && !event.assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    const g = graph.value
    const sourceNodeId = selectedNodeId.value
    if (!g || !sourceNodeId) return

    const sourceCell = g.getCellById(sourceNodeId)
    if (!sourceCell?.isNode()) return

    const sourceNode = sourceCell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    const requireSourcePreview = config.requireSourcePreview !== false
    if (requireSourcePreview && !sourceData.previewUrl) return
    if (sourceData.uploadState === 'uploading') return

    // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
    //   message.info('当前图片已有进行中的生成任务')
    //   return
    // }

    resetImageDialogue()

    const sourceFileName = sourceData.fileName || sourceData.title || ''
    const taskParameters = config.buildParameters(event)
    const requestedCount = Math.max(1, Math.floor(Number(taskParameters.count)) || 1)
    const singleTaskParameters = { ...taskParameters, count: 1 }
    const resultNodes: Node[] = []
    const batchPreviewSize = getNodeSize('image', 'editor', {
      kind: 'image',
      mode: 'editor',
      imageGenState: 'loading',
    })
    const plannedPoints = planOutgoingResultPoints(
      g,
      sourceNode,
      batchPreviewSize,
      requestedCount,
      config.resultPlacement ?? 'right',
    )

    for (let index = 0; index < requestedCount; index += 1) {
      resultNodes.push(
        spawnGenerationResultNode(g, sourceNode, {
          title: config.title,
          fileName: resolveGenerationResultFileName(
            config.buildFileName,
            sourceFileName,
            index,
            requestedCount,
          ),
          centerPoint: plannedPoints[index],
        }),
      )
    }

    const primaryNode = resultNodes[0]

    selectedNodeId.value = primaryNode.id
    selectedKind.value = 'image'
    syncNodeSelectionHighlight(primaryNode.id)
    syncNodeCount()
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()

    const referenceAssetIds =
      config.resolveReferenceAssetIds?.(event) ??
      (event.assetId ? [event.assetId] : [])

    const distributionConfig = {
      title: config.title,
      sourceFileName,
      buildFileName: config.buildFileName,
      placement: config.resultPlacement,
    }

    const runners = resultNodes.map((resultNode, index) => {
      const fileName = resolveGenerationResultFileName(
        config.buildFileName,
        sourceFileName,
        index,
        requestedCount,
      )

      return startImageGenerationOnNode(resultNode, {
        title: config.title,
        fileName,
        createTask: async () => {
          const idempotencyKey =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`

          const created = await api.createGenerationTask<GenerationTaskDetail>(
            {
              taskType: 'IMAGE',
              capabilityCode: config.capabilityCode,
              prompt: config.prompt?.trim() ?? '',
              parameters: singleTaskParameters,
              projectId: activeProjectId.value,
              nodeId: resultNode.id,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
              workflowId: resolveGenerationTaskWorkflowId(config.workflowId),
            },
            idempotencyKey,
          )
          userInfoStore.queryPointAccount()
          return created; 
        },
        onTaskCreated: (created) => {
          if (index !== 0) return
          const apiResultCount = pickImageGenerationResults(created).length
          if (apiResultCount <= 1) return

          ensureGenerationResultLoadingNodes(
            g,
            sourceNode,
            resultNodes,
            apiResultCount,
            distributionConfig,
          )
          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
        },
        onTaskBound: () => persistGenerationTaskBinding(),
        onError: (reason) => message.error(reason),
        onComplete: async (result) => {
          if (!result.success || index !== 0) return

          const allResults = result.allResults ?? []
          if (allResults.length <= 1) return

          const extraNodes = await distributeMultiImageGenerationResults(
            g,
            sourceNode,
            resultNodes,
            allResults,
            distributionConfig,
          )

          if (!extraNodes.length) return

          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
          scheduleHistoryPush()

          nextTick(() => {
            const scroller = getScroller(g)
            if (!scroller) return
            const boxes = [primaryNode, ...extraNodes].map((node) => node.getBBox())
            const minX = Math.min(...boxes.map((box) => box.x))
            const maxX = Math.max(...boxes.map((box) => box.x + box.width))
            const minY = Math.min(...boxes.map((box) => box.y))
            const maxY = Math.max(...boxes.map((box) => box.y + box.height))
            scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, {
              duration: '280ms',
            })
          })
        },
      })
    })

    try {
      const outcomes = await Promise.allSettled(runners)
      const started = outcomes.some(
        (outcome) => outcome.status === 'fulfilled' && outcome.value.started,
      )
      if (!started) return

      resetImageDialogue()
    } catch (error) {
      resultNodes.forEach((node) => markGenerationNodeFailed(node))
      message.error(isRequestError(error) ? error.message : '生成失败，请稍后重试')
    }
  }

  function handleImageDownloadAction(event: ImageToolbarClickEvent) {
    void event.assetId
    const data = getSelectedNodeData()
    const url = data?.previewUrl
    if (!url) {
      message.warning('图片尚未准备好，无法下载')
      return
    }
    void downloadCanvasMedia({
      url,
      fallbackName: 'image',
    }).catch((error) => {
      message.error(isRequestError(error) ? error.message : '图片下载失败，请稍后重试')
    })
  }

  async function openImageCrop() {
    const ready = await ensureImageEditorReady('裁剪')
    if (!ready) return

    showImageHdMenu.value = false
    showImageDialogue.value = false
    showImageToolbarMore.value = false
    showImageToolbarMoreMenu.value = false
    closeImageGridSplit()
    closeImageErase()
    closeImageInpaint()
    closeImageExpand()
    closeImageEditText()
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
    const sourceData = sourceNode.getData() as CanvasNodeData
    const fileName = sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png'
    const localPreviewUrl = payload.dataUrl

    closeImageCrop()

    const croppedNode = spawnCroppedImageNode(g, sourceNode, payload)
    focusErasedResultNode(g, croppedNode)

    void uploadLocalImageNodeInBackground(croppedNode, localPreviewUrl, fileName, payload).then(() => {
      scheduleHistoryPush()
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

    if (activeImageDialogueNodeId && activeImageDialogueNodeId !== id) {
      persistImageDialogueFields(activeImageDialogueNodeId)
    }

    selectedNodeId.value = id
    selectedKind.value = 'image'
    loadImageDialogueFields(id)
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

  function revealVideoDialogueAfterGenerationFailure(nodeId: string) {
    const g = graph.value
    if (!g || !nodeId) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    if (data.kind !== 'video' || !isVideoGenerationFailedNode(data)) return
    openVideoDialogue(nodeId)
  }

  function handleVideoGenerationTaskComplete(nodeId: string, success: boolean) {
    if (success) {
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }
    revealVideoDialogueAfterGenerationFailure(nodeId)
  }

  function openVideoDialogue(nodeId?: string) {
    const g = graph.value
    if (!g) return
    const id = nodeId ?? selectedNodeId.value
    if (!id) return
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    if (data.kind !== 'video') return

    cancelVideoToolbarDefer()

    if (activeVideoDialogueNodeId && activeVideoDialogueNodeId !== id) {
      persistVideoDialogueFields(activeVideoDialogueNodeId)
    }

    selectedNodeId.value = id
    selectedKind.value = 'video'
    loadVideoDialogueFields(id)
    showVideoDialogue.value = true
    closeVideoSubPanels('dialogue')
    closeVideoGenPromptBar()
    syncNodeSelectionHighlight(id)
    updateNodeToolbar()
  }

  function toggleVideoDialogue() {
    if (showVideoDialogue.value) {
      persistVideoDialogueFields()
      showVideoDialogue.value = false
      activeVideoDialogueNodeId = ''
      updateNodeToolbar()
      return
    }
    openVideoDialogue()
  }

  function handleVideoNodeDblClick({ node }: { node: Node }) {
    openVideoDialogue(node.id)
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
      assetId: resolveImageAssetId(data),
    })
  }

  function addVideoToDialog() {
    const g = graph.value
    const id = selectedNodeId.value
    if (!g || !id) return

    const cell = g.getCellById(id)
    if (!cell?.isNode()) return

    const data = cell.getData() as CanvasNodeData
    if (data.kind !== 'video' || !data.previewUrl || data.uploadState === 'uploading') return

    emit('add-to-chat', {
      previewUrl: data.previewUrl,
      fileName: data.fileName || data.title || 'video.jpg',
      assetId: data.assetId || data.sourceAssetId || '',
    })
  }

  function resetVideoHdPanel() {
    showVideoHdPanel.value = false
  }

  function resetVideoFramesPanel() {
    showVideoFramesPanel.value = false
  }

  function onVideoHdStart() {
    const magnification = videoHdMagnification.value
    resetVideoHdPanel()
    onVideoToolbarAction({
      key: 'VIDEO_HD',
      option: magnification,
      label: '高清补帧',
    })
  }

  function resetImageDialogue() {
    persistImageDialogueFields()
    showImageDialogue.value = false
    activeImageDialogueNodeId = ''
    exitImageDialogueCanvasPickMode()
  }

  function getActiveImageDialogueTargetNodeId() {
    if (activeImageGenPromptNodeId.value) return activeImageGenPromptNodeId.value
    if (activeImageDialogueNodeId) return activeImageDialogueNodeId
    if (showImageDialogue.value && selectedNodeId.value && selectedKind.value === 'image') {
      return selectedNodeId.value
    }
    return ''
  }

  function restoreCanvasPickTargetSelection() {
    const g = graph.value
    if (!g) return

    const targetId = showImageDialogueCanvasPickMode.value
      ? getActiveImageDialogueTargetNodeId()
      : showVideoGenCanvasPickMode.value
        ? getActiveVideoTargetNodeId()
        : ''
    if (!targetId) {
      g.cleanSelection()
      syncNodeSelectionHighlight([])
      updateImageResizeOverlay()
      return
    }

    const cell = g.getCellById(targetId)
    if (!cell?.isNode()) return

    const targetData = cell.getData() as CanvasNodeData
    const currentIds = getGraphSelectedNodeIds()
    if (currentIds.length !== 1 || currentIds[0] !== targetId) {
      clearEdgeSelection()
      g.cleanSelection()
      g.select(cell)
    }

    selectedNodeIds.value = [targetId]
    selectedNodeId.value = targetId
    selectedKind.value = targetData.kind
    syncNodeSelectionHighlight(targetId)
    bumpToolbarRevision()

    const overlayRoot = canvasRef.value
    if (overlayRoot) {
      const node = cell as Node
      if (showImageDialogue.value && targetData.kind === 'image') {
        dialoguePos.value = getNodeDialoguePosition(g, node, overlayRoot)
      }
      if (activeVideoGenPromptNodeId.value === targetId) {
        updateVideoGenPromptBarPosition()
      }
    }
    updateImageResizeOverlay()
  }

  function hasImageDialogueSourceRef(
    targetNodeId: string,
    imageNodeId: string,
    previewUrl: string,
  ) {
    const g = graph.value
    if (!g || !targetNodeId) return false
    const cell = g.getCellById(targetNodeId)
    if (!cell?.isNode()) return false
    const data = cell.getData() as CanvasNodeData
    const refs = seedImageDialogueRefs(data, targetNodeId)
    return refs.some(
      (item) => item.nodeId === imageNodeId || item.previewUrl === previewUrl,
    )
  }

  function seedImageDialogueRefs(data: CanvasNodeData, targetNodeId: string): ImageSourceRef[] {
    const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
    if (refs.length) return refs

    if (data.sourceNodeId && data.sourcePreviewUrl) {
      refs.push({
        nodeId: data.sourceNodeId,
        assetId: data.sourceAssetId,
        previewUrl: data.sourcePreviewUrl,
        fileName: data.sourceFileName ?? '',
      })
      return refs
    }

    if (data.previewUrl) {
      refs.push({
        nodeId: targetNodeId,
        assetId: data.assetId,
        previewUrl: data.previewUrl,
        fileName: data.fileName || data.title || '',
      })
    }

    return refs
  }

  function addImageDialogueSourceRef(
    payload: {
      nodeId?: string
      assetId?: string
      previewUrl: string
      fileName?: string
    },
    targetNodeId?: string,
  ) {
    const g = graph.value
    const id = targetNodeId ?? selectedNodeId.value
    if (!g || !id || !payload.previewUrl) return

    const cell = g.getCellById(id)
    if (!cell?.isNode()) return

    const data = { ...(cell.getData() as CanvasNodeData) }
    if (data.kind !== 'image') return
    if (payload.nodeId && payload.nodeId === id) return

    const ref: ImageSourceRef = {
      nodeId: payload.nodeId || payload.assetId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: payload.assetId,
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
    data.sourceAssetId = latest?.assetId ?? ''
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
      assetId: sourceData.assetId,
      previewUrl: sourceData.previewUrl,
      fileName: sourceData.fileName || sourceData.title || '',
    }, targetNodeId)
    bumpToolbarRevision()
    scheduleHistoryPush()
    return true
  }

  async function onImageDialogueUploadFiles(files: File[]) {
    const g = graph.value
    const targetNodeId = getActiveImageDialogueTargetNodeId() || selectedNodeId.value
    if (!g || !targetNodeId) return

    const targetCell = g.getCellById(targetNodeId)
    if (!targetCell?.isNode()) return

    const targetData = targetCell.getData() as CanvasNodeData
    if (targetData.kind !== 'image') return

    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    const wasDialogueOpen = showImageDialogue.value
    const bbox = targetCell.getBBox()

    for (let index = 0; index < imageFiles.length; index += 1) {
      const point = {
        x: bbox.x - 200 - index * 48,
        y: bbox.y + index * 36,
      }
      const node = await addImageFromFile(imageFiles[index], point, { select: false })
      if (!node) continue
      await linkImageNodeToImageDialogue(node.id, targetNodeId)
    }

    selectGraphNodes(targetNodeId)
    if (wasDialogueOpen) {
      openImageDialogue(targetNodeId)
    } else {
      updateNodeToolbar()
    }
    bumpToolbarRevision()
    scheduleHistoryPush()
  }

  function onImageDialogueAddCanvasNode(sourceNodeId: string) {
    const targetNodeId = getActiveImageDialogueTargetNodeId() || selectedNodeId.value
    const wasDialogueOpen = showImageDialogue.value
    void linkImageNodeToImageDialogue(sourceNodeId, targetNodeId).then((linked) => {
      if (!linked) return
      if (targetNodeId) {
        selectGraphNodes(targetNodeId)
        if (wasDialogueOpen) {
          openImageDialogue(targetNodeId)
        } else {
          updateNodeToolbar()
        }
      }
      bumpToolbarRevision()
      scheduleHistoryPush()
    })
  }

  function clearImageDialoguePreview(sourceNodeId?: string) {
    const g = graph.value
    const id = getActiveImageDialogueTargetNodeId() || selectedNodeId.value
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
    data.sourceAssetId = latest?.assetId ?? ''
    data.inputUpdated = refs.some((item) => Boolean(item.previewUrl))
    // overwrite: true —— X6 默认深合并数组不会缩短，删除元素必须整体替换
    cell.setData(data, { overwrite: true })
    toolbarRevision.value += 1
    scheduleHistoryPush()
  }

  function resetVideoDialogue() {
    persistVideoDialogueFields()
    showVideoDialogue.value = false
    activeVideoDialogueNodeId = ''
  }

  /** 关闭图片/视频节点底部对话框（打开连线菜单等互斥浮层时调用） */
  function closeTextPromptBar() {
    if (!activePickerNodeId.value) return
    persistPromptBarDraft()
    activePickerNodeId.value = ''
    bumpToolbarRevision()
  }

  function closeNodeDialoguePanels() {
    if (showImageDialogue.value) resetImageDialogue()
    if (showVideoDialogue.value) resetVideoDialogue()
    closeTextPromptBar()
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
    scheduleHistoryPush({ autoSave: false })
  }

  provide('uploadFileToCanvasNode', uploadFileToCanvasNode)
  provide('updateImageMarkLabel', updateImageMarkLabel)

  function resolveImageGenTextSourcePreview(nodeId: string): string {
    const g = graph.value
    if (!g) return ''
    for (const textNode of findIncomingTextNodes(g, nodeId)) {
      const text = getTextNodePlainContent(textNode)
      if (text) return text
    }
    return ''
  }

  function loadImageGenPromptFields(nodeId: string) {
    const g = graph.value
    if (!g) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    const textPreview = resolveImageGenTextSourcePreview(nodeId)
    imageGenSourceTextPreview.value = textPreview
    imageGenSourcePreviewUrl.value = textPreview ? '' : (data.sourcePreviewUrl ?? '')
    imageGenSeed.value = data.genSeed ?? 58

    let prompt = data.imageDialogueText?.trim() || data.genPrompt?.trim() || ''
    if (!prompt && textPreview) {
      prompt = textPreview
    }

    imageGenPromptText.value = prompt
    imageDialogueText.value = prompt
    imageDialogueSettings.value = normalizeImageDialogueSettings(data.imageDialogueSettings)

    if (prompt && (prompt !== data.genPrompt || (!data.imageDialogueText?.trim() && prompt !== data.imageDialogueText))) {
      cell.setData({
        ...data,
        genPrompt: prompt,
        imageDialogueText: data.imageDialogueText?.trim() ? data.imageDialogueText : prompt,
      })
    }
  }

  function normalizeImageDialogueSettings(
    saved?: CanvasNodeData['imageDialogueSettings'],
  ) {
    const defaults = createDefaultImageDialogueSettings()
    if (!saved) return defaults
    return {
      aspectRatio: saved.aspectRatio ?? defaults.aspectRatio,
      resolution: saved.resolution ?? defaults.resolution,
      imageCount: saved.imageCount ?? defaults.imageCount,
      // 空值交给面板按 chatTools.modelOptions 第一项回填
      modelKey: saved.modelKey?.trim() ? saved.modelKey : defaults.modelKey,
      workflowId: saved.workflowId ?? defaults.workflowId,
    }
  }

  function loadImageDialogueFields(nodeId: string) {
    const g = graph.value
    if (!g) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    if (data.kind !== 'image') return

    activeImageDialogueNodeId = nodeId
    imageDialogueText.value = data.imageDialogueText ?? ''
    imageDialogueSettings.value = normalizeImageDialogueSettings(data.imageDialogueSettings)
  }

  function persistImageDialogueFields(nodeId?: string) {
    const g = graph.value
    const id =
      nodeId ||
      activeImageGenPromptNodeId.value ||
      activeImageDialogueNodeId ||
      (showImageDialogue.value ? selectedNodeId.value : '')
    if (!g || !id) return
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return
    const data = { ...(cell.getData() as CanvasNodeData) }
    if (data.kind !== 'image') return

    data.imageDialogueText = imageDialogueText.value
    data.imageDialogueSettings = { ...imageDialogueSettings.value }
    if (imageDialogueText.value.trim()) {
      data.genPrompt = imageDialogueText.value
    }
    cell.setData(data, { overwrite: true })
  }

  function normalizeVideoDialogueSettings(
    saved?: CanvasNodeData['videoDialogueSettings'],
  ) {
    const defaults = createDefaultVideoDialogueSettings()
    if (!saved) return defaults
    return {
      modelKey: saved.modelKey?.trim() ? saved.modelKey : defaults.modelKey,
      aspectRatio: saved.aspectRatio ?? defaults.aspectRatio,
      resolution: saved.resolution ?? defaults.resolution,
      duration: saved.duration ?? defaults.duration,
      generateAudio: saved.generateAudio ?? defaults.generateAudio,
      mode: saved.mode ?? defaults.mode,
      videoCount: saved.videoCount ?? defaults.videoCount,
    }
  }

  function loadVideoDialogueFields(nodeId: string) {
    const g = graph.value
    if (!g) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    if (data.kind !== 'video') return

    activeVideoDialogueNodeId = nodeId
    // 优先对话框字段；旧节点/底部面板生成的结果回退到 genPrompt
    videoDialogueText.value = data.videoDialogueText?.trim()
      ? data.videoDialogueText
      : data.genPrompt ?? ''
    videoDialogueSettings.value = normalizeVideoDialogueSettings(data.videoDialogueSettings)

    // 打开对话框时若尚无快照，把当前连线参考图落盘，保证刷新后可溯源
    const liveRefs = getVideoSourceRefs(g, nodeId)
    if (liveRefs.length && !(data.videoSourceRefs?.length)) {
      syncVideoSourceRefsSnapshot(nodeId)
    }
  }

  function persistVideoDialogueFields(nodeId?: string) {
    const g = graph.value
    const id =
      nodeId ||
      activeVideoDialogueNodeId ||
      (showVideoDialogue.value ? selectedNodeId.value : '')
    if (!g || !id) return
    const cell = g.getCellById(id)
    if (!cell?.isNode()) return
    const data = { ...(cell.getData() as CanvasNodeData) }
    if (data.kind !== 'video') return

    data.videoDialogueText = videoDialogueText.value
    data.videoDialogueSettings = { ...videoDialogueSettings.value }
    // 同步 genPrompt，便于与底部生成面板共用溯源
    if (videoDialogueText.value.trim()) {
      data.genPrompt = videoDialogueText.value
    }
    cell.setData(data, { overwrite: true })
    syncVideoSourceRefsSnapshot(id)
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

  function syncVideoNodeAspectRatio(nodeId: string, ratio: VideoGenAspectRatio) {
    const g = graph.value
    if (!g) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return

    const data = { ...(cell.getData() as CanvasNodeData) }
    if (data.kind !== 'video') return

    data.videoGenAspectRatio = ratio
    cell.setData(data)
    syncNodeShapeFromData(cell as Node)

    const size = getNodeSize(data.kind, data.mode, data)
    const node = cell as Node
    const center = {
      x: node.position().x + node.getSize().width / 2,
      y: node.position().y + node.getSize().height / 2,
    }
    node.resize(size.width, size.height)
    node.position(center.x - size.width / 2, center.y - size.height / 2)

    updateVideoGenPromptBarPosition()
    bumpToolbarRevision()
    updateNodeToolbar()
  }

  function onVideoGenAspectRatioChange(ratio: VideoGenAspectRatio) {
    videoGenAspectRatio.value = ratio
    const nodeId = activeVideoGenPromptNodeId.value
    if (!nodeId) return
    syncVideoNodeAspectRatio(nodeId, ratio)
    persistVideoGenPrompt()
  }

  function loadVideoGenPromptFields(nodeId: string) {
    const g = graph.value
    if (!g) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const data = cell.getData() as CanvasNodeData
    let prompt = data.genPrompt?.trim() ?? ''
    if (!prompt) {
      prompt = data.videoDialogueText?.trim() ?? ''
    }
    const hasTextSources = findIncomingTextNodes(g, nodeId).some(
      (node) => Boolean(getTextNodePlainContent(node)),
    )
    if (!prompt && !hasTextSources) {
      prompt = resolveVideoUpstreamPrompt(nodeId)
    }
    videoGenPromptText.value = prompt
    videoGenActiveTab.value = data.videoGenTab ?? 'text2video'
    videoGenAspectRatio.value =
      (data.videoGenAspectRatio as VideoGenAspectRatio) ||
      (data.videoDialogueSettings?.aspectRatio as VideoGenAspectRatio) ||
      '16:9'
    if (prompt && prompt !== data.genPrompt) {
      cell.setData({ ...data, genPrompt: prompt })
    }
    syncVideoNodeAspectRatio(nodeId, videoGenAspectRatio.value as VideoGenAspectRatio)
  }

  function getTextNodePlainContent(node: Node): string {
    const api = textEditorApis.get(node.id)
    if (api) {
      const live = api.getPlainText().trim()
      if (live) return live
    }
    const data = node.getData() as CanvasNodeData
    return plainTextFromNodeContent(data.content)
  }

  function resolveVideoUpstreamPrompt(videoNodeId: string): string {
    const g = graph.value
    if (!g) return ''
    for (const textNode of findIncomingTextNodes(g, videoNodeId)) {
      const text = getTextNodePlainContent(textNode)
      if (text) return text
    }
    return ''
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
    data.videoGenAspectRatio = videoGenAspectRatio.value
    // 底部面板输入同步到对话框溯源字段，生成后点「对话」可回显
    if (videoGenPromptText.value.trim()) {
      data.videoDialogueText = videoGenPromptText.value
    }
    const liveRefs = getVideoSourceRefs(g, nodeId)
    if (liveRefs.length) {
      data.videoSourceRefs = toPersistedVideoSourceRefs(liveRefs)
    }
    cell.setData(data, { overwrite: true })
  }

  function seedPromptImageRefs(data: CanvasNodeData): ImageSourceRef[] {
    const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
    if (refs.length) return refs

    if (data.sourcePreviewUrl) {
      refs.push({
        nodeId: data.linkedImageNodeId || data.sourceNodeId || '',
        assetId: data.sourceAssetId,
        previewUrl: data.sourcePreviewUrl,
        fileName: data.sourceFileName ?? '',
      })
    }

    return refs
  }

  function resolvePromptReferenceAssetIds(data: CanvasNodeData): string[] {
    const g = graph.value
    if (!g) return []

    return seedPromptImageRefs(data)
      .map((item) => {
        if (item.assetId) return item.assetId
        if (item.nodeId) {
          const imageCell = g.getCellById(item.nodeId)
          if (imageCell?.isNode()) {
            return resolveImageAssetId(imageCell.getData() as CanvasNodeData)
          }
        }
        return ''
      })
      .filter((id): id is string => Boolean(id))
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
    assetId?: string
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
      nodeId: payload.nodeId || payload.assetId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assetId: payload.assetId,
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
    data.sourceAssetId = latest?.assetId ?? ''
    data.linkedImageNodeId = latest?.nodeId ?? ''
    cell.setData(data, { overwrite: true })
    refreshPromptSourcePreviews(data)
    scheduleHistoryPush()
  }

  function onPromptUploadFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    void Promise.all(
      imageFiles.map(async (file) => {
        try {
          const result = await uploadAssetFile(file, { projectId: activeProjectId.value })
          addPromptImageSourceRef({
            assetId: result.assetId,
            previewUrl: result.url,
            fileName: file.name,
          })
        } catch (error) {
          console.error('[Canvas] prompt image upload failed', error)
        }
      }),
    )
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
    data.sourceAssetId = latest?.assetId ?? ''
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

    if (synced.textPickerTask === 'text2video') {
      modelType.value = 'text2video'
      promptText.value = synced.genPrompt ?? ''
      return
    }

    if (synced.textPickerTask === 'text2image') {
      modelType.value = 'text2image'
      promptText.value = synced.genPrompt ?? ''
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

  async function submitTextPrompt(
    payload?: VideoDialogueSubmitPayload | ImageDialogueSubmitPayload,
  ) {
    if (!canSubmitTextPrompt.value) return

    const g = graph.value
    const nodeId = activePickerNodeId.value
    if (!g || !nodeId) return

    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return

    const isSpawnResultTask =
      modelType.value === 'text2video' ||
      isText2VideoTask.value ||
      modelType.value === 'text2image' ||
      isText2ImageTask.value

    if (!isSpawnResultTask && promptSubmitting.value) return

    if (!isSpawnResultTask) promptSubmitting.value = true
    persistPromptBarDraft()

    try {
      if (modelType.value === 'img2prompt' || isImg2PromptTask.value) {
        const syncedData = syncTextNodeImageSource(g, cell as Node)
        const referenceAssetIds = resolvePromptReferenceAssetIds(syncedData)
        const assetId = referenceAssetIds[0] || resolveImageAssetId(syncedData) || ''

        if (!assetId) {
          message.warning('请先连接或上传参考图片')
          return
        }

        const loadingData = {
          ...(cell.getData() as CanvasNodeData),
          mode: 'editor' as const,
          textGenState: 'loading' as const,
          textGenProgress: 0,
        }
        cell.setData(loadingData, { overwrite: true })

        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `img2prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        try {
          const created = normalizeGenerationTaskDetail(
            await api.createGenerationTask<GenerationTaskDetail>(
              {
                taskType: 'TEXT',
                capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                prompt: promptText.value.trim(),
                parameters: {
                  assetId,
                  prompt: promptText.value.trim(),
                },
                projectId: activeProjectId.value,
                nodeId,
                referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : [assetId],
              },
              idempotencyKey,
            ),
          )

          const taskId = created.id
          if (!taskId) {
            throw new Error('创建反推提示词任务失败')
          }
          userInfoStore.queryPointAccount();
          bindGenerationTaskId(cell as Node, taskId, 'TEXT')
          persistGenerationTaskBinding()

          const succeeded = await followTextGenerationTaskOnNode(cell as Node, taskId, {
            toHtml: plainTextToEditorHtml,
            onError: (reason) => message.error(reason),
          })

          if (!succeeded) return

          const data = { ...(cell.getData() as CanvasNodeData) }
          data.genPrompt = promptText.value
          cell.setData(data, { overwrite: true })
        } catch (error) {
          markTextGenerationNodeFailed(cell as Node)
          message.error(isRequestError(error) ? error.message : '反推提示词失败，请稍后重试')
          return
        }

        selectedNodeId.value = nodeId
        selectedKind.value = 'text'
        syncNodeSelectionHighlight(nodeId)
        activePickerNodeId.value = ''
        bumpToolbarRevision()
        updateNodeToolbar()
        scheduleHistoryPush()
        return
      }

      if (modelType.value === 'text2video' || isText2VideoTask.value) {
        const videoPayload = payload as VideoDialogueSubmitPayload | undefined
        const trimmedPrompt = (videoPayload?.prompt ?? promptText.value).trim()
        if (!trimmedPrompt) {
          message.warning('请输入视频描述')
          return
        }

        persistPromptBarDraft()
        const text2videoSettings = videoPayload
          ? buildVideoDialogueSettingsFromPayload({
              model: videoPayload.model,
              ratio: videoPayload.ratio,
              clarity: videoPayload.clarity,
              duration: videoPayload.duration,
              generateAudio: videoPayload.generateAudio,
              videoCount: videoPayload.videoCount,
              mode: videoPayload.mode ?? 'text-to-video',
            })
          : {
              ...createDefaultVideoDialogueSettings(),
              mode: 'text-to-video' as const,
            }
        const sourceData = cell.getData() as CanvasNodeData
        const requestedCount = Math.max(1, Math.floor(Number(text2videoSettings.videoCount)) || 1)
        const layoutSize = resolveVideoResultLayoutSize({
          ...sourceData,
          videoGenAspectRatio: text2videoSettings.aspectRatio,
          videoDialogueSettings: text2videoSettings,
        })
        const plannedPoints = planOutgoingResultPoints(
          g,
          cell as Node,
          layoutSize,
          requestedCount,
          'right',
        )
        const resultNode = spawnVideoGenerationResultNode(g, cell as Node, {
          title: '文生视频',
          fileName: '文生视频.mp4',
          videoDialogueText: trimmedPrompt,
          videoDialogueSettings: text2videoSettings,
          genPrompt: trimmedPrompt,
          centerPoint: plannedPoints[0],
        })
        applyVideoGenerationProvenance(resultNode, {
          prompt: trimmedPrompt,
          model: text2videoSettings.modelKey,
          ratio: text2videoSettings.aspectRatio,
          clarity: text2videoSettings.resolution,
          duration: text2videoSettings.duration,
          generateAudio: text2videoSettings.generateAudio,
          videoCount: text2videoSettings.videoCount,
          mode: text2videoSettings.mode,
        }, [])
        closeTextPromptBar()

        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `text2video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        const videoParameters: Record<string, unknown> = {
          mode: videoPayload?.mode ?? 'text-to-video',
          model: videoPayload?.model,
          ratio: videoPayload?.ratio ?? '16:9',
          clarity: toVideoApiClarity(videoPayload?.clarity ?? '720P'),
          duration: videoPayload?.duration ?? 5,
          generateAudio: videoPayload?.generateAudio ?? true,
          videoCount: videoPayload?.videoCount ?? 1,
        }

        try {
          const created = normalizeGenerationTaskDetail(
            await api.createGenerationTask<GenerationTaskDetail>(
              {
                taskType: 'VIDEO',
                capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                prompt: toVideoApiPrompt(trimmedPrompt),
                parameters: videoParameters,
                projectId: activeProjectId.value,
                nodeId: resultNode.id,
              },
              idempotencyKey,
            ),
          )

          const taskId = created.id
          if (!taskId) {
            throw new Error('创建文生视频任务失败')
          }
          userInfoStore.queryPointAccount();
          bindGenerationTaskId(resultNode, taskId, 'VIDEO')
          persistGenerationTaskBinding()

          startVideoGenerationTaskFollow(resultNode, taskId, {
            title: '文生视频',
            fileName: '文生视频.mp4',
            onError: (reason) => message.error(reason),
            onComplete: (success) => handleVideoGenerationTaskComplete(resultNode.id, success),
          })

          selectedNodeId.value = resultNode.id
          selectedKind.value = 'video'
          syncNodeSelectionHighlight(resultNode.id)
          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
          scheduleHistoryPush()
        } catch (error) {
          markVideoGenerationNodeFailed(resultNode)
          revealVideoDialogueAfterGenerationFailure(resultNode.id)
          message.error(isRequestError(error) ? error.message : '文生视频失败，请稍后重试')
        }
        return
      }

      if (modelType.value === 'text2image' || isText2ImageTask.value) {
        const imagePayload = payload as ImageDialogueSubmitPayload | undefined
        const trimmedPrompt = (imagePayload?.prompt ?? promptText.value).trim()
        if (!trimmedPrompt) {
          message.warning('请输入图片描述')
          return
        }

        persistPromptBarDraft()
        const imagePreviewSize = getNodeSize('image', 'editor', {
          kind: 'image',
          mode: 'editor',
          imageGenState: 'loading',
        })
        const [imageCenterPoint] = planOutgoingResultPoints(g, cell as Node, imagePreviewSize, 1, 'right')
        const resultNode = spawnGenerationResultNode(g, cell as Node, {
          title: '文生图',
          fileName: '文生图.png',
          centerPoint: imageCenterPoint,
        })
        closeTextPromptBar()

        const imageParameters: Record<string, unknown> = {
          model: imagePayload?.model,
          aspectRatio: imagePayload?.aspectRatio,
          count: imagePayload?.count ?? 1,
        }
        if (imagePayload?.resolution) {
          imageParameters.resolution = imagePayload.resolution
        }

        try {
          const sourceNode = cell as Node
          const sourceFileName = '文生图.png'
          const started = await startImageGenerationOnNode(resultNode, {
            title: '文生图',
            fileName: '文生图.png',
            createTask: async () => {
              const idempotencyKey =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `text2image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

              const created = await api.createGenerationTask<GenerationTaskDetail>(
                {
                  taskType: 'IMAGE',
                  capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                  prompt: trimmedPrompt,
                  parameters: imageParameters,
                  projectId: activeProjectId.value,
                  nodeId: resultNode.id,
                  workflowId: resolveGenerationTaskWorkflowId(imagePayload?.workflowId),
                },
                idempotencyKey,
              )
              userInfoStore.queryPointAccount()
              return created
            },
            onTaskBound: () => persistGenerationTaskBinding(),
            onError: (reason) => message.error(reason),
            onComplete: async (result) => {
              if (!result.success) return

              const extraResults = result.extraResults ?? []
              if (extraResults.length) {
                const totalCount = 1 + extraResults.length
                const extraNodes = await spawnNodesForExtraGenerationResults(
                  g,
                  sourceNode,
                  extraResults,
                  {
                    title: '文生图',
                    sourceFileName,
                    buildFileName: () => sourceFileName,
                    resultIndexOffset: 1,
                    totalCount,
                  },
                )

                if (extraNodes.length) {
                  syncNodeCount()
                  nextTick(() => {
                    const scroller = getScroller(g)
                    if (!scroller) return
                    const boxes = [resultNode, ...extraNodes].map((node) => node.getBBox())
                    const minX = Math.min(...boxes.map((box) => box.x))
                    const maxX = Math.max(...boxes.map((box) => box.x + box.width))
                    const minY = Math.min(...boxes.map((box) => box.y))
                    const maxY = Math.max(...boxes.map((box) => box.y + box.height))
                    scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, {
                      duration: '280ms',
                    })
                  })
                }
              }

              bumpToolbarRevision()
              updateNodeToolbar()
              scheduleHistoryPush()
            },
          })

          if (!started.started) return

          selectedNodeId.value = resultNode.id
          selectedKind.value = 'image'
          syncNodeSelectionHighlight(resultNode.id)
          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
          scheduleHistoryPush()
        } catch (error) {
          message.error(isRequestError(error) ? error.message : '文生图失败，请稍后重试')
        }
        return
      }

      if (modelType.value == 'free') {
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
        cell.setData(loadingData, { overwrite: true })

        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `text-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        try {
          const created = normalizeGenerationTaskDetail(
            await api.createGenerationTask<GenerationTaskDetail>(
              {
                taskType: 'TEXT',
                capabilityCode: 'TEXT_COPY_V1',
                prompt: trimmedPrompt,
                parameters: {
                  style: 'creative',
                },
                projectId: activeProjectId.value,
                nodeId,
              },
              idempotencyKey,
            ),
          )

          const taskId = created.id
          if (!taskId) {
            throw new Error('创建文案生成任务失败')
          }
          userInfoStore.queryPointAccount();
          bindGenerationTaskId(cell as Node, taskId, 'TEXT')
          persistGenerationTaskBinding()

          const succeeded = await followTextGenerationTaskOnNode(cell as Node, taskId, {
            toHtml: plainTextToEditorHtml,
            onError: (reason) => message.error(reason),
          })

          if (!succeeded) return

          const data = { ...(cell.getData() as CanvasNodeData) }
          data.genPrompt = trimmedPrompt
          data.promptBarPinned = true
          cell.setData(data, { overwrite: true })
        } catch (error) {
          markTextGenerationNodeFailed(cell as Node)
          message.error(isRequestError(error) ? error.message : '文案生成失败，请稍后重试')
          return
        }

        selectedNodeId.value = nodeId
        selectedKind.value = 'text'
        syncNodeSelectionHighlight(nodeId)
        bumpToolbarRevision()
        updateNodeToolbar()
        scheduleHistoryPush()
      }

      
    } finally {
      if (!isSpawnResultTask) promptSubmitting.value = false
    }
  }

  async function generateImageFromPrompt() {
    const g = graph.value
    const nodeId = activeImageGenPromptNodeId.value
    if (!g || !nodeId) return
    const cell = g.getCellById(nodeId)
    if (!cell?.isNode()) return
    const node = cell as Node

    const prompt = imageGenPromptText.value.trim()
    if (!prompt) {
      message.warning('请输入提示词')
      return
    }

    const currentData = node.getData() as CanvasNodeData
    if (currentData.imageGenState === 'loading') return

    imageGenSubmitting.value = true
    persistImageGenPrompt()

    node.setData({
      ...currentData,
      imageGenState: 'loading',
      imageGenProgress: 0,
      genPrompt: prompt,
    }, { overwrite: true })
    closeImageGenPromptBar()

    const referenceAssetIds = resolvePromptReferenceAssetIds(currentData)
    const fileName = currentData.fileName || currentData.title || '文生图.png'

    try {
      const outcome = await runImageGenerationOnNode(node, {
        title: currentData.title || '文生图',
        fileName,
        createTask: async () => {
          const idempotencyKey =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `img-prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

          const created = await api.createGenerationTask<GenerationTaskDetail>(
            {
              taskType: 'IMAGE',
              capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
              prompt,
              parameters: { count: 1 },
              projectId: activeProjectId.value,
              nodeId: node.id,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
            },
            idempotencyKey,
          )
          userInfoStore.queryPointAccount()
          return created; 
        },
        onTaskBound: () => persistGenerationTaskBinding(),
        onError: (reason) => message.error(reason),
      })

      if (!outcome.success) return

      selectedNodeId.value = nodeId
      selectedKind.value = 'image'
      syncNodeSelectionHighlight(nodeId)
      scheduleHistoryPush()
    } finally {
      imageGenSubmitting.value = false
      bumpToolbarRevision()
      updateNodeToolbar()
    }
  }

  function openVideoGenPromptBar(nodeId: string, tab = 'text2video') {
    closeImageGenPromptBar()

    const g = graph.value
    if (g) {
      const cell = g.getCellById(nodeId)
      if (cell?.isNode()) {
        const data = { ...(cell.getData() as CanvasNodeData) }
        if (data.kind === 'video' && data.mode === 'editor' && !data.previewUrl && !isVideoGenerationFailedNode(data)) {
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
    exitVideoGenCanvasPickMode()
  }

  function enterElementSelectMode(context: 'image-dialogue' | 'video-gen' = 'video-gen') {
    const returnId = context === 'image-dialogue'
      ? getActiveImageDialogueTargetNodeId()
      : activeVideoGenPromptNodeId.value
    if (!returnId) return
    elementSelectContext.value = context
    elementSelectReturnNodeId.value = returnId
    exitVideoGenCanvasPickMode()
    exitImageDialogueCanvasPickMode()
    showElementSelectMode.value = true
    bumpToolbarRevision()
  }

  function isImageMarkAnalysisInProgress() {
    if (imageMarkRecognizing.value) return true
    const g = graph.value
    return Boolean(g && isImageMarkAnalyzing(g))
  }

  function exitElementSelectMode(options?: { force?: boolean }) {
    showElementSelectMode.value = false
    elementSelectContext.value = null
    elementSelectReturnNodeId.value = ''

    if (!options?.force && isImageMarkAnalysisInProgress()) {
      // 分析进行中：仅退出元素选择 UI，保留节点「分析中」状态直至任务结束
      bumpToolbarRevision()
      return
    }

    imageMarkRecognizing.value = false
    const g = graph.value
    if (!g) return
    g.getNodes().forEach((cell) => {
      const node = cell as Node
      const data = node.getData() as CanvasNodeData
      if (data.imageMarkAnalyzing) {
        setImageMarkAnalyzing(node, null)
      }
    })
    bumpToolbarRevision()
  }

  function queueMentionInsert(token: string) {
    const trimmed = token.trim()
    if (!trimmed) return
    mentionInsertToken.value = trimmed
    mentionInsertSerial.value += 1
  }

  async function handleImageMarkRecognize(sourceNode: Node, event?: MouseEvent) {
    const g = graph.value
    if (!g || !showElementSelectMode.value || !event) return

    if (imageMarkRecognizing.value || isImageMarkAnalyzing(g)) {
      message.warning('正在分析标记，请等待完成后再试')
      return
    }

    const returnNodeId = elementSelectReturnNodeId.value
    if (!returnNodeId) return

    const sourceData = sourceNode.getData() as CanvasNodeData
    if (sourceData.kind !== 'image' || !sourceData.previewUrl) return

    const assetId = resolveImageAssetId(sourceData)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
      return
    }

    const point = clientPointToImageNaturalCoords(g, sourceNode, event.clientX, event.clientY)
    if (!point) {
      message.warning('请点击图片区域进行标记')
      return
    }

    imageMarkRecognizing.value = true
    setImageMarkAnalyzing(sourceNode, { x: point.x, y: point.y })
    bumpToolbarRevision()

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `image-mark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    try {
      const created = normalizeGenerationTaskDetail(
        await api.createGenerationTask<GenerationTaskDetail>(
          {
            taskType: 'TEXT',
            capabilityCode: 'IMAGE_MARK_RECOGNIZE',
            prompt: '',
            parameters: {
              assetId,
              x: point.x,
              y: point.y,
              imageWidth: point.imageWidth,
              imageHeight: point.imageHeight,
            },
            referenceAssetIds: [],
            projectId: activeProjectId.value,
            nodeId: '',
            workflowId: null,
          },
          idempotencyKey,
        ),
      )

      const taskId = created.id
      if (!taskId) {
        throw new Error('创建标记识别任务失败')
      }

      userInfoStore.queryPointAccount()

      const finalTask = isGenerationTaskTerminal(created.status)
        ? created
        : await pollGenerationTask(taskId)

      if (finalTask.status !== 'SUCCEEDED') {
        throw new Error(finalTask.error?.message || '标记识别失败')
      }

      const parsed = parseImageMarkRecognizeResult(finalTask, point)
      if (!parsed?.label) {
        throw new Error('未返回标记识别结果')
      }

      const mark = buildImageMarkItem({
        sourceNodeId: sourceNode.id,
        assetId,
        x: point.x,
        y: point.y,
        imageWidth: point.imageWidth,
        imageHeight: point.imageHeight,
        label: parsed.label,
        labelOptions: parsed.labelOptions,
        description: parsed.description,
        bbox: parsed.bbox,
      })

      appendImageMarkToNode(sourceNode, mark)

      const returnCell = g.getCellById(returnNodeId)
      if (returnCell?.isNode()) {
        appendElementMarkToNode(returnCell as Node, mark)
      }

      if (mark.mentionToken) {
        queueMentionInsert(mark.mentionToken)
      }

      message.success(`已识别：${mark.label}`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '标记识别失败，请稍后重试')
    } finally {
      imageMarkRecognizing.value = false
      setImageMarkAnalyzing(sourceNode, null)
      bumpToolbarRevision()
      scheduleHistoryPush()
    }
  }

  function updateImageMarkLabel(markId: string, selectedLabelIndex: number) {
    const g = graph.value
    if (!g || !markId) return

    let changed = false
    g.getNodes().forEach((cell) => {
      if (!cell.isNode()) return
      if (updateImageMarkLabelOnNode(cell as Node, markId, selectedLabelIndex)) {
        changed = true
      }
    })

    if (!changed) return

    bumpToolbarRevision()
    scheduleHistoryPush()
    if (showImageDialogue.value) persistImageDialogueFields()
    if (showVideoGenPromptBar.value) persistVideoGenPrompt()
  }

  function toggleImageDialogueMarkMode() {
    if (showElementSelectMode.value && elementSelectContext.value === 'image-dialogue') {
      exitElementSelectMode({ force: true })
      return
    }
    if (!getActiveImageDialogueTargetNodeId()) return
    enterElementSelectMode('image-dialogue')
  }

  function enterVideoGenCanvasPickMode() {
    exitElementSelectMode({ force: true })
    exitImageDialogueCanvasPickMode()
    showVideoGenCanvasPickMode.value = true
  }

  function exitVideoGenCanvasPickMode() {
    showVideoGenCanvasPickMode.value = false
  }

  function toggleVideoGenCanvasPickMode() {
    if (showVideoGenCanvasPickMode.value) {
      exitVideoGenCanvasPickMode()
      return
    }
    enterVideoGenCanvasPickMode()
  }

  function enterImageDialogueCanvasPickMode() {
    exitElementSelectMode({ force: true })
    exitVideoGenCanvasPickMode()
    const targetId = getActiveImageDialogueTargetNodeId()
    if (!targetId) return
    if (!activeImageDialogueNodeId) {
      activeImageDialogueNodeId = targetId
    }
    showImageDialogueCanvasPickMode.value = true
  }

  function exitImageDialogueCanvasPickMode() {
    showImageDialogueCanvasPickMode.value = false
  }

  function toggleImageDialogueCanvasPickMode() {
    if (showImageDialogueCanvasPickMode.value) {
      exitImageDialogueCanvasPickMode()
      return
    }
    if (!getActiveImageDialogueTargetNodeId()) return
    enterImageDialogueCanvasPickMode()
  }

  async function handleImageDialogueCanvasPick(nodeId: string) {
    const targetNodeId = getActiveImageDialogueTargetNodeId()
    if (!targetNodeId || !nodeId || nodeId === targetNodeId) return

    const g = graph.value
    if (!g) return

    const source = g.getCellById(nodeId)
    if (!source?.isNode()) return

    const sourceData = source.getData() as CanvasNodeData
    if (
      sourceData.kind !== 'image' ||
      !sourceData.previewUrl ||
      sourceData.uploadState === 'uploading' ||
      sourceData.imageGenTask === 'picker'
    ) {
      return
    }

    if (hasImageDialogueSourceRef(targetNodeId, nodeId, sourceData.previewUrl)) {
      message.info('该图片已添加')
      return
    }

    const linked = await linkImageNodeToImageDialogue(nodeId, targetNodeId)
    if (linked) {
      message.success('已添加参考图')
      bumpToolbarRevision()
      restoreCanvasPickTargetSelection()
    }
  }

  async function handleVideoGenCanvasPick(nodeId: string) {
    const g = graph.value
    const videoNodeId = getActiveVideoTargetNodeId()
    if (!g || !videoNodeId || !nodeId || nodeId === videoNodeId) return

    const source = g.getCellById(nodeId)
    if (!source?.isNode()) return

    const sourceData = source.getData() as CanvasNodeData
    if (
      sourceData.kind !== 'image' ||
      !sourceData.previewUrl ||
      sourceData.uploadState === 'uploading' ||
      sourceData.imageGenTask === 'picker'
    ) {
      return
    }

    if (findImageToVideoEdge(g, nodeId, videoNodeId)) {
      message.info('该图片已添加')
      return
    }

    const currentCount = getVideoSourceRefs(g, videoNodeId).length
    if (currentCount >= getVideoGenSourceLimit()) {
      message.warning('参考图数量已达上限')
      return
    }

    const linked = await linkImageNodeToVideoGen(nodeId)
    if (linked) {
      message.success('已添加参考图')
      bumpToolbarRevision()
      restoreCanvasPickTargetSelection()
    }
  }

  function returnFromElementSelect() {
    const returnId = elementSelectReturnNodeId.value
    const context = elementSelectContext.value
    exitElementSelectMode({ force: true })
    if (!returnId) return
    const g = graph.value
    const cell = g?.getCellById(returnId)
    if (!cell?.isNode()) return
    selectedNodeId.value = returnId
    if (context === 'image-dialogue') {
      selectedKind.value = 'image'
      syncNodeSelectionHighlight(returnId)
      openImageDialogue(returnId)
      updateNodeToolbar()
      return
    }
    selectedKind.value = 'video'
    syncNodeSelectionHighlight(returnId)
    openVideoGenPromptBar(returnId, videoGenActiveTab.value)
    updateNodeToolbar()
  }

  function onVideoGenQuickAction(key: string) {
    if (key === 'mark') {
      if (showElementSelectMode.value && elementSelectContext.value === 'video-gen') {
        exitElementSelectMode({ force: true })
        return
      }
      enterElementSelectMode('video-gen')
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

  function setConnectSourceNodeMetaHidden(hidden: boolean) {
    const g = graph.value
    const sourceId = connectSourceNodeId.value
    if (!g || !sourceId) return

    const cell = g.getCellById(sourceId)
    if (!cell?.isNode()) return

    const data = cell.getData() as CanvasNodeData
    if (Boolean(data.hideNodeMeta) === hidden) return
    cell.setData({ ...data, hideNodeMeta: hidden })
  }

  function closeConnectMenu() {
    setConnectSourceNodeMetaHidden(false)
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

  async function selectProject(projectId: string) {
    if (projectId === activeProjectId.value) {
      closeProjectMenu()
      return
    }

    const currentRoute = router.currentRoute.value
    if (currentRoute.params.id === projectId) {
      activeProjectId.value = projectId
      closeProjectMenu()
      return
    }

    try {
      await router.replace({
        name: currentRoute.name ?? undefined,
        params: { ...currentRoute.params, id: projectId },
      })
      activeProjectId.value = projectId
      closeProjectMenu()
    } catch (error) {
      if (isNavigationFailure(error, NavigationFailureType.aborted)) return
      console.error('[Canvas] switch project failed', error)
    }
  }

  async function onLoadProjects() {
    try {
      const res = await api.getProjects<Project>({
        page: 1,
        pageSize: 10,
      })
      canvasProjects.value = res.records
    } catch (error) {
      console.error('[Canvas] load projects failed', error)
    }
  }

  function upsertCanvasProject(id: string, title: string, saved = true) {
    const item = canvasProjects.value.find((project) => project.id === id)
    if (item) {
      item.title = title
      item.saved = saved
      return
    }
    const now = new Date().toISOString()
    canvasProjects.value.unshift({
      id,
      title,
      saved,
      createdAt: now,
      updatedAt: now,
    })
  }

  function resumeCanvasGenerationTasks() {
    const g = graph.value
    if (!g) return

    const resumeOptions = {
      toHtml: plainTextToEditorHtml,
      onError: (reason: string) => message.error(reason),
      onTaskBound: () => persistGenerationTaskBinding(),
      onTaskComplete: () => persistGenerationTaskBinding(),
      onVideoGenerationComplete: (nodeId: string, success: boolean) => {
        if (!success) revealVideoDialogueAfterGenerationFailure(nodeId)
      },
    }

    void (async () => {
      const projectId = activeProjectId.value
      if (projectId) {
        await recoverOrphanedGenerationTasks(g, projectId, {
          onTaskBound: resumeOptions.onTaskBound,
        })
      }
      await resumePendingGenerationTasks(g, resumeOptions)
    })()
  }

  function applyProjectCanvasPayload(payload: ProjectCanvasResponse) {
    const g = graph.value
    if (!g) return false

    resetResumedGenerationTaskCache()

    const canvasData = payload.canvasData ?? payload.canvas
    if (!canvasData) return false

    activeProjectId.value = payload.projectId
    canvasRevision.value = payload.revision

    const snapshot = normalizeCanvasSnapshot(canvasData as Partial<CanvasSnapshot>, {
      projectId: payload.projectId,
      projectName: canvasData.meta?.projectName ?? '未命名创作',
    })

    upsertCanvasProject(payload.projectId, snapshot.meta.projectName, true)

    if (snapshot.meta.canvasBgTheme === 'dark' || snapshot.meta.canvasBgTheme === 'light') {
      canvasBgTheme.value = snapshot.meta.canvasBgTheme
    }
    gridVisible.value = snapshot.meta.gridVisible
    panMode.value = snapshot.meta.panMode
    showMinimap.value = snapshot.meta.showMinimap
    applyCanvasBgTheme(g, canvasBgTheme.value, gridVisible.value)

    applyCanvasSnapshot(g, snapshot)

    getScroller(g)?.togglePanning(panMode.value)
    setRubberbandEnabled(!panMode.value)
    if (showMinimap.value) {
      setupMinimap()
    } else {
      teardownMinimap()
    }

    syncNodeCount()
    syncZoom()
    canvasHistory?.seed(g)
    syncHistoryState()

    nextTick(() => {
      syncAllNodeSizes(g)
      refreshCanvasNodeViews(g)
      ensureInfiniteCanvasArea(g)
      syncViewportNodeVisibility()
      updateNodeToolbar()
      bumpToolbarRevision()
      resumeCanvasGenerationTasks()

      void hydrateMissingImageNodeDimensions(g).finally(() => {
        syncAllNodeSizes(g)
        refreshCanvasNodeViews(g)
        ensureInfiniteCanvasArea(g)
        syncViewportNodeVisibility()
        updateNodeToolbar()
        bumpToolbarRevision()
      })
    })

    return true
  }

  function stopAutoSave() {
    autoSaveEnabled = false
    canvasContentReady = false
    if (autoSaveDebounceTimer) {
      clearTimeout(autoSaveDebounceTimer)
      autoSaveDebounceTimer = null
    }
    pendingRemoteSaveType = null
  }

  function triggerAutoSaveIfReady() {
    if (!autoSaveEnabled || !canvasContentReady) return
    if (autoSaveDebounceTimer) clearTimeout(autoSaveDebounceTimer)
    autoSaveDebounceTimer = setTimeout(() => {
      autoSaveDebounceTimer = null
      handleSaveCanvas('AUTO')
    }, 280)
  }

  function markCanvasContentReady() {
    canvasContentReady = true
  }

  function onPageUnload() {
    stopAutoSave()
  }

  function loadProjectCanvas(payload: ProjectCanvasResponse) {
    pendingProjectCanvas = payload
    const loaded = applyProjectCanvasPayload(payload)
    if (loaded) {
      pendingProjectCanvas = null
      markCanvasContentReady()
    }
    return loaded
  }

  function buildCanvasSnapshot(): CanvasSnapshot | null {
    const g = graph.value
    if (!g) return null

    persistImageDialogueFields()
    persistVideoDialogueFields()

    return getCanvasSnapshot(g, {
      projectId: activeProjectId.value,
      projectName: currentProjectName.value,
      canvasBgTheme: canvasBgTheme.value,
      gridVisible: gridVisible.value,
      panMode: panMode.value,
      showMinimap: showMinimap.value,
    })
  }

  function mergePendingSaveType(saveType: 'MANUAL' | 'AUTO'): 'MANUAL' | 'AUTO' {
    if (pendingRemoteSaveType === 'MANUAL' || saveType === 'MANUAL') return 'MANUAL'
    return 'AUTO'
  }

  function extractLatestRevision(error: unknown): number | null {
    if (!isRequestError(error)) return null
    if (error.code !== 'CANVAS_REVISION_CONFLICT') return null
    const data = error.data
    if (data == null || typeof data !== 'object') return null
    const latestRevision = (data as { latestRevision?: unknown }).latestRevision
    return typeof latestRevision === 'number' ? latestRevision : null
  }

  async function persistCanvasToServer(
    projectId: string,
    snapshot: CanvasSnapshot,
    saveType: 'MANUAL' | 'AUTO',
    project?: (typeof canvasProjects.value)[number],
  ) {
    const sendSave = (revision: number) =>
      api.saveProjectCanvas(projectId, {
        revision,
        saveType,
        canvasData: snapshot,
      })

    try {
      const res = await sendSave(canvasRevision.value)
      if (typeof res.revision === 'number') {
        canvasRevision.value = res.revision
      }
      if (project) project.saved = true
      if (saveType === 'MANUAL') {
        console.info('[Canvas] saved to server', res)
      }
      return
    } catch (error) {
      const latestRevision = extractLatestRevision(error)
      if (latestRevision == null) throw error

      canvasRevision.value = latestRevision
      const freshSnapshot = buildCanvasSnapshot() ?? snapshot
      const res = await api.saveProjectCanvas(projectId, {
        revision: canvasRevision.value,
        saveType,
        canvasData: freshSnapshot,
      })
      if (typeof res.revision === 'number') {
        canvasRevision.value = res.revision
      }
      if (project) project.saved = true
      if (saveType === 'MANUAL') {
        console.info('[Canvas] saved to server after revision sync', res)
      }
    }
  }

  async function flushRemoteCanvasSave(saveType: 'MANUAL' | 'AUTO') {
    if (!autoSaveEnabled) return
    if (saveType === 'AUTO' && !canvasContentReady) return
    if (saveInFlight) {
      pendingRemoteSaveType = mergePendingSaveType(saveType)
      return
    }

    const projectId = activeProjectId.value
    if (!projectId) return

    const snapshot = buildCanvasSnapshot()
    if (!snapshot) return

    const project = canvasProjects.value.find((item) => item.id === projectId)
    saveInFlight = true
    pendingRemoteSaveType = null

    try {
      if (!autoSaveEnabled) return
      await persistCanvasToServer(projectId, snapshot, saveType, project)
    } catch (error) {
      console.error('[Canvas] save to server failed', error)
      if (project) project.saved = false
    } finally {
      saveInFlight = false
      if (pendingRemoteSaveType && autoSaveEnabled) {
        const nextSaveType = pendingRemoteSaveType
        pendingRemoteSaveType = null
        void flushRemoteCanvasSave(nextSaveType)
      }
    }
  }

  function handleSaveCanvas(saveType: 'MANUAL' | 'AUTO' = 'MANUAL') {
    if (!autoSaveEnabled) return
    if (saveType === 'AUTO' && !canvasContentReady) return
    const snapshot = buildCanvasSnapshot()
    if (!snapshot) return

    saveCanvasSnapshotToStorage(snapshot)

    const projectId = activeProjectId.value
    const project = canvasProjects.value.find((item) => item.id === projectId)
    if (project) {
      project.saved = false
    }

    if (!projectId) {
      if (saveType === 'MANUAL') {
        console.warn('[Canvas] skip remote save: missing projectId')
      }
      return
    }

    void flushRemoteCanvasSave(saveType)
  }

  /** 当前项目是否有未落库的更改（含保存进行中） */
  function hasUnsavedChanges() {
    const projectId = activeProjectId.value
    if (!projectId) return false
    if (saveInFlight || pendingRemoteSaveType) return true
    const project = canvasProjects.value.find((item) => item.id === projectId)
    return project?.saved === false
  }

  function persistGenerationTaskBinding() {
    scheduleHistoryPush()
  }

  function handleExportCanvas() {
    const g = graph.value
    if (!g) return

    persistImageDialogueFields()
    persistVideoDialogueFields()

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
    closeNodeDialoguePanels()
    setTextEditorToolbarActive(false)
    if (connectSourceNodeId.value && connectSourceNodeId.value !== source.id) {
      setConnectSourceNodeMetaHidden(false)
    }
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
    setConnectSourceNodeMetaHidden(true)
    // 仅吞掉打开菜单同一次 mouseup 随后触发的 blank:click，避免立刻关掉。
    // 用 setTimeout(0) 在 click 事件之后清 flag，避免 nextTick 过早清掉导致菜单闪关，
    // 也避免 flag 粘住导致后续点击画布关不掉。
    ;(g as CanvasGraph).__suppressBlankCloseForConnect = true
    window.setTimeout(() => {
      ;(g as CanvasGraph).__suppressBlankCloseForConnect = false
    }, 0)
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

    // 文生图 / 图生图目标节点：在其下方打开图片生成提示栏
    if (data.kind === 'image') {
      const sourceData = source.getData() as CanvasNodeData
      if (
        shouldOpenImageGenPromptBar(g, spawned.id, data) ||
        sourceData.kind === 'text'
      ) {
        openImageGenPromptBar(spawned.id)
      } else {
        openImageDialogue(spawned.id)
      }
    } else if (data.kind === 'video' && data.mode === 'picker') {
      const sourceData = source.getData() as CanvasNodeData
      const tab =
        sourceData.kind === 'text'
          ? 'text2video'
          : sourceData.kind === 'image'
            ? 'reference'
            : 'text2video'
      openVideoGenPromptBar(spawned.id, tab)
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
        return
      }
      edge.setAttrs(getFlowEdgeAttrs())
      applyFlowEdgeStyle(g, edge)
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
    edge.setAttrs(getPreviewEdgeAttrs())
    applyFlowEdgeStyle(g, edge)
    openConnectMenu(source as Node, releasePoint)
  }

  /** 将源图片节点追加到目标图片节点的输入源列表（按 nodeId 去重，支持多个不同源节点连入） */
  function applyIncomingImageSource(target: Node, source: Node) {
    if (source.id === target.id) return false
    const sourceData = source.getData() as CanvasNodeData
    const data = { ...(target.getData() as CanvasNodeData) }

    const ref: ImageSourceRef = {
      nodeId: source.id,
      assetId: sourceData.assetId,
      previewUrl: sourceData.previewUrl ?? '',
      fileName: sourceData.fileName ?? '',
    }
    const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : []
    // 兼容生成节点时写入的单一来源（如节点3 由节点1 连线生成），首次追加时先补回原始来源
    if (!refs.length && data.sourceNodeId && data.sourcePreviewUrl) {
      refs.push({
        nodeId: data.sourceNodeId,
        assetId: data.sourceAssetId,
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
    data.sourceAssetId = ref.assetId
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

  function onRemoveImageGenSourceRef(sourceNodeId: string) {
    const g = graph.value
    const imageNodeId = activeImageGenPromptNodeId.value
    if (!g || !imageNodeId || !sourceNodeId) return

    g.getEdges().forEach((edge) => {
      if (
        edge.getSourceCellId() === sourceNodeId &&
        edge.getTargetCellId() === imageNodeId
      ) {
        g.removeEdge(edge.id)
      }
    })

    if (activeImageGenPromptNodeId.value === imageNodeId) {
      loadImageGenPromptFields(imageNodeId)
    }
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()
  }

  function onRemoveVideoSourceRef(sourceNodeId: string) {
    const g = graph.value
    const videoNodeId = getActiveVideoTargetNodeId()
    if (!g || !videoNodeId || !sourceNodeId) return

    const cell = g.getCellById(videoNodeId)
    if (!cell?.isNode()) return
    const data = { ...(cell.getData() as CanvasNodeData) }

    const sourceCell = g.getCellById(sourceNodeId)
    const sourceData = sourceCell?.isNode()
      ? (sourceCell.getData() as CanvasNodeData)
      : undefined

    if (sourceData?.kind === 'text') {
      g.getEdges().forEach((edge) => {
        if (
          edge.getSourceCellId() === sourceNodeId &&
          edge.getTargetCellId() === videoNodeId
        ) {
          g.removeEdge(edge.id)
        }
      })
    } else {
      disconnectImageFromVideo(g, sourceNodeId, videoNodeId)
      const fromStored = Array.isArray(data.videoSourceRefs) ? data.videoSourceRefs : []
      const live = getVideoSourceRefs(g, videoNodeId)
      const base = fromStored.length ? fromStored : toPersistedVideoSourceRefs(live)
      data.videoSourceRefs = base.filter((item) => item.nodeId !== sourceNodeId)
      cell.setData(data, { overwrite: true })
    }

    if (activeVideoGenPromptNodeId.value === videoNodeId) {
      loadVideoGenPromptFields(videoNodeId)
    }
    bumpToolbarRevision()
    updateNodeToolbar()
    scheduleHistoryPush()
  }

  function getVideoGenSourceLimit() {
    const tab = activeVideoGenPromptNodeId.value ? videoGenActiveTab.value : 'reference'
    const rule = VIDEO_GEN_TAB_IMAGE_RULES[tab]
    return rule?.max ?? 9
  }

  async function linkImageNodeToVideoGen(imageNodeId: string) {
    const g = graph.value
    const videoNodeId = getActiveVideoTargetNodeId()
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
    syncVideoSourceRefsSnapshot(videoNodeId)
    bumpToolbarRevision()
    scheduleHistoryPush()
    return true
  }

  async function onVideoGenUploadFiles(files: File[]) {
    const g = graph.value
    const videoNodeId = getActiveVideoTargetNodeId()
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
      next.sourceAssetId = latest?.assetId ?? ''
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

  function handleVideoPickerAction(key: string, nodeId: string) {
    const g = graph.value
    if (!g) return

    selectedNodeId.value = nodeId
    selectedKind.value = 'video'
    syncNodeSelectionHighlight(nodeId)
    openVideoGenPromptBar(nodeId, key)
    bumpToolbarRevision()
    updateNodeToolbar()
  }

  function handleTextPickerAction(key: string, nodeId: string) {
    const g = graph.value
    if (!g) return

    selectedNodeId.value = nodeId
    selectedKind.value = 'text'
    syncNodeSelectionHighlight(nodeId)

    if (key === 'write') {
      activePickerNodeId.value = ''
      modelType.value = 'free'
      setTextEditorToolbarActive(false)
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }

    if (key === 'text2image') {
      const cell = g.getCellById(nodeId)
      if (!cell?.isNode()) return

      const spawned = createNodeFromConnectMenu(
        g,
        cell as Node,
        getLinkedSpawnPoint(cell as Node, 'image', {
          mode: 'editor',
          imageGenTask: 'picker',
          imageGenState: 'idle',
        }),
        'image',
      )
      if (spawned) {
        finishConnectSpawn(spawned)
        openImageGenPromptBar(spawned.id)
      }
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }

    if (key === 'text2video') {
      const cell = g.getCellById(nodeId)
      if (!cell?.isNode()) return

      const data = { ...(cell.getData() as CanvasNodeData) }
      data.mode = 'picker'
      data.textPickerTask = key
      data.textGenState = 'idle'
      cell.setData(data)

      modelType.value = 'text2video'

      activePickerNodeId.value = nodeId
      loadPromptBarContext(nodeId)
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }

    if (key === 'img2prompt') {
      const cell = g.getCellById(nodeId)
      if (!cell?.isNode()) return

      const data = { ...(cell.getData() as CanvasNodeData) }
      data.mode = 'picker'
      data.textPickerTask = key
      data.textGenState = 'idle'
      if (!data.genPrompt?.trim()) {
        data.genPrompt = IMG2PROMPT_DEFAULT_INSTRUCTION
      }
      cell.setData(data)

      syncTextNodeImageSource(g, cell as Node)
      modelType.value = 'img2prompt'

      activePickerNodeId.value = nodeId
      loadPromptBarContext(nodeId)
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
    } else if (data.kind === 'video') {
      syncVideoSourceRefsSnapshot(targetNodeId)
      const source =
        sourceNodeId && g.getCellById(sourceNodeId)?.isNode()
          ? (g.getCellById(sourceNodeId) as Node)
          : null
      const sourceData = source?.getData() as CanvasNodeData | undefined
      if (
        sourceData?.kind === 'text' &&
        data.mode === 'picker' &&
        !data.previewUrl &&
        data.uploadState !== 'uploading'
      ) {
        selectedNodeId.value = targetNodeId
        selectedKind.value = 'video'
        syncNodeSelectionHighlight(targetNodeId)
        openVideoGenPromptBar(targetNodeId, 'text2video')
      }
      if (activeVideoGenPromptNodeId.value === targetNodeId) {
        loadVideoGenPromptFields(targetNodeId)
      }
    } else if (data.kind === 'image') {
      const source =
        sourceNodeId && g.getCellById(sourceNodeId)?.isNode()
          ? (g.getCellById(sourceNodeId) as Node)
          : null
      const sourceData = source?.getData() as CanvasNodeData | undefined

      if (
        sourceData?.kind === 'text' &&
        shouldOpenImageGenPromptBar(g, targetNodeId, data)
      ) {
        selectedNodeId.value = targetNodeId
        selectedKind.value = 'image'
        syncNodeSelectionHighlight(targetNodeId)
        openImageGenPromptBar(targetNodeId)
      } else if (
        canImageNodeAcceptIncoming(data) &&
        source?.isNode() &&
        sourceData?.kind === 'image'
      ) {
        applyIncomingImageSource(cell as Node, source)
        openImageDialogue(targetNodeId)
      }

      if (activeImageGenPromptNodeId.value === targetNodeId) {
        loadImageGenPromptFields(targetNodeId)
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
      if (Boolean(data.isSelected) === isSelected) {
        return
      }
      node.setData({ ...data, isSelected })
    })
  }

  function syncSelectionFromGraph() {
    const g = graph.value
    if (!g) return

    if (showVideoGenCanvasPickMode.value || showImageDialogueCanvasPickMode.value) {
      restoreCanvasPickTargetSelection()
      return
    }

    const prevDialogueNodeId = activeImageDialogueNodeId
    const prevVideoDialogueNodeId = activeVideoDialogueNodeId
    const ids = getGraphSelectedNodeIds()
    selectedNodeIds.value = ids

    if (ids.length > 0) {
      selectedEdgeId.value = ''
      clearEdgeHoverState()
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

    if (prevDialogueNodeId && prevDialogueNodeId !== selectedNodeId.value) {
      persistImageDialogueFields(prevDialogueNodeId)
    }
    if (prevVideoDialogueNodeId && prevVideoDialogueNodeId !== selectedNodeId.value) {
      persistVideoDialogueFields(prevVideoDialogueNodeId)
    }
    if (showImageDialogue.value && selectedNodeId.value && selectedKind.value === 'image') {
      loadImageDialogueFields(selectedNodeId.value)
    } else if (!selectedNodeId.value) {
      activeImageDialogueNodeId = ''
    }
    if (showVideoDialogue.value && selectedNodeId.value && selectedKind.value === 'video') {
      loadVideoDialogueFields(selectedNodeId.value)
    } else if (!selectedNodeId.value) {
      activeVideoDialogueNodeId = ''
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

  function syncEdgeHighlight() {
    const g = graph.value
    if (!g) return
    syncEdgeSelectionHighlight(g, selectedEdgeId.value, hoveredEdgeId.value)
  }

  let edgeHoverLeaveTimer = 0

  function updateEdgeDeleteButtonPosition() {
    const g = graph.value
    const root = canvasRef.value
    const id = hoveredEdgeId.value
    if (!g || !root || !id) return

    const edge = g.getCellById(id)
    if (!edge?.isEdge() || !isPersistedEdge(edge as Edge)) {
      hoveredEdgeId.value = ''
      return
    }

    edgeDeleteBtnPos.value = getEdgeDeleteButtonPosition(g, edge as Edge, root)
  }

  function clearEdgeHoverState() {
    window.clearTimeout(edgeHoverLeaveTimer)
    hoveredEdgeId.value = ''
    syncEdgeHighlight()
  }

  function handleEdgeMouseEnter({ edge }: { edge: Edge }) {
    if (!isPersistedEdge(edge)) return

    window.clearTimeout(edgeHoverLeaveTimer)
    hoveredEdgeId.value = edge.id
    syncEdgeHighlight()
    updateEdgeDeleteButtonPosition()
  }

  function handleEdgeMouseLeave() {
    window.clearTimeout(edgeHoverLeaveTimer)
    edgeHoverLeaveTimer = window.setTimeout(() => {
      hoveredEdgeId.value = ''
      syncEdgeHighlight()
    }, 120)
  }

  function handleEdgeDeletePointerEnter() {
    window.clearTimeout(edgeHoverLeaveTimer)
  }

  function handleEdgeDeletePointerLeave() {
    handleEdgeMouseLeave()
  }

  function removeHoveredEdge() {
    const id = hoveredEdgeId.value
    if (!id) return

    selectedEdgeId.value = id
    hoveredEdgeId.value = ''
    removeSelectedEdge()
  }

  const showEdgeDeleteButton = computed(
    () => Boolean(hoveredEdgeId.value),
  )

  function clearEdgeSelection() {
    const g = graph.value
    if (!g || !selectedEdgeId.value) return
    selectedEdgeId.value = ''
    syncEdgeHighlight()
  }

  function handleEdgeClick({ edge, e }: { edge: Edge; e?: MouseEvent }) {
    // 预览连线（添加上下文）上的点击应关闭菜单，而非忽略
    if (!isPersistedEdge(edge)) {
      if (showConnectMenu.value) {
        e?.stopPropagation()
        closeConnectMenu()
      }
      return
    }
    e?.stopPropagation()

    const g = graph.value
    if (!g) return

    if (showConnectMenu.value) {
      closeConnectMenu()
    }

    g.cleanSelection()
    selectedNodeId.value = ''
    selectedNodeIds.value = []
    selectedKind.value = null
    syncNodeSelectionHighlight([])

    selectedEdgeId.value = edge.id
    syncEdgeHighlight()
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
    clearEdgeHoverState()

    if (relation?.targetId === activePickerNodeId.value) {
      loadPromptBarContext(relation.targetId)
    }
    if (relation?.targetId === activeImageGenPromptNodeId.value) {
      loadImageGenPromptFields(relation.targetId)
    }
    if (relation?.targetId) {
      const targetCell = g.getCellById(relation.targetId)
      const targetData = targetCell?.getData() as CanvasNodeData | undefined
      if (targetData?.kind === 'video') {
        syncVideoSourceRefsSnapshot(relation.targetId)
      }
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
    // 文生视频/文生图底栏控件与对话面板一致，需要更宽布局
    if (isText2VideoTask.value || isText2ImageTask.value) {
      const containerRect = overlayRoot.getBoundingClientRect()
      const maxWidth = Math.min(720, containerRect.width - 48)
      promptPos.value = {
        ...promptPos.value,
        width: Math.min(maxWidth, Math.max(promptPos.value.width, 680)),
      }
    }
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

  function onImageInpaintDragStart(event: MouseEvent) {
    const startX = event.clientX
    const startY = event.clientY
    const base = { ...imageInpaintDragOffset.value }

    const onMove = (moveEvent: MouseEvent) => {
      imageInpaintDragOffset.value = {
        x: base.x + (moveEvent.clientX - startX),
        y: base.y + (moveEvent.clientY - startY),
      }
      updateNodeToolbar()
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function onImageExpandDragStart(event: MouseEvent) {
    const startX = event.clientX
    const startY = event.clientY
    const base = { ...imageExpandDragOffset.value }

    const onMove = (moveEvent: MouseEvent) => {
      imageExpandDragOffset.value = {
        x: base.x + (moveEvent.clientX - startX),
        y: base.y + (moveEvent.clientY - startY),
      }
      updateNodeToolbar()
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

  function updateNodeToolbar(options?: { skipImageResizeOverlay?: boolean }) {
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
    if (!g || !overlayRoot || !id) {
      if (!options?.skipImageResizeOverlay) {
        updateImageResizeOverlay()
      }
      return
    }

    const cell = g.getCellById(id)
    if (!cell?.isNode()) {
      if (!options?.skipImageResizeOverlay) {
        updateImageResizeOverlay()
      }
      return
    }

    const data = cell.getData() as CanvasNodeData
    selectedKind.value = data.kind
    const node = cell as Node
    toolbarPos.value = getNodeToolbarPosition(g, node, overlayRoot)
    dialoguePos.value = getNodeDialoguePosition(g, node, overlayRoot)
    if (showImageCrop.value) {
      imageCropPos.value = getNodeCropOverlayPosition(g, node, overlayRoot)
    }
    if (showImageGridSplit.value) {
      syncImageNodeSizeToMediaAspect(node)
      const box = getImageNodeMediaScreenBox(g, node, overlayRoot)
      imageGridSplitPos.value = {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }
    }
    if (showImageErase.value) {
      imageErasePos.value = getNodeCropOverlayPosition(g, node, overlayRoot)
    }
    if (showImageInpaint.value) {
      const base = getNodeCropOverlayPosition(g, node, overlayRoot, 520, 520)
      imageInpaintPos.value = {
        ...base,
        left: base.left + imageInpaintDragOffset.value.x,
        top: base.top + imageInpaintDragOffset.value.y,
      }
    }
    if (showImageExpand.value) {
      syncImageNodeSizeToMediaAspect(node)
      imageExpandPos.value = getImageExpandOverlayLayout(g, node, overlayRoot)
    }
    if (showImageEditText.value) {
      const panelHeight = Math.max(320, node.getBBox().height)
      const base = getNodeSidePanelPosition(g, node, overlayRoot, 380, panelHeight)
      imageEditTextPos.value = {
        left: base.left,
        top: base.top,
        width: base.width,
        height: panelHeight,
      }
    }
    if (data.kind === 'video' && showVideoHdPanel.value) {
      videoHdPos.value = getNodeSidePanelPosition(g, node, overlayRoot)
    }
    if (!options?.skipImageResizeOverlay) {
      updateImageResizeOverlay()
    }
  }

  function paintImageResizeOverlay(
    box: {
      left: number
      top: number
      width: number
      height: number
      dimensionLabel: string
      nodeId: string
    } | null,
  ) {
    if (!box) {
      showImageResizeOverlay.value = false
      nodeOverlaysRef.value?.applyImageResizeOverlayBox(null)
      return
    }

    imageResizeOverlay.value = box
    showImageResizeOverlay.value = true
    nodeOverlaysRef.value?.applyImageResizeOverlayBox(box)
  }

  function updateImageResizeOverlay() {
    paintImageResizeOverlay(null)
  }

  function onImageResizePointerDown(event: MouseEvent, corner: ImageResizeCorner) {
    const g = graph.value
    const id = imageResizeOverlay.value.nodeId
    if (!g || !id) return

    const cell = g.getCellById(id)
    if (!cell?.isNode()) return

    startImageNodeCornerResize(g, cell as Node, event, corner, () => {
      updateImageResizeOverlay()
      updateNodeToolbar()
      bumpToolbarRevision()
    })
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
    const types = Array.from(event.dataTransfer?.types ?? [])
    return (
      types.includes('Files')
      || types.includes(CANVAS_ASSET_DRAG_TYPE)
      || types.includes(CANVAS_ELEMENT_GROUP_DRAG_TYPE)
      || isCanvasAssetDragActive()
    )
  }

  function parseCanvasAssetDragPayload(raw: string): CanvasAssetDragPayload | null {
    if (!raw) return null
    try {
      const payload = JSON.parse(raw) as CanvasAssetDragPayload
      return payload.previewUrl ? payload : null
    } catch {
      return null
    }
  }

  function parseCanvasElementGroupDragPayload(raw: string): CanvasElementGroupDragPayload | null {
    if (!raw) return null
    try {
      const payload = JSON.parse(raw) as CanvasElementGroupDragPayload
      return payload.structureJson != null ? payload : null
    } catch {
      return null
    }
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
    scheduleHistoryPush({ autoSave: false })
  }

  function onCanvasDragEnter(event: DragEvent) {
    if (!hasCanvasFileDrag(event)) return
    canvasFileDragDepth.value += 1
    isCanvasFileDragOver.value = true
  }

  function onCanvasDragOver(event: DragEvent) {
    if (!hasCanvasFileDrag(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function onCanvasDragLeave(event: DragEvent) {
    if (!hasCanvasFileDrag(event)) return
    canvasFileDragDepth.value = Math.max(0, canvasFileDragDepth.value - 1)
    if (canvasFileDragDepth.value === 0) {
      isCanvasFileDragOver.value = false
    }
  }

  function handleCanvasAssetDrop(event: DragEvent) {
    const g = graph.value
    if (!g) return

    canvasFileDragDepth.value = 0
    isCanvasFileDragOver.value = false

    const point = clientPointToGraphLocal(g, event.clientX, event.clientY)

    const groupPayload =
      parseCanvasElementGroupDragPayload(event.dataTransfer?.getData(CANVAS_ELEMENT_GROUP_DRAG_TYPE) ?? '')
      ?? consumeCanvasElementGroupDragPayload()
    if (groupPayload) {
      addElementGroupFromRecord({
        id: groupPayload.recordId,
        name: groupPayload.name,
        structureJson: groupPayload.structureJson,
      }, point)
      return
    }

    const asset =
      parseCanvasAssetDragPayload(event.dataTransfer?.getData(CANVAS_ASSET_DRAG_TYPE) ?? '')
      ?? consumeCanvasAssetDragPayload()
    if (!asset) return

    if (asset.mediaType === 'VIDEO') {
      addVideoFromAsset(asset, point)
      return
    }

    addImageFromAsset(asset, point)
  }

  function onCanvasFileDrop(event: DragEvent) {
    event.preventDefault()
    canvasFileDragDepth.value = 0
    isCanvasFileDragOver.value = false

    if (wasCanvasAssetDropHandled()) return

    const g = graph.value
    if (!g) return

    if (isCanvasAssetDragActive()) {
      handleCanvasAssetDrop(event)
      clearCanvasAssetDrag()
      return
    }

    const groupPayload = parseCanvasElementGroupDragPayload(
      event.dataTransfer?.getData(CANVAS_ELEMENT_GROUP_DRAG_TYPE) ?? '',
    )
    if (groupPayload) {
      handleCanvasAssetDrop(event)
      return
    }

    const asset = parseCanvasAssetDragPayload(event.dataTransfer?.getData(CANVAS_ASSET_DRAG_TYPE) ?? '')
    if (asset) {
      handleCanvasAssetDrop(event)
      return
    }

    const files = filterUploadFiles(Array.from(event.dataTransfer?.files ?? []), 'any')
    if (!files.length) return

    const point = clientPointToGraphLocal(g, event.clientX, event.clientY)
    spawnMediaFilesAtPoint(files, point)
  }

  let graphDropEl: HTMLElement | null = null

  function onGraphDragOver(event: DragEvent) {
    if (!hasCanvasFileDrag(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function onGraphDrop(event: DragEvent) {
    // graph 在 capture 阶段监听 drop，若不阻止冒泡，.canvas 根节点会再处理一次导致重复建节点
    event.preventDefault()
    event.stopPropagation()
    onCanvasFileDrop(event)
  }

  function bindGraphDropListeners(el: HTMLElement) {
    graphDropEl = el
    el.addEventListener('dragover', onGraphDragOver, true)
    el.addEventListener('drop', onGraphDrop, true)
  }

  function unbindGraphDropListeners() {
    if (!graphDropEl) return
    graphDropEl.removeEventListener('dragover', onGraphDragOver, true)
    graphDropEl.removeEventListener('drop', onGraphDrop, true)
    graphDropEl = null
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

  function mapSkillToAssetCenterItem(skill: SavedCanvasSkill): AssetCenterItem {
    const previewUrl = skill.workflow.nodes.find((node) => node.previewUrl)?.previewUrl
    return {
      id: skill.id,
      name: skill.name,
      role: skill.role || '自定义',
      previewUrl,
      description: skill.description,
    }
  }

  function mapElementGroupRecord(record: Record<string, unknown>): AssetCenterItem | null {
    const structure = record.projectStructure as { cells?: Array<Record<string, unknown>> } | undefined
      ?? record.structure as { cells?: Array<Record<string, unknown>> } | undefined
    const cells = structure?.cells ?? []
    const imageNode = cells.find((cell) => cell.type === 'node' && cell.previewUrl)
    const name = String(record.projectName ?? record.name ?? '').trim()
    if (!name) return null
    return {
      id: String(record.id ?? record.elementGroupId ?? `${name}-${record.updatedAt ?? ''}`),
      name,
      role: String(record.role ?? '自定义'),
      previewUrl: typeof imageNode?.previewUrl === 'string' ? imageNode.previewUrl : undefined,
      description: String(record.projectDescription ?? record.description ?? ''),
    }
  }

  async function loadAssetCenterItems() {
    assetCenterLoading.value = true
    try {
      const projectId = activeProjectId.value
      const byId = new Map<string, AssetCenterItem>()

      listSavedCanvasSkills()
        .filter((skill) => !projectId || skill.projectId === projectId)
        .forEach((skill) => {
          byId.set(skill.id, mapSkillToAssetCenterItem(skill))
        })

      if (projectId) {
        try {
          const res = await api.queryElementGroups(projectId, { pageSize: 50, page: 1 }) as {
            records?: Array<Record<string, unknown>>
          }
          for (const record of res?.records ?? []) {
            const item = mapElementGroupRecord(record)
            if (item) byId.set(item.id, item)
          }
        } catch (error) {
          console.warn('[Canvas] load asset center failed', error)
        }
      }

      assetCenterItems.value = Array.from(byId.values())
    } finally {
      assetCenterLoading.value = false
    }
  }

  function closeAssetCenterPanel() {
    showAssetCenterPanel.value = false
  }

  function openAssetCenterPanel() {
    showAssetCenterPanel.value = true
    closeAddMenu()
    closeHistoryPanel()
    showAssetsPanel.value = false
  }

  function toggleAssetCenterPanel() {
    if (showAssetCenterPanel.value) {
      closeAssetCenterPanel()
    } else {
      openAssetCenterPanel()
    }
  }

  function openAssetsPanel() {
    showAssetsPanel.value = true
    closeAssetCenterPanel()
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
    closeAssetCenterPanel()
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
    closeAssetCenterPanel()
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
    resetImageExpand()
    resetImageEditText()
    resetImageGridSplit()
    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()
    syncNodeSelectionHighlight([])
    bumpToolbarRevision()
    updateNodeToolbar()
    syncNodeCount()
    scheduleHistoryPush()
  }

  function resetCanvasPanCursorState() {
    endSpacePan()
    const g = graph.value
    if (!g) return
    const scroller = getScroller(g)
    const impl = scroller
      ? (
          scroller as unknown as {
            scrollerImpl?: { container?: HTMLElement; stopPanning?: () => void }
          }
        ).scrollerImpl
      : null
    if (!impl?.container) return

    try {
      impl.stopPanning?.()
    } catch {
      // 已结束或未开始时忽略
    }

    if (panMode.value) {
      impl.container.dataset.panning = 'false'
      return
    }

    delete impl.container.dataset.panning
    scroller?.disablePanning()
  }

  function handleBlankDblClick(event: { x: number; y: number }) {
    resetCanvasPanCursorState()
    openAddMenuAtGraphPoint({ x: event.x, y: event.y })
  }

  function handleNodeClick({ node, e }: { node: Node; e?: MouseEvent }) {
    if (showConnectMenu.value) {
      closeConnectMenu()
    }

    setTextEditorToolbarActive(false)

    let data = node.getData() as CanvasNodeData
    if (data.kind === 'video' && data.previewUrl && data.mode === 'picker') {
      data = { ...data, mode: 'editor' }
      node.setData(data)
    }
    const multiSelect = Boolean(e?.ctrlKey || e?.metaKey)

    if (
      !multiSelect &&
      (showVideoGenCanvasPickMode.value || showImageDialogueCanvasPickMode.value)
    ) {
      clearEdgeSelection()
      if (data.kind === 'image' && data.previewUrl) {
        if (showVideoGenCanvasPickMode.value) {
          void handleVideoGenCanvasPick(node.id)
        } else {
          void handleImageDialogueCanvasPick(node.id)
        }
      } else {
        restoreCanvasPickTargetSelection()
      }
      return
    }

    if (
      !multiSelect &&
      showElementSelectMode.value &&
      data.kind === 'image' &&
      data.previewUrl &&
      e
    ) {
      clearEdgeSelection()
      selectedNodeId.value = node.id
      selectedKind.value = 'image'
      syncSelectionFromGraph()
      void handleImageMarkRecognize(node, e)
      return
    }

    clearEdgeSelection()
    selectedNodeId.value = node.id
    selectedKind.value = data.kind

    if (data.groupId && !multiSelect) {
      cancelVideoToolbarDefer()
      syncSelectionFromGraph()
      return
    }

    if (multiSelect) {
      cancelVideoToolbarDefer()
      syncSelectionFromGraph()
      return
    }

    if (shouldDeferVideoToolbarOnClick(data)) {
      scheduleVideoToolbarDefer()
    } else {
      cancelVideoToolbarDefer()
    }

    resetImageToolbarMore()
    if (!showElementSelectMode.value) {
      resetImageDialogue()
    }
    resetImageCrop()
    resetImageExpand()
    resetImageEditText()
    resetImageGridSplit()
    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()
    bumpToolbarRevision()

    const g = graph.value
    const showImageGenPrompt =
      Boolean(g) &&
      shouldOpenImageGenPromptBar(g!, node.id, data)

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
    cancelVideoToolbarDefer()
    closeAddMenu()
    closeProjectMenu()
    closeUserMenu()
    closeZoomMenu()
    closeShortcutsPanel()
    closeHistoryPanel()
    closeConnectMenu()
    setTextEditorToolbarActive(false)
    activePickerNodeId.value = ''
    graph.value?.cleanSelection()
    selectedNodeId.value = ''
    selectedNodeIds.value = []
    selectedEdgeId.value = ''
    selectedKind.value = null
    resetImageToolbarMore()
    resetImageDialogue()
    resetImageCrop()
    resetImageExpand()
    resetImageEditText()
    resetImageGridSplit()
    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()
    closeImageGenPromptBar()
    closeVideoGenPromptBar()
    closeTextExpand()
    exitElementSelectMode({ force: true })
    exitVideoGenCanvasPickMode()
    exitImageDialogueCanvasPickMode()
    syncNodeSelectionHighlight([])
    selectedEdgeId.value = ''
    clearEdgeHoverState()
  }

  function dismissOneCanvasLayer() {
    if (showSaveSkillPopover.value) {
      closeSaveSkillPopover()
      return true
    }
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
    if (showImageGridSplit.value) {
      closeImageGridSplit()
      return true
    }
    if (showImageErase.value) {
      closeImageErase()
      return true
    }
    if (showImageInpaint.value) {
      closeImageInpaint()
      return true
    }
    if (showImageExpand.value) {
      closeImageExpand()
      return true
    }
    if (showImageEditText.value) {
      closeImageEditText()
      return true
    }
    if (nodeOverlaysRef.value?.dismissVideoGenPromptOverlay()) {
      return true
    }
    if (showImageToolbarCustomize.value) {
      closeImageToolbarCustomize()
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
    if (showConnectMenu.value) {
      // 打开菜单当次 mouseup 可能同步触发 blank:click，用 flag 跳过这一次
      if (g?.__suppressBlankCloseForConnect) {
        g.__suppressBlankCloseForConnect = false
        return true
      }
      closeConnectMenu()
      return true
    }
    if (g?.__suppressBlankCloseForConnect) {
      g.__suppressBlankCloseForConnect = false
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
    if (showAssetCenterPanel.value) {
      closeAssetCenterPanel()
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
    if (textEditorToolbarActive.value) {
      setTextEditorToolbarActive(false)
      return true
    }
    if (showVideoGenCanvasPickMode.value) {
      exitVideoGenCanvasPickMode()
      return true
    }
    if (showImageDialogueCanvasPickMode.value) {
      exitImageDialogueCanvasPickMode()
      return true
    }
    if (showElementSelectMode.value) {
      exitElementSelectMode()
      return true
    }
    if (hoveredEdgeId.value) {
      clearEdgeHoverState()
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
      setTextEditorToolbarActive(false)
      resetImageToolbarMore()
      resetImageDialogue()
      resetImageCrop()
      resetImageGridSplit()
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

  function scheduleHistoryPush(options: { autoSave?: boolean } = {}) {
    const shouldAutoSave = options.autoSave !== false
    const g = graph.value
    if (!g || !canvasHistory) return
    if (historyPushTimer) clearTimeout(historyPushTimer)
    historyPushTimer = setTimeout(() => {
      canvasHistory?.push(g)
      syncHistoryState()
      historyPushTimer = null
      if (shouldAutoSave) {
        triggerAutoSaveIfReady()
      }
    }, 280)
  }

  function notifyTextNodeUpdated() {
    const imageNodeId = activeImageGenPromptNodeId.value
    if (imageNodeId) {
      const upstream = resolveImageGenTextSourcePreview(imageNodeId)
      imageGenSourceTextPreview.value = upstream
      if (upstream && !imageDialogueText.value.trim()) {
        imageDialogueText.value = upstream
        imageGenPromptText.value = upstream
      }
    }
    bumpToolbarRevision()
    scheduleHistoryPush()
  }

  function handleUndo() {
    const g = graph.value
    if (!g || !canvasHistory?.undo(g)) return
    syncHistoryState()
    syncNodeCount()
    resetCanvasInteractionState()
    triggerAutoSaveIfReady()
    nextTick(() => updateNodeToolbar())
  }

  function handleRedo() {
    const g = graph.value
    if (!g || !canvasHistory?.redo(g)) return
    syncHistoryState()
    syncNodeCount()
    resetCanvasInteractionState()
    triggerAutoSaveIfReady()
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

  function handleMultiSelectLayout(direction: GroupLayoutDirection = 'horizontal') {
    const g = graph.value
    const ids = selectedNodeIds.value
    if (!g || ids.length < 2) return
    const nodes = ids
      .map((id) => g.getCellById(id))
      .filter((cell): cell is Node => cell != null && cell.isNode())
    layoutNodesInGroup(nodes, direction)
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

    const targets = group.nodeIds
      .map((id) => {
        const node = g.getCellById(id)
        if (!node?.isNode()) return null
        const data = node.getData() as CanvasNodeData
        if (!data.previewUrl) return null
        return data
      })
      .filter((item): item is CanvasNodeData => Boolean(item))

    if (!targets.length) {
      message.warning('当前分组没有可下载的图片或视频')
      return
    }

    void (async () => {
      let success = 0
      for (let index = 0; index < targets.length; index += 1) {
        const data = targets[index]
        const isVideo = data.kind === 'video'
        try {
          await downloadCanvasMedia({
            url: data.previewUrl,
            fallbackName: isVideo
              ? `group-video-${index + 1}.mp4`
              : `group-image-${index + 1}`,
          })
          success += 1
          // 避免浏览器连续触发下载被拦截
          if (index < targets.length - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 280))
          }
        } catch {
          // 单个失败不中断批次
        }
      }
      if (!success) {
        message.error('批量下载失败，请稍后重试')
      } else if (success < targets.length) {
        message.warning(`已下载 ${success}/${targets.length} 个文件`)
      }
    })()
  }

  function handleGroupSaveToSkill() {
    const g = graph.value
    const group = activeGroupSelection.value
    const overlayRoot = canvasRef.value
    if (!g || !group || !overlayRoot) return

    const subgraph = extractGroupSubgraph(g, group.nodeIds)
    if (!subgraph) {
      message.warning('当前分组没有可导出的节点')
      return
    }

    const box = getGroupScreenBox(g, group.nodeIds, overlayRoot)
    saveSkillItems.value = subgraph.nodes.map((node) => ({
      nodeId: node.id,
      label: node.fileName || node.title || `节点-${node.id.slice(-4)}`,
    }))
    saveSkillPopoverPos.value = {
      left: box.centerX,
      top: box.anchorTop + box.height / 2,
    }
    showSaveSkillPopover.value = true
  }

  function closeSaveSkillPopover() {
    showSaveSkillPopover.value = false
    saveSkillItems.value = []
    saveSkillSubmitting.value = false
  }

  function countSkillFiles(subgraph: NonNullable<ReturnType<typeof extractGroupSubgraph>>) {
    return subgraph.nodes.filter((node) => node.previewUrl || node.fileName).length
  }

  async function handleSubmitSaveSkill(payload: {
    tab: 'new' | 'existing'
    name: string
    role: string
    description: string
    tags: string[]
    existingSkillId?: string
  }) {
    const g = graph.value
    const group = activeGroupSelection.value
    if (!g || !group || saveSkillSubmitting.value) return

    const subgraph = extractGroupSubgraph(g, group.nodeIds)
    if (!subgraph) return

    saveSkillSubmitting.value = true
    try {
      const fileCount = Math.max(1, countSkillFiles(subgraph))
      const { content } = buildGroupSkillMarkdown(subgraph, {
        name: payload.name,
        projectName: currentProjectName.value,
        description: payload.description,
        role: payload.role,
        tags: payload.tags,
      })

      if (payload.tab === 'existing' && payload.existingSkillId) {
        const existing = listSavedCanvasSkills().find((item) => item.id === payload.existingSkillId)
        if (!existing) {
          message.warning('目标技能不存在')
          return
        }

        const mergedWorkflow = {
          nodes: [...existing.workflow.nodes, ...subgraph.nodes],
          edges: [...existing.workflow.edges, ...subgraph.edges],
        }
        const mergedMarkdown = buildGroupSkillMarkdown(mergedWorkflow, {
          name: existing.name,
          projectName: currentProjectName.value,
          description: existing.description,
          role: existing.role,
          tags: existing.tags,
        }).content

        const updated = await mergeCanvasSkill(payload.existingSkillId, {
          markdown: mergedMarkdown,
          workflow: mergedWorkflow,
          addedNodeCount: subgraph.nodes.length,
          addedFileCount: fileCount,
        })

        if (!updated) {
          message.warning('加入技能失败')
          return
        }

        message.success(`已更新技能「${updated.name}」(含 ${updated.fileCount} 个文件)`)
        closeSaveSkillPopover()
        return
      }

      const skill: SavedCanvasSkill = {
        id: createSkillId(),
        name: payload.name,
        role: payload.role,
        description: payload.description,
        tags: payload.tags,
        markdown: content,
        workflow: subgraph,
        nodeCount: subgraph.nodes.length,
        fileCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projectId: activeProjectId.value,
      }

      await saveCanvasSkill(skill)
      message.success(`已创建技能「${skill.name}」(含 ${skill.fileCount} 个文件)`)
      closeSaveSkillPopover()
    } catch (error) {
      console.error('[Canvas] save skill failed', error)
      message.error('保存技能失败，请稍后重试')
    } finally {
      saveSkillSubmitting.value = false
    }
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
    closeImageToolbarMore()
    showImageHdMenu.value = false
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

  const { altVoiceTimer, bindKeyboard, unbindKeyboard, bindLongPressPan, unbindLongPressPan, endSpacePan } =
    useCanvasKeyboard({
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
    updateNodeToolbar({ skipImageResizeOverlay: true })
    updateEdgeDeleteButtonPosition()
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
    autoSaveEnabled = true
    canvasContentReady = false
    window.addEventListener('beforeunload', onPageUnload)
    window.addEventListener('pagehide', onPageUnload)

    setCanvasUploadProjectId(() => activeProjectId.value || undefined)
    setCanvasNodeMutationCompleteHandler(() => {
      scheduleHistoryPush()
    })
    setGenerationTaskSucceededHandler(() => {
      scheduleHistoryPush()
    })
    void onLoadProjects()

    const routeProjectId = router.currentRoute.value.params.id
    if (typeof routeProjectId === 'string' && routeProjectId.trim()) {
      activeProjectId.value = routeProjectId
    }

    if (!graphRef.value) return

    const instance = createGraph(graphRef.value) as CanvasGraph
    instance.__openConnectMenu = openConnectMenuByNodeId
    instance.__openImageDialogue = openImageDialogue
    instance.__openVideoDialogue = openVideoDialogue
    instance.__primarySelectedNodeId = () => selectedNodeId.value
    instance.__startImageNodeCornerResize = (event, corner) => {
      const g = graph.value
      const id = selectedNodeId.value
      if (!g || !id) return
      const cell = g.getCellById(id)
      if (!cell?.isNode()) return
      startImageNodeCornerResize(g, cell as Node, event, corner, () => {
        bumpToolbarRevision()
        updateNodeToolbar({ skipImageResizeOverlay: true })
      })
    }
    instance.__deleteCanvasNode = removeNodeById
    instance.__uploadFileToCanvasNode = uploadFileToCanvasNode
    instance.__requestTextExpand = openTextExpand
    instance.__onTextPickerAction = handleTextPickerAction
    instance.__onVideoPickerAction = handleVideoPickerAction
    instance.__onTextNodeEdgeLinked = handleNodeEdgeLinked
    instance.__onNodeEdgeLinked = handleNodeEdgeLinked
    instance.__notifyTextNodeUpdated = notifyTextNodeUpdated
    instance.__focusCanvasNode = (nodeId: string) => {
      const g = graph.value
      if (!g) return
      const cell = g.getCellById(nodeId)
      if (!cell?.isNode()) return
      selectGraphNodes(cell as Node)
    }
    instance.__onTextEditorFocus = (nodeId: string) => {
      if (selectedNodeId.value && selectedNodeId.value !== nodeId) return
      selectedNodeId.value = nodeId
      selectedKind.value = 'text'
      setTextEditorToolbarActive(true)
      updateNodeToolbar()
    }
    instance.__deactivateTextEditorToolbar = () => {
      setTextEditorToolbarActive(false)
    }
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
    bindLongPressPan(instance)

    // 挂载即把全画布各层背景刷成当前主题色，避免拖拽到内容区外露出建图时的深色底（视图分层感）
    applyCanvasBgTheme(instance, canvasBgTheme.value, gridVisible.value)

    instance.on('blank:dblclick', handleBlankDblClick)
    instance.on('blank:mousedown', ({ e }: { e: MouseEvent }) => {
      if (e.detail < 2) return
      resetCanvasPanCursorState()
    })
    instance.on('scale', ({ sx }) => {
      syncZoom(sx)
      updateEdgeDeleteButtonPosition()
      syncViewportNodeVisibility()
      updateNodeToolbar({ skipImageResizeOverlay: true })
    })
    instance.on('translate', () => {
      updateEdgeDeleteButtonPosition()
      syncViewportNodeVisibility()
      updateNodeToolbar({ skipImageResizeOverlay: true })
    })
    instance.on('node:moving', ({ node }) => {
      syncGroupedNodeMove(node)
      snapGridSplitNodePosition(instance, node)
      if (activeGroupSelection.value) {
        updateGroupToolbarPosition()
      }
      updateNodeToolbar()
      updateEdgeDeleteButtonPosition()
    })
    instance.on('node:moved', ({ node }) => {
      snapGridSplitNodePosition(instance, node)
      groupMoveState.anchorId = ''
      updateNodeToolbar()
      syncViewportNodeVisibility()
      scheduleHistoryPush()
    })
    instance.on('node:added', syncNodeCount)
    instance.on('node:removed', syncNodeCount)
    instance.on('node:click', handleNodeClick)
    instance.on('edge:click', handleEdgeClick)
    instance.on('edge:mouseenter', handleEdgeMouseEnter)
    instance.on('edge:mouseleave', handleEdgeMouseLeave)
    instance.on('selection:changed', () => {
      if (showVideoGenCanvasPickMode.value || showImageDialogueCanvasPickMode.value) {
        restoreCanvasPickTargetSelection()
        return
      }

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
        const gAfter = graph.value
        const selectedId = selectedNodeId.value
        if (gAfter && selectedId && getGraphSelectedNodeIds().length === 1) {
          const cell = gAfter.getCellById(selectedId)
          if (cell?.isNode()) {
            syncImageNodeSizeToMediaAspect(cell as Node)
          }
        }
        updateImageResizeOverlay()
      })
    })
    instance.on('node:resized', () => {
      scheduleHistoryPush()
      bumpToolbarRevision()
      updateImageResizeOverlay()
    })
    instance.on('node:dblclick', ({ node }) => {
      const data = node.getData() as CanvasNodeData
      if (data.kind === 'image') {
        handleImageNodeDblClick({ node })
        return
      }
      if (data.kind === 'video') {
        handleVideoNodeDblClick({ node })
        return
      }
      if (data.kind === 'text' && data.mode === 'picker') {
        node.setData({ ...data, mode: 'editor', promptBarPinned: false })
        selectGraphNodes(node)
        setTextEditorToolbarActive(false)
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

    resetResumedGenerationTaskCache()

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

      if (pendingProjectCanvas) {
        const loaded = applyProjectCanvasPayload(pendingProjectCanvas)
        pendingProjectCanvas = null
        if (loaded) {
          markCanvasContentReady()
        }
      }
    })

    if (showMinimap.value) {
      nextTick(() => setupMinimap())
    }

    bindGraphDropListeners(graphRef.value)
    setCanvasAssetDropHandler(handleCanvasAssetDrop)
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

  function addImageFromFile(
    file: File,
    point?: { x: number; y: number },
    options: { select?: boolean } = {},
  ) {
    const g = graph.value
    if (!g) return Promise.resolve(null)

    const position = point ?? getGraphCenter()
    const node = addCanvasNode(g, 'image', position, {
      mode: 'editor',
      title: file.name,
      fileName: file.name,
    })

    runUploadSimulation(node, file)
    if (options.select !== false) {
      selectGraphNodes(node)
    }
    syncNodeCount()
    scheduleHistoryPush({ autoSave: false })

    return waitForNodeUploadDone(node)
  }

  function addElementGroupFromRecord(
    record: Record<string, unknown>,
    point?: { x: number; y: number },
  ) {
    const g = graph.value
    if (!g) return

    if (!parseElementGroupRecord(record)) {
      message.warning('无法解析该技能数据')
      return
    }

    const anchor = point ?? getRandomViewportLocalPoint(g)
    const nodes = addElementGroupRecordToCanvas(g, record, anchor)
    if (!nodes.length) {
      message.warning('无法解析该技能数据')
      return
    }

    selectGraphNodes(nodes.map((node) => node.id))
    syncNodeCount()
    scheduleHistoryPush()
    ensureInfiniteCanvasArea(g)
  }

  function addImageFromAsset(
    asset: {
      assetId?: string
      previewUrl: string
      fileName?: string
      width?: number | null
      height?: number | null
    },
    point?: { x: number; y: number },
  ) {
    const g = graph.value
    if (!g || !asset.previewUrl) return

    const position = point ?? getRandomViewportLocalPoint(g, { kind: 'image', mode: 'editor' })
    const node = addCanvasNode(g, 'image', position, {
      mode: 'editor',
      title: asset.fileName || '图片',
      fileName: asset.fileName || '图片',
    })

    applyRemoteImageToNode(node, asset)
    selectGraphNodes(node)
    syncNodeCount()
    scheduleHistoryPush()
  }

  function addVideoFromAsset(
    asset: {
      assetId?: string
      previewUrl: string
      fileName?: string
      width?: number | null
      height?: number | null
    },
    point?: { x: number; y: number },
  ) {
    const g = graph.value
    if (!g || !asset.previewUrl) return

    const position = point ?? getRandomViewportLocalPoint(g, { kind: 'video', mode: 'editor' })
    const node = addCanvasNode(g, 'video', position, {
      mode: 'editor',
      title: asset.fileName || '视频',
      fileName: asset.fileName || '视频',
    })

    void applyRemoteVideoToNode(node, asset)
    selectGraphNodes(node)
    syncNodeCount()
    scheduleHistoryPush()
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
    window.removeEventListener('beforeunload', onPageUnload)
    window.removeEventListener('pagehide', onPageUnload)
    stopAutoSave()
    setCanvasNodeMutationCompleteHandler(null)
    setGenerationTaskSucceededHandler(null)
    unbindKeyboard()
    unbindLongPressPan()
    unbindGraphDropListeners()
    setCanvasAssetDropHandler(null)
    clearCanvasAssetDrag()
    if (historyPushTimer) clearTimeout(historyPushTimer)
    if (autoSaveDebounceTimer) clearTimeout(autoSaveDebounceTimer)
    if (edgeHoverLeaveTimer) window.clearTimeout(edgeHoverLeaveTimer)
    if (altVoiceTimer.value) clearTimeout(altVoiceTimer.value)
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

  return {
    activeGroupSelection,
    addElementGroupFromRecord,
    addFromMenu,
    addImageDialogueSourceRef,
    addImageFromAsset,
    addVideoFromAsset,
    addImageFromFile,
    addImagesFromFiles,
    addNode,
    addPromptImageSourceRef,
    altVoiceTimer,
    applyIncomingImageSource,
    applyZoomAfterChange,
    bindKeyboard,
    bindLongPressPan,
    bindScrollerScrollListener,
    bumpToolbarRevision,
    canShowImageToolbar,
    canShowVideoToolbar,
    canSubmitTextPrompt,
    cancelCurrentOperation,
    canvasBgThemeLabel,
    clearEdgeSelection,
    clearImageDialoguePreview,
    closeAddMenu,
    closeConnectMenu,
    closeHistoryPanel,
    closeImageCrop,
    closeImageErase,
    closeImageInpaint,
    closeImageExpand,
    closeImageEditText,
    closeImageGridSplit,
    onImageEraseComplete,
    onImageInpaintComplete,
    onImageExpandComplete,
    onImageEditTextApply,
    onImageInpaintDragStart,
    onImageExpandDragStart,
    onImageGridSplitComplete,
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
    copySelectedNode,
    copySelectedNodes,
    currentProjectName,
    detachImageSourceFromDownstream,
    dismissOneCanvasLayer,
    downloadSelectedTextNode,
    duplicateSelectedNodes,
    endSpacePan,
    elementMarks,
    mentionInsertSerial,
    mentionInsertToken,
    enterElementSelectMode,
    exitElementSelectMode,
    exitVideoGenCanvasPickMode,
    exitImageDialogueCanvasPickMode,
    toggleVideoGenCanvasPickMode,
    toggleImageDialogueCanvasPickMode,
    toggleImageDialogueMarkMode,
    updateImageMarkLabel,
    filterUploadFiles,
    finishConnectSpawn,
    generateImageFromPrompt,
    handleImageDialogueSubmit,
    handleVideoDialogueSubmit,
    handleVideoGenPromptSubmit,
    getActiveSelectedNodeIds,
    getEdgeReleasePoint,
    getGraphCenter,
    getGraphSelectedNodeIds,
    getHistoryMeta,
    getHorizontalUploadSpawnPoint,
    getMultiUploadSpawnPoint,
    getSelectedNode,
    getSelectedNodeData,
    getVideoGenSourceLimit,
    goUserCenter,
    handleApplyImageGenTask,
    handleBlankDblClick,
    handleEdgeClick,
    handleEdgeConnected,
    handleExportCanvas,
    handleGroupAddToToolbox,
    handleGroupBatchDownload,
    handleGroupExecute,
    handleGroupLayout,
    handleGroupSaveToSkill,
    handleGroupToStoryboard,
    handleSubmitSaveSkill,
    closeSaveSkillPopover,
    closeImageToolbarCustomize,
    saveImageToolbarCustomize,
    resetImageToolbarCustomize,
    listSavedCanvasSkills,
    handleImageNodeDblClick,
    handleVideoNodeDblClick,
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
    hasUnsavedChanges,
    loadProjectCanvas,
    handleTextPickerAction,
    handleTidyCanvas,
    handleUndo,
    handleUngroup,
    handleUserMenuAction,
    hasCanvasFileDrag,
    imageCropSource,
    imageEraseSource,
    imageInpaintSource,
    imageExpandSource,
    imageGridSplitSource,
    imageDialoguePreviewUrl,
    imageDialoguePreviews,
    isImageUploadFile,
    isImg2PromptTask,
    isText2VideoTask,
    isText2ImageTask,
    promptSubmitLabel,
    isLightNodeToolbar,
    isVideoUploadFile,
    linkImageNodeToImageDialogue,
    linkImageNodeToVideoGen,
    linkImageSourceFromEdge,
    loadImageGenPromptFields,
    loadImageDialogueFields,
    loadVideoDialogueFields,
    loadPromptBarContext,
    loadVideoGenPromptFields,
    moveNodeLayer,
    onCanvasDragEnter,
    onCanvasDragLeave,
    onCanvasDragOver,
    onCanvasFileDrop,
    onConnectMenuItem,
    onFileSelected,
    onGoHome,
    onGroupOverlayDragStart,
    onImageCropComplete,
    onImageResizePointerDown,
    onImageDialogueAddCanvasNode,
    onImageDialogueUploadFiles,
    onImageToolbarAction,
    onVideoToolbarAction,
    onLoadProjects,
    onMenuItem,
    onPromptAddCanvasNode,
    onPromptUploadFiles,
    onRemoveImageGenSourceRef,
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
    openImageErase,
    openImageInpaint,
    openImageExpand,
    openImageDialogue,
    openVideoDialogue,
    openImageGenPromptBar,
    openImagePreview,
    openImageToolbarMore,
    openNewProject,
    openTextExpand,
    openVideoGenPromptBar,
    pasteNode,
    pasteNodePayload,
    persistImageGenPrompt,
    persistImageDialogueFields,
    persistVideoDialogueFields,
    persistPromptBarDraft,
    persistTextExpandContent,
    persistVideoGenPrompt,
    plainTextToEditorHtml,
    recenterToNodes,
    refreshPromptSourcePreviews,
    removeConnectPreviewEdge,
    removeNodeById,
    removePromptImageSource,
    removeSelectedEdge,
    removeSelectedNodes,
    requestCanvasUpload,
    resetCanvasInteractionState,
    resetImageCrop,
    resetImageExpand,
    resetImageEditText,
    resetImageGridSplit,
    resetImageDialogue,
    resetImageToolbarMore,
    resetVideoDialogue,
    resetVideoFramesPanel,
    resetVideoHdPanel,
    returnFromElementSelect,
    scheduleHistoryPush,
    seedImageDialogueRefs,
    seedPromptImageRefs,
    selectGraphNodes,
    selectProject,
    setRubberbandEnabled,
    setupMinimap,
    showGroupToolbar,
    showSaveSkillPopover,
    saveSkillPopoverPos,
    saveSkillItems,
    saveSkillSubmitting,
    showImageCreativeToolbar,
    showElementSelectBar,
    showImageGenPromptBar,
    showImageToolbarCustomize,
    imageToolbarCustomizeSettings,
    showMultiSelectToolbar,
    showNodeToolbar,
    showPromptBar,
    showTextFormatToolbar,
    showToolbarFeatureButtons,
    showVideoGenPromptBar,
    showVideoDialoguePanel,
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
    toggleAddMenu,
    toggleAssetsPanel,
    toggleAssetCenterPanel,
    loadAssetCenterItems,
    closeAssetCenterPanel,
    toggleCanvasBgTheme,
    toggleGrid,
    toggleHistoryPanel,
    toggleImageAddToDialogMenu,
    addVideoToDialog,
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
    triggerCanvasUploadShortcut,
    triggerFileInputClick,
    unbindKeyboard,
    unbindLongPressPan,
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
    edgeDeleteBtnPos,
    showEdgeDeleteButton,
    handleEdgeDeletePointerEnter,
    handleEdgeDeletePointerLeave,
    removeHoveredEdge,
    uploadFileToCanvasNode,
    imageGenSourceRefs,
    videoGenSourceRefs,
    videoGenSavedSettings,
    videoDialogueSourceRefs,
    videoGenAspectRatio,
    onVideoGenAspectRatioChange,
    waitForNodeUploadDone,
    zoomFitToScreen,
    zoomIn,
    zoomOut,
    zoomPercent,
    zoomToScale,
  }
}
