import { computed, nextTick, onBeforeUnmount, onMounted, provide } from 'vue'
import { message } from 'ant-design-vue'
import type { Edge, Graph, Node } from '@antv/x6'
import type { CanvasBindings } from './types'
import type { UploadFilter } from './state'
import { unpackBind } from './bindContext'
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
  spawnCroppedImageNode, spawnErasedImageNode, spawnGenerationResultNode, spawnCompletedImageResultNode, spawnGridSplitResultNodes, spawnModel3DResultNode, spawnVideoGenerationResultNode, spawnTextPromptResultNode, canImageNodeAcceptIncoming, canOpenConnectMenu, createNodeFromConnectMenu,
  getConnectMenuPosition, resolveConnectSpawnPoint, detachEdgeRelation, isPersistedEdge,
  syncEdgeSelectionHighlight, applyFlowEdgeStyle, getFlowEdgeAttrs, getPreviewEdgeAttrs, addCanvasNode, bindGraphInteraction, createGraph,
  ensureInfiniteCanvasArea, clientPointToGraphLocal, getViewportCenterLocal, getRandomViewportLocalPoint, hasVisibleNodesInViewport,
  centerGraphContent, getNodeCropOverlayPosition, getNodeDialoguePosition, getNodeImageGenPromptPosition,
  getNodeVideoGenPromptPosition, getNodePromptPosition, getNodeSidePanelPosition, getNodeTextDownloadPosition,
  getNodeTextFormatToolbarPosition, getGroupScreenBox, getMultiSelectionToolbarPosition, getNodeToolbarPosition,
  getNodeSize, getScroller, getEdgeDeleteButtonPosition, graphLocalToContainerOffset, refreshCanvasNodeViews, syncAllNodeSizes,
  hydrateImageNodeDimensions, hydrateMissingImageNodeDimensions,
  applyCanvasBgTheme, getCanvasBgThemeMeta, layoutNodesInGroup, tidyCanvas, tidyNodes, assignGroupId,
  expandSelectionToGroup, getCompleteGroupSelection, getNodesInGroup, mergeStoryboardGroup, normalizeGroupMembership, ungroupSelection,
  ensureImageTextEdge, syncTextNodeImageSource,
  createMinimap, destroyMinimap, applyRemoteImageToNode, runUploadSimulation, uploadAssetFile, setCanvasUploadProjectId, getCanvasSnapshot, saveCanvasSnapshotToStorage,
  normalizeCanvasSnapshot, applyCanvasSnapshot, createCanvasHistory, disconnectImageFromVideo, findImageToVideoEdge, getVideoSourceRefs, VIDEO_GEN_TAB_IMAGE_RULES,
  useCanvasKeyboard, api, buildGroupSkillMarkdown, extractGroupSubgraph, parseElementGroupRecord,
} from './sharedImports';
import { addElementGroupRecordToCanvas } from '../../elementGroupCanvas'
import {
  bindGenerationTaskId,
  followModelGenerationTaskOnNode,
  followTextGenerationTaskOnNode,
  markGenerationNodeFailed,
  markTextGenerationNodeFailed,
  markVideoGenerationNodeFailed,
  normalizeGenerationTaskDetail,
  resetResumedGenerationTaskCache,
  resumePendingGenerationTasks,
  runImageGenerationOnNode,
  startImageGenerationOnNode,
  startVideoGenerationTaskFollow,
  resolveGenerationResultPreview,
  type GenerationTaskDetail,
  type GenerationTaskResult,
} from '../../generationTask'
import type { CanvasElementGroupDragPayload } from '../../constants'
import {
  resolveImageAssetId,
  buildImageActionResultTitle,
  IMAGE_GENERAL_CAPABILITY_CODE,
  VIDEO_GENERAL_CAPABILITY_CODE,
  type ImageToolbarClickPayload,
  type ImageToolbarClickEvent,
  type ImageDialogueSubmitPayload,
} from '../../constants'
import { splitImageIntoGrid } from '../../gridSplitUtils'
import {
  createSkillId,
  listSavedCanvasSkills,
  mergeCanvasSkill,
  saveCanvasSkill,
  type SavedCanvasSkill,
} from '../../skillStorage'
import type { AssetCenterItem } from '../../assetCenterData'
import type { GroupLayoutDirection } from './sharedImports'
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
    imageGenSubmitting,
    activeVideoGenPromptNodeId,
    videoGenPromptText,
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
    showElementSelectMode,
    elementSelectReturnNodeId,
    imageCropPos,
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
    showVideoDialogue,
    showVideoHdPanel,
    showVideoFramesPanel,
    textFormatToolbarPos,
    textDownloadPos,
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

  let canvasHistory: ReturnType<typeof createCanvasHistory> | null = null
  let historyPushTimer: ReturnType<typeof setTimeout> | null = null
  let autoSaveTimer: number | null = null
  let autoSaveEnabled = true
  let canvasContentReady = false
  let saveInFlight = false
  let pendingRemoteSaveType: 'MANUAL' | 'AUTO' | null = null
  let scrollerScrollTarget: HTMLElement | null = null
  let pendingProjectCanvas: ProjectCanvasResponse | null = null

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

  const showGroupToolbar = computed(() => activeGroupSelection.value != null && !imagePreviewUrl.value)

  const showPromptBar = computed(() => {
    if (showMultiSelectToolbar.value || showGroupToolbar.value) return false
    const id = activePickerNodeId.value
    if (!id || nodeCount.value === 0 || showImageCrop.value || showImageGridSplit.value || showImageErase.value || showImageInpaint.value) return false
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
      !showImageInpaint.value,
  )
  const showVideoGenPromptBar = computed(
    () =>
      !showMultiSelectToolbar.value &&
      !showGroupToolbar.value &&
      Boolean(activeVideoGenPromptNodeId.value) &&
      nodeCount.value > 0 &&
      !showImageCrop.value &&
      !showImageGridSplit.value &&
      !showImageErase.value &&
      !showImageInpaint.value,
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
    if (!selectedNodeId.value || showImageCrop.value || showImageGridSplit.value || showImageErase.value || showImageInpaint.value || textExpandOpen.value) return false
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
  })

  const imageDialoguePreviewUrl = computed(() => {
    void toolbarRevision.value
    const data = getSelectedNodeData()
    return data?.sourcePreviewUrl || data?.previewUrl || ''
  })

  const showNodeToolbar = computed(
    () => Boolean(selectedNodeId.value) && !showGroupToolbar.value && !imagePreviewUrl.value,
  )
  const showMultiSelectToolbar = computed(
    () => selectedNodeIds.value.length >= 2 && !showGroupToolbar.value && !imagePreviewUrl.value,
  )

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

      // 宫格碎片默认不解组展示：仅保持源图选中，避免组工具栏/多选工具栏
      selectedNodeId.value = sourceNodeId
      selectedNodeIds.value = [sourceNodeId]
      selectedKind.value = 'image'
      syncNodeSelectionHighlight([sourceNodeId])
      g.cleanSelection()
      g.select(sourceNodeId)
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
      const localPreviewUrl = data.previewUrl
      if (!localPreviewUrl || (!localPreviewUrl.startsWith('blob:') && !localPreviewUrl.startsWith('data:'))) {
        return
      }
      await uploadLocalImageNodeInBackground(node, localPreviewUrl, data.fileName || '宫格.png', {
        width: data.mediaWidth,
        height: data.mediaHeight,
        preserveTitle: true,
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
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    return new File([blob], fileName, { type: blob.type || 'image/png' })
  }

  async function onImageInpaintComplete(payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
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
  }) {
    const g = graph.value
    const sourceNodeId = inpaintSourceNodeId.value || selectedNodeId.value
    if (!g || !sourceNodeId) {
      closeImageInpaint()
      return
    }

    const cell = g.getCellById(sourceNodeId)
    if (!cell?.isNode()) {
      closeImageInpaint()
      return
    }

    const sourceData = cell.getData() as CanvasNodeData
    const assetId = resolveImageAssetId(sourceData)
    if (!assetId) {
      message.warning('图片素材 ID 不存在，请等待上传完成')
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
    payload: { width: number; height: number; preserveTitle?: boolean },
  ) {
    try {
      const file = await dataUrlToFile(localPreviewUrl, fileName)
      const upload = await uploadAssetFile(file, { projectId: activeProjectId.value })
      if (!upload.url || !upload.assetId) return

      const g = graph.value
      if (!g?.getCellById(node.id)) return

      const current = { ...(node.getData() as CanvasNodeData) }
      if (current.previewUrl !== localPreviewUrl) return

      const prevTitle = current.title
      current.assetId = upload.assetId
      current.previewUrl = upload.url
      current.uploadState = 'done'
      current.uploadProgress = 100
      current.fileName = fileName || current.fileName
      current.mediaWidth = upload.width ?? payload.width
      current.mediaHeight = upload.height ?? payload.height
      if (payload.preserveTitle && prevTitle) {
        current.title = prevTitle
      }
      node.setData(current)

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

  function handleImageDialogueSubmit(payload: ImageDialogueSubmitPayload) {
    const prompt = payload.prompt.trim()
    if (!prompt) {
      message.warning('请输入提示词')
      return
    }

    const data = getSelectedNodeData()
    const referenceAssetIds = imageDialoguePreviews.value
      .map((item) => item.assetId)
      .filter((id): id is string => Boolean(id))
    const assetId = referenceAssetIds[0] || resolveImageAssetId(data) || ''

    const event: ImageToolbarClickEvent = {
      key: IMAGE_GENERAL_CAPABILITY_CODE,
      label: '文生图',
      assetId,
    }

    void runImageGenerationTask(event, {
      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
      title: buildImageActionResultTitle('文生图'),
      prompt,
      requireAssetId: false,
      requireSourcePreview: false,
      resolveReferenceAssetIds: () => referenceAssetIds,
      buildFileName: (sourceFileName) =>
        sourceFileName ? `文生图-${sourceFileName}` : '文生图.png',
      buildParameters: () => {
        const params: Record<string, unknown> = {
          model: payload.model,
          aspectRatio: payload.aspectRatio,
          count: payload.count,
        }
        if (payload.resolution) {
          params.resolution = payload.resolution
        }
        return params
      },
    })
  }

  function normalizeCutoutMode(option?: string) {
    if (!option) return 'quick'
    if (option === '快速') return 'quick'
    if (option === '精准') return 'precise'
    if (option === '擦除') return 'erase'
    return option
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
    },
  ): Promise<Node[]> {
    const nodes: Node[] = []

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
      })
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
      requireAssetId?: boolean
      requireSourcePreview?: boolean
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

          return api.createGenerationTask<GenerationTaskDetail>(
            {
              taskType: 'IMAGE',
              capabilityCode: config.capabilityCode,
              prompt: config.prompt?.trim() ?? '',
              parameters: singleTaskParameters,
              projectId: activeProjectId.value,
              nodeId: resultNode.id,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
            },
            idempotencyKey,
          )
        },
        onTaskBound: () => persistGenerationTaskBinding(),
        onError: (reason) => message.error(reason),
        onComplete: async (result) => {
          if (!result.success) return

          const extraResults = result.extraResults ?? []
          if (!extraResults.length) return

          const totalCount = 1 + extraResults.length
          const extraNodes = await spawnNodesForExtraGenerationResults(g, sourceNode, extraResults, {
            title: config.title,
            sourceFileName,
            buildFileName: config.buildFileName,
            resultIndexOffset: 1,
            totalCount,
          })

          if (!extraNodes.length) return

          syncNodeCount()
          bumpToolbarRevision()
          updateNodeToolbar()
          scheduleHistoryPush()

          nextTick(() => {
            const scroller = getScroller(g)
            if (!scroller) return
            const boxes = extraNodes.map((node) => node.getBBox())
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
    const data = getSelectedNodeData()
    const url = data?.previewUrl
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = data?.fileName || 'image'
    link.target = '_blank'
    link.rel = 'noopener'
    link.click()
    void event.assetId
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
    const targetNodeId = selectedNodeId.value
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
    const targetNodeId = selectedNodeId.value
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
    data.sourceAssetId = latest?.assetId ?? ''
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

  async function submitTextPrompt() {
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
        const trimmedPrompt = promptText.value.trim()
        if (!trimmedPrompt) {
          message.warning('请输入视频描述')
          return
        }

        persistPromptBarDraft()
        const resultNode = spawnVideoGenerationResultNode(g, cell as Node, {
          title: '文生视频',
          fileName: '文生视频.mp4',
        })

        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `text2video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        try {
          const created = normalizeGenerationTaskDetail(
            await api.createGenerationTask<GenerationTaskDetail>(
              {
                taskType: 'VIDEO',
                capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                prompt: trimmedPrompt,
                parameters: {
                  duration: 5,
                  aspectRatio: '16:9',
                },
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

          bindGenerationTaskId(resultNode, taskId, 'VIDEO')
          persistGenerationTaskBinding()

          startVideoGenerationTaskFollow(resultNode, taskId, {
            title: '文生视频',
            fileName: '文生视频.mp4',
            onError: (reason) => message.error(reason),
            onComplete: (success) => {
              if (!success) return
              bumpToolbarRevision()
              updateNodeToolbar()
              scheduleHistoryPush()
            },
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
          message.error(isRequestError(error) ? error.message : '文生视频失败，请稍后重试')
        }
        return
      }

      if (modelType.value === 'text2image' || isText2ImageTask.value) {
        const trimmedPrompt = promptText.value.trim()
        if (!trimmedPrompt) {
          message.warning('请输入图片描述')
          return
        }

        persistPromptBarDraft()
        const resultNode = spawnGenerationResultNode(g, cell as Node, {
          title: '文生图',
          fileName: '文生图.png',
        })

        try {
          const started = await startImageGenerationOnNode(resultNode, {
            title: '文生图',
            fileName: '文生图.png',
            createTask: async () => {
              const idempotencyKey =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `text2image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

              return api.createGenerationTask<GenerationTaskDetail>(
                {
                  taskType: 'IMAGE',
                  capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                  prompt: trimmedPrompt,
                  parameters: { count: 1 },
                  projectId: activeProjectId.value,
                  nodeId: resultNode.id,
                },
                idempotencyKey,
              )
            },
            onTaskBound: () => persistGenerationTaskBinding(),
            onError: (reason) => message.error(reason),
            onComplete: (result) => {
              if (!result.success) return
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

          return api.createGenerationTask<GenerationTaskDetail>(
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
    if (projectId === activeProjectId.value) {
      closeProjectMenu()
      return
    }

    const route = router.currentRoute.value
    if (route.params.id !== projectId) {
      router.replace({
        name: route.name ?? undefined,
        params: { ...route.params, id: projectId },
      })
    }

    activeProjectId.value = projectId
    closeProjectMenu()
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

    resumePendingGenerationTasks(g, {
      toHtml: plainTextToEditorHtml,
      onError: (reason) => message.error(reason),
      onTaskBound: () => persistGenerationTaskBinding(),
      onTaskComplete: () => persistGenerationTaskBinding(),
    })
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
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
    pendingRemoteSaveType = null
  }

  function startAutoSave() {
    if (!autoSaveEnabled || !canvasContentReady) return
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
    autoSaveTimer = window.setInterval(() => {
      handleSaveCanvas('AUTO')
    }, 8000)
  }

  function markCanvasContentReady() {
    canvasContentReady = true
    startAutoSave()
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

  function persistGenerationTaskBinding() {
    scheduleHistoryPush()
    handleSaveCanvas('AUTO')
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
      ; (g as CanvasGraph).__suppressBlankCloseForConnect = true
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

  function handleTextPickerAction(key: string, nodeId: string) {
    const g = graph.value
    if (!g) return

    selectedNodeId.value = nodeId
    selectedKind.value = 'text'
    syncNodeSelectionHighlight(nodeId)

    if (key === 'write') {
      activePickerNodeId.value = ''
      modelType.value = 'free'
      bumpToolbarRevision()
      updateNodeToolbar()
      scheduleHistoryPush()
      return
    }

    if (key === 'text2video' || key === 'text2image') {
      const cell = g.getCellById(nodeId)
      if (!cell?.isNode()) return

      const data = { ...(cell.getData() as CanvasNodeData) }
      data.mode = 'picker'
      data.textPickerTask = key
      data.textGenState = 'idle'
      cell.setData(data)

      modelType.value = key === 'text2image' ? 'text2image' : 'text2video'

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
    if (showImageGridSplit.value) {
      imageGridSplitPos.value = getNodeCropOverlayPosition(g, node, overlayRoot, 360, 480)
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
    scheduleHistoryPush()
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
    resetImageGridSplit()
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
    resetImageGridSplit()
    resetVideoDialogue()
    resetVideoHdPanel()
    resetVideoFramesPanel()
    closeImageGenPromptBar()
    closeVideoGenPromptBar()
    closeTextExpand()
    exitElementSelectMode()
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
    void onLoadProjects()

    const routeProjectId = router.currentRoute.value.params.id
    if (typeof routeProjectId === 'string' && routeProjectId.trim()) {
      activeProjectId.value = routeProjectId
    }

    if (!graphRef.value) return

    const instance = createGraph(graphRef.value) as CanvasGraph
    instance.__openConnectMenu = openConnectMenuByNodeId
    instance.__openImageDialogue = openImageDialogue
    instance.__deleteCanvasNode = removeNodeById
    instance.__uploadFileToCanvasNode = uploadFileToCanvasNode
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
        updateEdgeDeleteButtonPosition()
        syncViewportNodeVisibility()
      })
    })
    instance.on('translate', () => {
      updateNodeToolbar()
      updateEdgeDeleteButtonPosition()
      syncViewportNodeVisibility()
    })
    instance.on('node:moving', ({ node }) => {
      syncGroupedNodeMove(node)
      if (activeGroupSelection.value) {
        updateGroupToolbarPosition()
      }
      updateNodeToolbar()
      updateEdgeDeleteButtonPosition()
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
    instance.on('edge:mouseenter', handleEdgeMouseEnter)
    instance.on('edge:mouseleave', handleEdgeMouseLeave)
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
    scheduleHistoryPush()

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
    unbindKeyboard()
    unbindGraphDropListeners()
    setCanvasAssetDropHandler(null)
    clearCanvasAssetDrag()
    if (historyPushTimer) clearTimeout(historyPushTimer)
    if (edgeHoverLeaveTimer) window.clearTimeout(edgeHoverLeaveTimer)
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

  return {
    activeGroupSelection,
    addElementGroupFromRecord,
    addFromMenu,
    addImageDialogueSourceRef,
    addImageFromAsset,
    addImageFromFile,
    addImagesFromFiles,
    addNode,
    addPromptImageSourceRef,
    altVoiceTimer,
    applyIncomingImageSource,
    applyZoomAfterChange,
    bindKeyboard,
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
    closeImageGridSplit,
    onImageEraseComplete,
    onImageInpaintComplete,
    onImageInpaintDragStart,
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
    enterElementSelectMode,
    exitElementSelectMode,
    filterUploadFiles,
    finishConnectSpawn,
    generateImageFromPrompt,
    handleImageDialogueSubmit,
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
    listSavedCanvasSkills,
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
    openImageErase,
    openImageInpaint,
    openImageDialogue,
    openImageGenPromptBar,
    openImagePreview,
    openImageToolbarMore,
    openNewProject,
    openTextExpand,
    openVideoGenPromptBar,
    pasteNode,
    pasteNodePayload,
    persistImageGenPrompt,
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
    showImageGenPromptBar,
    showMultiSelectToolbar,
    showNodeToolbar,
    showPromptBar,
    showTextFormatToolbar,
    showToolbarFeatureButtons,
    showVideoGenPromptBar,
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
    videoGenSourceRefs,
    waitForNodeUploadDone,
    zoomFitToScreen,
    zoomIn,
    zoomOut,
    zoomPercent,
    zoomToScale,
  }
}
