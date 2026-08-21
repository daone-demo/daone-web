/**
 * 安装器写入、且尚未进入领域接口的动态方法。
 * 使用方法语法（对参数双变）以便赋值与调用都能通过。
 * 未声明字段不再经 any 索引变成 any，拼写错误会在 unknown 索引上报错。
 *
 * 已按 任务 / 图节点 / 持久化 / 面板 拆分接口；公共返回别名仍为临时 any；保存/项目切换/生成/上传等高风险槽位已补精确签名。
 * 见 quality-gate ANY_TYPE_ALIAS_WHITELIST（owner=canvas-runtime, expire=2026-09-30）。
 */

import type { Graph, Node } from '@antv/x6'
import type { ProjectCanvasResponse } from '@/services/api'
import type { CanvasSnapshot } from '../../../canvasSnapshot'
import type { GroupAiReferenceContext, GroupAiTask } from '../../../groupExecute/types'

/**
 * 动态槽位返回值：跨 install* 赋值前保持宽松。
 * ANY_WHITELIST owner=canvas-runtime expire=2026-09-30：按域收紧具体返回类型后删除本别名。
 */
type CoreRuntimeSlotReturn = any

/** 生成任务 / 对话 / Prompt 相关槽位 */
export interface CoreRuntimeTaskSlots {
  addImageDialogueSourceRef(...args: unknown[]): CoreRuntimeSlotReturn
  addPromptImageSourceRef(...args: unknown[]): CoreRuntimeSlotReturn
  appendImageDialogueDigitalHumanRef(...args: unknown[]): CoreRuntimeSlotReturn
  applyImageDialogueProvenance(...args: unknown[]): CoreRuntimeSlotReturn
  applyIncomingImageSource(...args: unknown[]): CoreRuntimeSlotReturn
  applyVideoGenerationProvenance(...args: unknown[]): CoreRuntimeSlotReturn
  applyZoomAfterChange(...args: unknown[]): CoreRuntimeSlotReturn
  buildVideoDialogueSettingsFromPayload(...args: unknown[]): CoreRuntimeSlotReturn
  clearImageDialoguePreview(...args: unknown[]): CoreRuntimeSlotReturn
  createNodeFromChatTask(...args: unknown[]): CoreRuntimeSlotReturn
  distributeMultiImageGenerationResults(...args: unknown[]): CoreRuntimeSlotReturn
  ensureGenerationResultLoadingNodes(...args: unknown[]): CoreRuntimeSlotReturn
  enterImageDialogueCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  enterVideoGenCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  executeGroupAiImageTask(
    node: Node,
    refCtx: GroupAiReferenceContext,
    options?: { sharedSiblingNodes?: Node[] },
  ): Promise<boolean>
  executeGroupAiTask(
    g: Graph,
    node: Node,
    task: GroupAiTask,
    refCtx: GroupAiReferenceContext,
    scopeIds: Set<string>,
    finishedAssets: Map<string, string>,
  ): Promise<{ success: boolean; resultNodeId: string; sharedResultNodeIds?: string[] }>
  executeGroupAiTextCopyTask(node: Node): Promise<boolean>
  executeGroupAiTextImg2PromptTask(
    g: Graph,
    node: Node,
    refCtx?: GroupAiReferenceContext,
  ): Promise<boolean>
  executeGroupAiVideoTask(node: Node, refCtx: GroupAiReferenceContext): Promise<boolean>
  exitImageDialogueCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  exitVideoGenCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  generateImageFromPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  getActiveImageDialogueTargetNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  getVideoGenSourceLimit(...args: unknown[]): CoreRuntimeSlotReturn
  handleApplyImageGenTask(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageDialogueCanvasPick(...args: unknown[]): CoreRuntimeSlotReturn
  handleImagePromptReverseAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleOpenVideoGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoGenCanvasPick(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoGenerationTaskComplete(...args: unknown[]): CoreRuntimeSlotReturn
  hasImageDialogueSourceRef(...args: unknown[]): CoreRuntimeSlotReturn
  inferGenerationTaskDescriptionFromNode(...args: unknown[]): CoreRuntimeSlotReturn
  isNodeGenerating(...args: unknown[]): CoreRuntimeSlotReturn
  loadImageGenPromptFields(...args: unknown[]): CoreRuntimeSlotReturn
  loadPromptBarContext(...args: unknown[]): CoreRuntimeSlotReturn
  loadVideoGenPromptFields(...args: unknown[]): CoreRuntimeSlotReturn
  normalizeImageDialogueSettings(...args: unknown[]): CoreRuntimeSlotReturn
  normalizeVideoDialogueSettings(...args: unknown[]): CoreRuntimeSlotReturn
  onImageDialogueUploadFiles(...args: unknown[]): CoreRuntimeSlotReturn
  onPromptAddCanvasNode(...args: unknown[]): CoreRuntimeSlotReturn
  onPromptUploadFiles(...args: unknown[]): CoreRuntimeSlotReturn
  onRemoveImageGenSourceRef(...args: unknown[]): CoreRuntimeSlotReturn
  onVideoGenAddCanvasNode(...args: unknown[]): CoreRuntimeSlotReturn
  onVideoGenQuickAction(...args: unknown[]): CoreRuntimeSlotReturn
  onVideoGenUploadFiles(...args: unknown[]): CoreRuntimeSlotReturn
  persistGenerationTaskBinding(...args: unknown[]): CoreRuntimeSlotReturn
  persistImageGenPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  persistPromptBarDraft(...args: unknown[]): CoreRuntimeSlotReturn
  persistVideoGenPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  recordGroupTaskFinishedAsset(...args: unknown[]): CoreRuntimeSlotReturn
  refreshPromptSourcePreviews(...args: unknown[]): CoreRuntimeSlotReturn
  removePromptImageSource(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageDialogueInputOnSourceNode(...args: unknown[]): CoreRuntimeSlotReturn
  resetSourceImageDialogueAfterSuccess(...args: unknown[]): CoreRuntimeSlotReturn
  resetVideoDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  resolveGenerationResultFileName(...args: unknown[]): CoreRuntimeSlotReturn
  resolveImageGenTextSourcePreview(...args: unknown[]): CoreRuntimeSlotReturn
  resolvePromptReferenceAssetIds(...args: unknown[]): CoreRuntimeSlotReturn
  resolveVideoResultLayoutSize(...args: unknown[]): CoreRuntimeSlotReturn
  resolveVideoUpstreamPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  resumeCanvasGenerationTasks(...args: unknown[]): CoreRuntimeSlotReturn
  revealVideoDialogueAfterGenerationFailure(...args: unknown[]): CoreRuntimeSlotReturn
  runBatchDownloadForNodeIds(...args: unknown[]): CoreRuntimeSlotReturn
  runGroupAiGenerationPipeline(
    g: Graph,
    groupId: string,
    tasks: GroupAiTask[],
  ): Promise<void>
  runImagePromptReverseTask(...args: unknown[]): CoreRuntimeSlotReturn
  runImageTo3DTask(...args: unknown[]): CoreRuntimeSlotReturn
  seedPromptImageRefs(...args: unknown[]): CoreRuntimeSlotReturn
  spawnMediaFilesAtPoint(...args: unknown[]): CoreRuntimeSlotReturn
  submitTextPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  syncImageDialogueSourceRefs(...args: unknown[]): CoreRuntimeSlotReturn
  updateChatTaskNodeTitleFromPayload(...args: unknown[]): CoreRuntimeSlotReturn
  updateImageGenPromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updatePromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateVideoGenPromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 图节点 / 选区 / 连线 / 布局相关槽位 */
export interface CoreRuntimeGraphSlots {
  addElementGroupFromRecord(...args: unknown[]): CoreRuntimeSlotReturn
  addFromMenu(...args: unknown[]): CoreRuntimeSlotReturn
  addImageFromAsset(...args: unknown[]): CoreRuntimeSlotReturn
  addImageToMyModels(...args: unknown[]): CoreRuntimeSlotReturn
  addImagesFromFiles(...args: unknown[]): CoreRuntimeSlotReturn
  addNode(...args: unknown[]): CoreRuntimeSlotReturn
  addVideoFromAsset(...args: unknown[]): CoreRuntimeSlotReturn
  addVideoToDialog(...args: unknown[]): CoreRuntimeSlotReturn
  batchInsertAssetsFromLibrary(...args: unknown[]): CoreRuntimeSlotReturn
  bindGraphDropListeners(...args: unknown[]): CoreRuntimeSlotReturn
  bindKeyboard(...args: unknown[]): CoreRuntimeSlotReturn
  bindLongPressPan(...args: unknown[]): CoreRuntimeSlotReturn
  bindScrollerScrollListener(...args: unknown[]): CoreRuntimeSlotReturn
  bumpToolbarRevision(...args: unknown[]): CoreRuntimeSlotReturn
  clearCanvasTextSelection(...args: unknown[]): CoreRuntimeSlotReturn
  clearEdgeHoverState(...args: unknown[]): CoreRuntimeSlotReturn
  clearEdgeSelection(...args: unknown[]): CoreRuntimeSlotReturn
  clearImageElementMarkSelection(...args: unknown[]): CoreRuntimeSlotReturn
  computeImageMarkHintPositions(...args: unknown[]): CoreRuntimeSlotReturn
  copySelectedNode(...args: unknown[]): CoreRuntimeSlotReturn
  copySelectedNodes(...args: unknown[]): CoreRuntimeSlotReturn
  countSkillFiles(...args: unknown[]): CoreRuntimeSlotReturn
  createPastedCanvasNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  dataUrlToFile(...args: unknown[]): CoreRuntimeSlotReturn
  detachImageSourceFromDownstream(...args: unknown[]): CoreRuntimeSlotReturn
  downloadSelectedTextNode(...args: unknown[]): CoreRuntimeSlotReturn
  duplicateSelectedNodes(...args: unknown[]): CoreRuntimeSlotReturn
  endSpacePan(...args: unknown[]): CoreRuntimeSlotReturn
  ensureSelectedImageNodeDimensions(...args: unknown[]): CoreRuntimeSlotReturn
  enterElementSelectMode(...args: unknown[]): CoreRuntimeSlotReturn
  exitElementSelectMode(...args: unknown[]): CoreRuntimeSlotReturn
  extractLatestRevision(...args: unknown[]): CoreRuntimeSlotReturn
  filterUploadFiles(...args: unknown[]): CoreRuntimeSlotReturn
  findElementMarkById(...args: unknown[]): CoreRuntimeSlotReturn
  findGroupBlankAreaAtClientPoint(...args: unknown[]): CoreRuntimeSlotReturn
  findGroupIdAtContainerPoint(...args: unknown[]): CoreRuntimeSlotReturn
  findMediaNodeAtClientPoint(...args: unknown[]): CoreRuntimeSlotReturn
  findNodeAtGraphLocalPoint(...args: unknown[]): CoreRuntimeSlotReturn
  finishConnectSpawn(...args: unknown[]): CoreRuntimeSlotReturn
  getActiveVideoTargetNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  getEdgeReleasePoint(...args: unknown[]): CoreRuntimeSlotReturn
  getElementMarkOwnerNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  getGraphCenter(...args: unknown[]): CoreRuntimeSlotReturn
  getGraphSelectedNodeIds(...args: unknown[]): CoreRuntimeSlotReturn
  getHorizontalUploadSpawnPoint(...args: unknown[]): CoreRuntimeSlotReturn
  getMultiUploadSpawnPoint(...args: unknown[]): CoreRuntimeSlotReturn
  getSelectedNode(...args: unknown[]): CoreRuntimeSlotReturn
  getTextNodePlainContent(...args: unknown[]): CoreRuntimeSlotReturn
  goUserCenter(...args: unknown[]): CoreRuntimeSlotReturn
  handleBlankDblClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleCanvasAssetDrop(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeConnected(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeDeletePointerEnter(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeDeletePointerLeave(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeMouseEnter(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeMouseLeave(...args: unknown[]): CoreRuntimeSlotReturn
  handleExportCanvas(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupAddToToolbox(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupBatchDownload(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupBlankMouseDown(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupExecute(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupLayout(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupToStoryboard(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupedNodeMoved(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageAnnotateAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageCapabilityAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageCustomAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageDownloadAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageEditTextAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageEraseAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageExpandAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageGridSplitAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageInpaintAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageInpaintCapabilityAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageInpaintSubmit(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageMarkRecognize(...args: unknown[]): CoreRuntimeSlotReturn
  handleImageNodeDblClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleLogout(...args: unknown[]): CoreRuntimeSlotReturn
  handleMediaNodeContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  handleMergeStoryboardGroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectBatchDownload(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectGroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectLayout(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeDataChange(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeEdgeLinked(...args: unknown[]): CoreRuntimeSlotReturn
  handleRedo(...args: unknown[]): CoreRuntimeSlotReturn
  handleTextPickerAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleTidyCanvas(...args: unknown[]): CoreRuntimeSlotReturn
  handleUndo(...args: unknown[]): CoreRuntimeSlotReturn
  handleUngroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleUserMenuAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoCapabilityAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoDownloadAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoNodeDblClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoPickerAction(...args: unknown[]): CoreRuntimeSlotReturn
  hasCanvasFileDrag(...args: unknown[]): CoreRuntimeSlotReturn
  isGraphNodePointerTarget(...args: unknown[]): CoreRuntimeSlotReturn
  isImageMarkAnalysisInProgress(...args: unknown[]): CoreRuntimeSlotReturn
  isImageUploadFile(...args: unknown[]): CoreRuntimeSlotReturn
  isVideoUploadFile(...args: unknown[]): CoreRuntimeSlotReturn
  linkImageSourceFromEdge(...args: unknown[]): CoreRuntimeSlotReturn
  loadAssetCenterItems(...args: unknown[]): CoreRuntimeSlotReturn
  mapElementGroupRecord(...args: unknown[]): CoreRuntimeSlotReturn
  mapSkillToAssetCenterItem(...args: unknown[]): CoreRuntimeSlotReturn
  markCanvasContentReady(...args: unknown[]): CoreRuntimeSlotReturn
  moveNodeLayer(...args: unknown[]): CoreRuntimeSlotReturn
  normalizeCutoutMode(...args: unknown[]): CoreRuntimeSlotReturn
  notifyTextNodeUpdated(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasDragEnter(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasDragLeave(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasDragOver(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasFileDrop(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasGroupBlankPointerMove(...args: unknown[]): CoreRuntimeSlotReturn
  onCanvasImageContextMenuCapture(...args: unknown[]): CoreRuntimeSlotReturn
  onConnectMenuItem(...args: unknown[]): CoreRuntimeSlotReturn
  onFileSelected(...args: unknown[]): CoreRuntimeSlotReturn
  onGoHome(...args: unknown[]): CoreRuntimeSlotReturn
  onGraphDragOver(...args: unknown[]): CoreRuntimeSlotReturn
  onGraphDrop(...args: unknown[]): CoreRuntimeSlotReturn
  onGroupOverlayDragStart(...args: unknown[]): CoreRuntimeSlotReturn
  onGroupOverlayResizeStart(...args: unknown[]): CoreRuntimeSlotReturn
  onGroupOverlaySelectGroup(...args: unknown[]): CoreRuntimeSlotReturn
  onGroupOverlayTitleChange(...args: unknown[]): CoreRuntimeSlotReturn
  onImageCropComplete(...args: unknown[]): CoreRuntimeSlotReturn
  onImageToolbarAction(...args: unknown[]): CoreRuntimeSlotReturn
  onMenuItem(...args: unknown[]): CoreRuntimeSlotReturn
  onPageShow(...args: unknown[]): CoreRuntimeSlotReturn
  onPageUnload(...args: unknown[]): CoreRuntimeSlotReturn
  onRemoveVideoSourceRef(...args: unknown[]): CoreRuntimeSlotReturn
  onScrollerScroll(...args: unknown[]): CoreRuntimeSlotReturn
  onTextExpandInput(...args: unknown[]): CoreRuntimeSlotReturn
  onTextFormatAction(...args: unknown[]): CoreRuntimeSlotReturn
  onVideoHdStart(...args: unknown[]): CoreRuntimeSlotReturn
  onVisibilityChange(...args: unknown[]): CoreRuntimeSlotReturn
  onZoomMenuAction(...args: unknown[]): CoreRuntimeSlotReturn
  paintImageResizeOverlay(...args: unknown[]): CoreRuntimeSlotReturn
  parseCanvasAssetDragPayload(...args: unknown[]): CoreRuntimeSlotReturn
  parseCanvasElementGroupDragPayload(...args: unknown[]): CoreRuntimeSlotReturn
  pasteNode(...args: unknown[]): CoreRuntimeSlotReturn
  pasteNodePayload(...args: unknown[]): CoreRuntimeSlotReturn
  persistCanvasToServer(...args: unknown[]): CoreRuntimeSlotReturn
  persistTextExpandContent(...args: unknown[]): CoreRuntimeSlotReturn
  plainTextToEditorHtml(...args: unknown[]): CoreRuntimeSlotReturn
  positionImageContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  recenterToNodes(...args: unknown[]): CoreRuntimeSlotReturn
  removeConnectPreviewEdge(...args: unknown[]): CoreRuntimeSlotReturn
  removeHoveredEdge(...args: unknown[]): CoreRuntimeSlotReturn
  removeNodeById(...args: unknown[]): CoreRuntimeSlotReturn
  removeSelectedEdge(...args: unknown[]): CoreRuntimeSlotReturn
  removeSelectedElementMark(...args: unknown[]): CoreRuntimeSlotReturn
  removeSelectedNodes(...args: unknown[]): CoreRuntimeSlotReturn
  requestCanvasUpload(nodeId: string): void
  resetCanvasInteractionState(...args: unknown[]): CoreRuntimeSlotReturn
  resetCanvasPanCursorState(...args: unknown[]): CoreRuntimeSlotReturn
  resetGroupBlankHoverCursor(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageCrop(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageEditText(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageExpand(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageGridSplit(...args: unknown[]): CoreRuntimeSlotReturn
  resetImageToolbarMore(...args: unknown[]): CoreRuntimeSlotReturn
  resetVideoFramesPanel(...args: unknown[]): CoreRuntimeSlotReturn
  resetVideoHdPanel(...args: unknown[]): CoreRuntimeSlotReturn
  resolveGroupDragPreviewNode(...args: unknown[]): CoreRuntimeSlotReturn
  resolveLibraryAssetBindId(...args: unknown[]): CoreRuntimeSlotReturn
  resolveMarkableImageNodeIds(...args: unknown[]): CoreRuntimeSlotReturn
  resolveOverlayGroup(...args: unknown[]): CoreRuntimeSlotReturn
  restoreCanvasPickTargetSelection(...args: unknown[]): CoreRuntimeSlotReturn
  returnFromElementSelect(...args: unknown[]): CoreRuntimeSlotReturn
  sanitizePastedNodeData(...args: unknown[]): CoreRuntimeSlotReturn
  scheduleUpdateNodeToolbar(...args: unknown[]): CoreRuntimeSlotReturn
  scheduleViewportNodeVisibilitySync(...args: unknown[]): CoreRuntimeSlotReturn
  selectElementMark(...args: unknown[]): CoreRuntimeSlotReturn
  selectGraphNodes(...args: unknown[]): CoreRuntimeSlotReturn
  selectSingleGraphNode(...args: unknown[]): CoreRuntimeSlotReturn
  setConnectSourceNodeMetaHidden(...args: unknown[]): CoreRuntimeSlotReturn
  setRubberbandEnabled(...args: unknown[]): CoreRuntimeSlotReturn
  setTextEditorToolbarActive(...args: unknown[]): CoreRuntimeSlotReturn
  setupMinimap(...args: unknown[]): CoreRuntimeSlotReturn
  shouldHideImageDimensionOverlay(...args: unknown[]): CoreRuntimeSlotReturn
  stopGroupOverlayDrag(...args: unknown[]): CoreRuntimeSlotReturn
  syncConnectPreviewEdgeTarget(...args: unknown[]): CoreRuntimeSlotReturn
  syncEdgeHighlight(...args: unknown[]): CoreRuntimeSlotReturn
  syncGroupAiProvenance(...args: unknown[]): CoreRuntimeSlotReturn
  syncGroupBlankHoverCursor(...args: unknown[]): CoreRuntimeSlotReturn
  syncGroupedNodeMove(...args: unknown[]): CoreRuntimeSlotReturn
  syncImageElementMarkSelection(...args: unknown[]): CoreRuntimeSlotReturn
  syncImageMarkTargets(...args: unknown[]): CoreRuntimeSlotReturn
  syncNodeCount(...args: unknown[]): CoreRuntimeSlotReturn
  syncNodeSelectionHighlight(...args: unknown[]): CoreRuntimeSlotReturn
  syncSelectionFromGraph(...args: unknown[]): CoreRuntimeSlotReturn
  syncVideoNodeAspectRatio(...args: unknown[]): CoreRuntimeSlotReturn
  syncViewportNodeVisibility(...args: unknown[]): CoreRuntimeSlotReturn
  syncZoom(...args: unknown[]): CoreRuntimeSlotReturn
  teardownMinimap(...args: unknown[]): CoreRuntimeSlotReturn
  triggerCanvasUploadShortcut(...args: unknown[]): CoreRuntimeSlotReturn
  triggerFileInputClick(...args: unknown[]): CoreRuntimeSlotReturn
  unbindGraphDropListeners(...args: unknown[]): CoreRuntimeSlotReturn
  unbindKeyboard(...args: unknown[]): CoreRuntimeSlotReturn
  unbindLongPressPan(...args: unknown[]): CoreRuntimeSlotReturn
  unbindScrollerScrollListener(...args: unknown[]): CoreRuntimeSlotReturn
  updateAddMenuPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateConnectMenuPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateEdgeDeleteButtonPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateGroupToolbarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateImageMarkHintPositions(...args: unknown[]): CoreRuntimeSlotReturn
  updateImageResizeOverlay(...args: unknown[]): CoreRuntimeSlotReturn
  updateMultiSelectToolbarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateTextFormatToolbarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  uploadFileToCanvasNode(...args: unknown[]): CoreRuntimeSlotReturn
  uploadGridSplitImagesInBackground(...args: unknown[]): CoreRuntimeSlotReturn
  waitForNodeUploadDone(...args: unknown[]): CoreRuntimeSlotReturn
  zoomFitToScreen(...args: unknown[]): CoreRuntimeSlotReturn
  zoomIn(...args: unknown[]): CoreRuntimeSlotReturn
  zoomOut(...args: unknown[]): CoreRuntimeSlotReturn
  zoomToScale(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 持久化 / 项目切换 / 历史相关槽位 */
export interface CoreRuntimePersistenceSlots {
  applyProjectCanvasPayload(payload: ProjectCanvasResponse): boolean
  applyToolbarImageGenerationSnapshot(...args: unknown[]): CoreRuntimeSlotReturn
  drainPendingSaveJobs(...args: unknown[]): CoreRuntimeSlotReturn
  enqueuePendingSaveJob(...args: unknown[]): CoreRuntimeSlotReturn
  ensureCanvasReadyForAutoSave(...args: unknown[]): CoreRuntimeSlotReturn
  findCanvasProject(...args: unknown[]): CoreRuntimeSlotReturn
  getHistoryMeta(...args: unknown[]): CoreRuntimeSlotReturn
  handleGroupSaveToSkill(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectSaveToAssets(...args: unknown[]): CoreRuntimeSlotReturn
  handleSubmitSaveSkill(...args: unknown[]): CoreRuntimeSlotReturn
  listSavedCanvasSkills(...args: unknown[]): CoreRuntimeSlotReturn
  mergePendingSaveType(...args: unknown[]): CoreRuntimeSlotReturn
  onLoadProjects(...args: unknown[]): CoreRuntimeSlotReturn
  pauseAutoSave(...args: unknown[]): CoreRuntimeSlotReturn
  recordCanvasDescription(...args: unknown[]): CoreRuntimeSlotReturn
  recordUploadCanvasDescription(...args: unknown[]): CoreRuntimeSlotReturn
  resolveActiveProjectId(...args: unknown[]): CoreRuntimeSlotReturn
  runRemoteCanvasSaveJob(job: {
    projectId: string
    snapshot: CanvasSnapshot
    type: 'MANUAL' | 'AUTO'
    changeEpoch?: number
  }): Promise<boolean>
  selectProject(projectId: string): Promise<void>
  stopAutoSave(...args: unknown[]): CoreRuntimeSlotReturn
  syncHistoryState(...args: unknown[]): CoreRuntimeSlotReturn
  syncPendingRemoteSaveTypeFlag(...args: unknown[]): CoreRuntimeSlotReturn
  syncVideoSourceRefsSnapshot(...args: unknown[]): CoreRuntimeSlotReturn
  upsertCanvasProject(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 面板 / 菜单 / 工具栏开关与可见性槽位 */
export interface CoreRuntimePanelSlots {
  canAutoOpenImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canAutoOpenVideoDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canNodeHostImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenImageContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenMediaContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenVideoContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canShowImageToolbar(...args: unknown[]): CoreRuntimeSlotReturn
  canShowVideoToolbar(...args: unknown[]): CoreRuntimeSlotReturn
  cancelBlankPanGesture(...args: unknown[]): CoreRuntimeSlotReturn
  cancelCurrentOperation(...args: unknown[]): CoreRuntimeSlotReturn
  cancelVideoToolbarDefer(...args: unknown[]): CoreRuntimeSlotReturn
  closeAddMenu(...args: unknown[]): CoreRuntimeSlotReturn
  closeAssetCenterPanel(...args: unknown[]): CoreRuntimeSlotReturn
  closeConnectMenu(...args: unknown[]): CoreRuntimeSlotReturn
  closeHistoryPanel(...args: unknown[]): CoreRuntimeSlotReturn
  closeImageContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  closeImageCrop(...args: unknown[]): CoreRuntimeSlotReturn
  closeImageGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  closeImagePreview(...args: unknown[]): CoreRuntimeSlotReturn
  closeImageToolbarMore(...args: unknown[]): CoreRuntimeSlotReturn
  closeNodeDialoguePanels(...args: unknown[]): CoreRuntimeSlotReturn
  closeProjectMenu(...args: unknown[]): CoreRuntimeSlotReturn
  closeSaveSkillPopover(...args: unknown[]): CoreRuntimeSlotReturn
  closeShortcutsPanel(...args: unknown[]): CoreRuntimeSlotReturn
  closeTextExpand(...args: unknown[]): CoreRuntimeSlotReturn
  closeTextPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  closeUserMenu(...args: unknown[]): CoreRuntimeSlotReturn
  closeVideoGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  closeVideoSubPanels(...args: unknown[]): CoreRuntimeSlotReturn
  closeZoomMenu(...args: unknown[]): CoreRuntimeSlotReturn
  dismissCanvasNodeChromeForShellPanel(...args: unknown[]): CoreRuntimeSlotReturn
  dismissOneCanvasLayer(...args: unknown[]): CoreRuntimeSlotReturn
  dismissTextPickerPanels(...args: unknown[]): CoreRuntimeSlotReturn
  hideImageMarkHint(...args: unknown[]): CoreRuntimeSlotReturn
  openAddMenuAtGraphPoint(...args: unknown[]): CoreRuntimeSlotReturn
  openAssetCenterPanel(...args: unknown[]): CoreRuntimeSlotReturn
  openAssetsPanel(...args: unknown[]): CoreRuntimeSlotReturn
  openComboModal(...args: unknown[]): CoreRuntimeSlotReturn
  openConnectMenu(...args: unknown[]): CoreRuntimeSlotReturn
  openConnectMenuByNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  openFileUploadPicker(...args: unknown[]): CoreRuntimeSlotReturn
  openImageCrop(...args: unknown[]): CoreRuntimeSlotReturn
  openImageCustom(...args: unknown[]): CoreRuntimeSlotReturn
  openImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  openImageEditText(...args: unknown[]): CoreRuntimeSlotReturn
  openImageErase(...args: unknown[]): CoreRuntimeSlotReturn
  openImageExpand(...args: unknown[]): CoreRuntimeSlotReturn
  openImageGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  openImageGridSplit(...args: unknown[]): CoreRuntimeSlotReturn
  openImageInpaint(...args: unknown[]): CoreRuntimeSlotReturn
  openImagePreview(...args: unknown[]): CoreRuntimeSlotReturn
  openImageToolbarMore(...args: unknown[]): CoreRuntimeSlotReturn
  openMediaContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  openMediaPreview(...args: unknown[]): CoreRuntimeSlotReturn
  openNewProject(...args: unknown[]): CoreRuntimeSlotReturn
  openTextExpand(...args: unknown[]): CoreRuntimeSlotReturn
  openVideoDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  openVideoGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  showImageMarkHint(...args: unknown[]): CoreRuntimeSlotReturn
  toggleAddMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleAssetCenterPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleAssetsPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleCanvasBgTheme(...args: unknown[]): CoreRuntimeSlotReturn
  toggleGrid(...args: unknown[]): CoreRuntimeSlotReturn
  toggleHistoryPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageAddToDialogMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageDialogueCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageHdMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageNodeLock(...args: unknown[]): CoreRuntimeSlotReturn
  toggleImageToolbarMoreMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleMinimap(...args: unknown[]): CoreRuntimeSlotReturn
  togglePanMode(...args: unknown[]): CoreRuntimeSlotReturn
  toggleProjectMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleShortcutsPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleUserMenu(...args: unknown[]): CoreRuntimeSlotReturn
  toggleVideoDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  toggleVideoFramesPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleVideoGenCanvasPickMode(...args: unknown[]): CoreRuntimeSlotReturn
  toggleVideoHdPanel(...args: unknown[]): CoreRuntimeSlotReturn
  toggleZoomMenu(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 动态安装槽位总览：由四域接口组合 */
export type CoreRuntimeInstallSlots =
  CoreRuntimeTaskSlots &
  CoreRuntimeGraphSlots &
  CoreRuntimePersistenceSlots &
  CoreRuntimePanelSlots
