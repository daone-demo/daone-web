/**
 * 安装器写入、且尚未进入领域接口的动态方法。
 * 使用方法语法（对参数双变）以便赋值与调用都能通过。
 * 未声明字段不再经 any 索引变成 any，拼写错误会在 unknown 索引上报错。
 *
 * 已按 任务 / 图节点 / 持久化 / 面板 拆分接口；公共返回别名仍为临时 any；任务恢复/对话引用/节点批处理/上传/持久化队列/面板开关等高风险槽位继续补精确签名。
 * 见 quality-gate ANY_TYPE_ALIAS_WHITELIST（owner=canvas-runtime, expire=2026-09-30）。
 */

import type { Graph, Node } from '@antv/x6'
import type { ProjectCanvasResponse } from '@/services/api'
import type { CanvasSnapshot, CanvasSnapshotMeta } from '../../../canvasSnapshot'
import type { ChatTaskCreatedPayload } from '../../../chatGenerationTask'
import type { GenerationTaskResult } from '../../../generationTaskTypes'
import type { GroupAiReferenceContext, GroupAiTask } from '../../../groupExecute/types'
import type { ResultPlacement } from '../../../imageGen'
import type {
  CanvasAssetDragPayload,
  CanvasNodeData,
  ImageDialogueSubmitPayload,
  ImageGenTask,
  ImageSourceRef,
  NodeKind,
  VideoDialogueSubmitPayload,
} from '../../../constants'
import type { UploadFilter, CanvasProjectListItem } from '../state'

/**
 * 动态槽位返回值：跨 install* 赋值前保持宽松。
 * ANY_WHITELIST owner=canvas-runtime expire=2026-09-30：按域收紧具体返回类型后删除本别名。
 */
type CoreRuntimeSlotReturn = any

/** 生成任务 / 对话 / Prompt 相关槽位 */
export interface CoreRuntimeTaskSlots {
  addImageDialogueSourceRef(
    payload: {
      nodeId?: string
      assetId?: string
      previewUrl: string
      fileName?: string
    },
    targetNodeId?: string,
  ): void
  addPromptImageSourceRef(payload: {
    nodeId?: string
    assetId?: string
    previewUrl: string
    fileName?: string
  }): void
  appendImageDialogueDigitalHumanRef(...args: unknown[]): CoreRuntimeSlotReturn
  applyImageDialogueProvenance(...args: unknown[]): CoreRuntimeSlotReturn
  applyIncomingImageSource(target: Node, source: Node): boolean
  applyVideoGenerationProvenance(...args: unknown[]): CoreRuntimeSlotReturn
  applyZoomAfterChange(): void
  buildVideoDialogueSettingsFromPayload(...args: unknown[]): CoreRuntimeSlotReturn
  clearImageDialoguePreview(...args: unknown[]): CoreRuntimeSlotReturn
  createNodeFromChatTask(payload: ChatTaskCreatedPayload): Node | null
  distributeMultiImageGenerationResults(
    g: Graph,
    sourceNode: Node,
    resultNodes: Node[],
    allResults: GenerationTaskResult[],
    config: {
      title: string
      sourceFileName: string
      buildFileName: (sourceFileName: string) => string
      placement?: ResultPlacement
    },
  ): Promise<Node[]>
  ensureGenerationResultLoadingNodes(
    g: Graph,
    sourceNode: Node,
    resultNodes: Node[],
    totalCount: number,
    config: {
      title: string
      sourceFileName: string
      buildFileName: (sourceFileName: string) => string
      placement?: ResultPlacement
      snapshotSourceNode?: Node
    },
  ): void
  enterImageDialogueCanvasPickMode(): void
  enterVideoGenCanvasPickMode(): void
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
  exitImageDialogueCanvasPickMode(): void
  exitVideoGenCanvasPickMode(): void
  generateImageFromPrompt(): Promise<void>
  getActiveImageDialogueTargetNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  getVideoGenSourceLimit(...args: unknown[]): CoreRuntimeSlotReturn
  handleApplyImageGenTask(nodeId: string, task: ImageGenTask): void
  handleImageDialogueCanvasPick(...args: unknown[]): CoreRuntimeSlotReturn
  handleImagePromptReverseAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleOpenVideoGenPromptBar(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoGenCanvasPick(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoGenerationTaskComplete(nodeId: string, success: boolean): void
  hasImageDialogueSourceRef(targetNodeId: string, imageNodeId: string, previewUrl: string): boolean
  inferGenerationTaskDescriptionFromNode(...args: unknown[]): CoreRuntimeSlotReturn
  isNodeGenerating(data: CanvasNodeData | null | undefined): boolean
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
  persistGenerationTaskBinding(
    node?: Node,
    options?: { detail?: string; taskType?: string },
  ): void
  persistImageGenPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  persistPromptBarDraft(...args: unknown[]): CoreRuntimeSlotReturn
  persistVideoGenPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  recordGroupTaskFinishedAsset(...args: unknown[]): CoreRuntimeSlotReturn
  refreshPromptSourcePreviews(...args: unknown[]): CoreRuntimeSlotReturn
  removePromptImageSource(sourceNodeId?: string): void
  resetImageDialogue(): void
  resetImageDialogueInputOnSourceNode(...args: unknown[]): CoreRuntimeSlotReturn
  resetSourceImageDialogueAfterSuccess(...args: unknown[]): CoreRuntimeSlotReturn
  resetVideoDialogue(): void
  resolveGenerationResultFileName(...args: unknown[]): CoreRuntimeSlotReturn
  resolveImageGenTextSourcePreview(...args: unknown[]): CoreRuntimeSlotReturn
  resolvePromptReferenceAssetIds(...args: unknown[]): CoreRuntimeSlotReturn
  resolveVideoResultLayoutSize(...args: unknown[]): CoreRuntimeSlotReturn
  resolveVideoUpstreamPrompt(...args: unknown[]): CoreRuntimeSlotReturn
  resumeCanvasGenerationTasks(): void
  revealVideoDialogueAfterGenerationFailure(...args: unknown[]): CoreRuntimeSlotReturn
  runBatchDownloadForNodeIds(nodeIds: string[]): Promise<void>
  runGroupAiGenerationPipeline(g: Graph, groupId: string, tasks: GroupAiTask[]): Promise<void>
  runImagePromptReverseTask(...args: unknown[]): CoreRuntimeSlotReturn
  runImageTo3DTask(...args: unknown[]): CoreRuntimeSlotReturn
  seedPromptImageRefs(data: CanvasNodeData): ImageSourceRef[]
  spawnMediaFilesAtPoint(...args: unknown[]): CoreRuntimeSlotReturn
  submitTextPrompt(
    payload?: VideoDialogueSubmitPayload | ImageDialogueSubmitPayload,
  ): Promise<void>
  syncImageDialogueSourceRefs(targetNode: Node, sourceRefs: ImageSourceRef[]): void
  updateChatTaskNodeTitleFromPayload(...args: unknown[]): CoreRuntimeSlotReturn
  updateImageGenPromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updatePromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
  updateVideoGenPromptBarPosition(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 图节点 / 选区 / 连线 / 布局相关槽位 */
export interface CoreRuntimeGraphSlots {
  addElementGroupFromRecord(...args: unknown[]): CoreRuntimeSlotReturn
  addFromMenu(kind: NodeKind): void
  addImageFromAsset(...args: unknown[]): CoreRuntimeSlotReturn
  addImageToMyModels(...args: unknown[]): CoreRuntimeSlotReturn
  addImagesFromFiles(files: File[]): Promise<Node[]>
  addNode(kind: NodeKind, point?: { x: number; y: number }): void
  addVideoFromAsset(...args: unknown[]): CoreRuntimeSlotReturn
  addVideoToDialog(...args: unknown[]): CoreRuntimeSlotReturn
  batchInsertAssetsFromLibrary(assets: CanvasAssetDragPayload[]): number
  bindGraphDropListeners(...args: unknown[]): CoreRuntimeSlotReturn
  bindKeyboard(): void
  bindLongPressPan(...args: unknown[]): CoreRuntimeSlotReturn
  bindScrollerScrollListener(...args: unknown[]): CoreRuntimeSlotReturn
  bumpToolbarRevision(...args: unknown[]): CoreRuntimeSlotReturn
  clearCanvasTextSelection(...args: unknown[]): CoreRuntimeSlotReturn
  clearEdgeHoverState(...args: unknown[]): CoreRuntimeSlotReturn
  clearEdgeSelection(...args: unknown[]): CoreRuntimeSlotReturn
  clearImageElementMarkSelection(...args: unknown[]): CoreRuntimeSlotReturn
  computeImageMarkHintPositions(...args: unknown[]): CoreRuntimeSlotReturn
  copySelectedNode(): void
  copySelectedNodes(): void
  countSkillFiles(...args: unknown[]): CoreRuntimeSlotReturn
  createPastedCanvasNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  dataUrlToFile(...args: unknown[]): CoreRuntimeSlotReturn
  detachImageSourceFromDownstream(...args: unknown[]): CoreRuntimeSlotReturn
  downloadSelectedTextNode(...args: unknown[]): CoreRuntimeSlotReturn
  duplicateSelectedNodes(): void
  endSpacePan(...args: unknown[]): CoreRuntimeSlotReturn
  ensureSelectedImageNodeDimensions(...args: unknown[]): CoreRuntimeSlotReturn
  enterElementSelectMode(...args: unknown[]): CoreRuntimeSlotReturn
  exitElementSelectMode(...args: unknown[]): CoreRuntimeSlotReturn
  extractLatestRevision(...args: unknown[]): CoreRuntimeSlotReturn
  filterUploadFiles(files: File[], filter: UploadFilter): File[]
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
  getGraphSelectedNodeIds(): string[]
  getHorizontalUploadSpawnPoint(...args: unknown[]): CoreRuntimeSlotReturn
  getMultiUploadSpawnPoint(...args: unknown[]): CoreRuntimeSlotReturn
  getSelectedNode(): Node | null
  getTextNodePlainContent(...args: unknown[]): CoreRuntimeSlotReturn
  goUserCenter(): void
  handleBlankDblClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleCanvasAssetDrop(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeConnected(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeDeletePointerEnter(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeDeletePointerLeave(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeMouseEnter(...args: unknown[]): CoreRuntimeSlotReturn
  handleEdgeMouseLeave(...args: unknown[]): CoreRuntimeSlotReturn
  handleExportCanvas(): void
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
  handleLogout(): void
  handleMediaNodeContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  handleMergeStoryboardGroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectBatchDownload(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectGroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectLayout(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeDataChange(...args: unknown[]): CoreRuntimeSlotReturn
  handleNodeEdgeLinked(...args: unknown[]): CoreRuntimeSlotReturn
  handleRedo(): void
  handleTextPickerAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleTidyCanvas(): void
  handleUndo(): void
  handleUngroup(...args: unknown[]): CoreRuntimeSlotReturn
  handleUserMenuAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoCapabilityAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoDownloadAction(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoNodeDblClick(...args: unknown[]): CoreRuntimeSlotReturn
  handleVideoPickerAction(...args: unknown[]): CoreRuntimeSlotReturn
  hasCanvasFileDrag(...args: unknown[]): CoreRuntimeSlotReturn
  isGraphNodePointerTarget(...args: unknown[]): CoreRuntimeSlotReturn
  isImageMarkAnalysisInProgress(...args: unknown[]): CoreRuntimeSlotReturn
  isImageUploadFile(file: File): boolean
  isVideoUploadFile(file: File): boolean
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
  onFileSelected(event: Event): void
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
  pasteNode(): void
  pasteNodePayload(...args: unknown[]): CoreRuntimeSlotReturn
  persistCanvasToServer(
    projectId: string,
    snapshot: CanvasSnapshot,
    saveType: 'MANUAL' | 'AUTO',
    project?: CanvasProjectListItem,
    saveEpoch?: number,
  ): Promise<void>
  persistTextExpandContent(...args: unknown[]): CoreRuntimeSlotReturn
  plainTextToEditorHtml(...args: unknown[]): CoreRuntimeSlotReturn
  positionImageContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  recenterToNodes(...args: unknown[]): CoreRuntimeSlotReturn
  removeConnectPreviewEdge(...args: unknown[]): CoreRuntimeSlotReturn
  removeHoveredEdge(...args: unknown[]): CoreRuntimeSlotReturn
  removeNodeById(nodeId: string): void
  removeSelectedEdge(): boolean
  removeSelectedElementMark(...args: unknown[]): CoreRuntimeSlotReturn
  removeSelectedNodes(): void
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
  selectGraphNodes(target: Node | string | (Node | string)[]): void
  selectSingleGraphNode(node: Node): void
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
  syncNodeCount(): void
  syncNodeSelectionHighlight(...args: unknown[]): CoreRuntimeSlotReturn
  syncSelectionFromGraph(...args: unknown[]): CoreRuntimeSlotReturn
  syncVideoNodeAspectRatio(...args: unknown[]): CoreRuntimeSlotReturn
  syncViewportNodeVisibility(...args: unknown[]): CoreRuntimeSlotReturn
  syncZoom(...args: unknown[]): CoreRuntimeSlotReturn
  teardownMinimap(...args: unknown[]): CoreRuntimeSlotReturn
  triggerCanvasUploadShortcut(): void
  triggerFileInputClick(...args: unknown[]): CoreRuntimeSlotReturn
  unbindGraphDropListeners(...args: unknown[]): CoreRuntimeSlotReturn
  unbindKeyboard(): void
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
  uploadFileToCanvasNode(nodeId: string, file: File): void
  uploadGridSplitImagesInBackground(...args: unknown[]): CoreRuntimeSlotReturn
  waitForNodeUploadDone(node: Node): Promise<Node>
  zoomFitToScreen(): void
  zoomIn(): void
  zoomOut(): void
  zoomToScale(scale: number): void
}

/** 持久化 / 项目切换 / 历史相关槽位 */
export interface CoreRuntimePersistenceSlots {
  applyProjectCanvasPayload(payload: ProjectCanvasResponse): boolean
  applyToolbarImageGenerationSnapshot(...args: unknown[]): CoreRuntimeSlotReturn
  drainPendingSaveJobs(): Promise<void>
  enqueuePendingSaveJob(job: {
    projectId: string
    snapshot: CanvasSnapshot
    type: 'MANUAL' | 'AUTO'
    changeEpoch: number
  }): Promise<boolean>
  ensureCanvasReadyForAutoSave(): boolean
  findCanvasProject(projectId: string): CanvasProjectListItem | undefined
  getHistoryMeta(): CanvasSnapshotMeta
  handleGroupSaveToSkill(...args: unknown[]): CoreRuntimeSlotReturn
  handleMultiSelectSaveToAssets(...args: unknown[]): CoreRuntimeSlotReturn
  handleSubmitSaveSkill(...args: unknown[]): CoreRuntimeSlotReturn
  listSavedCanvasSkills(...args: unknown[]): CoreRuntimeSlotReturn
  mergePendingSaveType(...args: unknown[]): CoreRuntimeSlotReturn
  onLoadProjects(): Promise<void>
  pauseAutoSave(): void
  recordCanvasDescription(description: string, taskType?: string): void
  recordUploadCanvasDescription(...args: unknown[]): CoreRuntimeSlotReturn
  resolveActiveProjectId(): string
  runRemoteCanvasSaveJob(job: {
    projectId: string
    snapshot: CanvasSnapshot
    type: 'MANUAL' | 'AUTO'
    changeEpoch?: number
  }): Promise<boolean>
  selectProject(projectId: string): Promise<void>
  stopAutoSave(): void
  syncHistoryState(): void
  syncPendingRemoteSaveTypeFlag(...args: unknown[]): CoreRuntimeSlotReturn
  syncVideoSourceRefsSnapshot(...args: unknown[]): CoreRuntimeSlotReturn
  upsertCanvasProject(id: string, title: string, saved?: boolean): void
}

/** 面板 / 菜单 / 工具栏开关与可见性槽位 */
export interface CoreRuntimePanelSlots {
  canAutoOpenImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canAutoOpenVideoDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canNodeHostImageDialogue(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenImageContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenMediaContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canOpenVideoContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  canShowImageToolbar(data: CanvasNodeData | null | undefined): boolean
  canShowVideoToolbar(data: CanvasNodeData | null | undefined): boolean
  cancelBlankPanGesture(...args: unknown[]): CoreRuntimeSlotReturn
  cancelCurrentOperation(): boolean
  cancelVideoToolbarDefer(...args: unknown[]): CoreRuntimeSlotReturn
  closeAddMenu(): void
  closeAssetCenterPanel(): void
  closeConnectMenu(): void
  closeHistoryPanel(): void
  closeImageContextMenu(): void
  closeImageCrop(): void
  closeImageGenPromptBar(): void
  closeImagePreview(): void
  closeImageToolbarMore(): void
  closeNodeDialoguePanels(): void
  closeProjectMenu(): void
  closeSaveSkillPopover(): void
  closeShortcutsPanel(): void
  closeTextExpand(): void
  closeTextPromptBar(): void
  closeUserMenu(): void
  closeVideoGenPromptBar(): void
  closeVideoSubPanels(except?: 'dialogue' | 'hd' | 'frames'): void
  closeZoomMenu(): void
  dismissCanvasNodeChromeForShellPanel(): void
  dismissOneCanvasLayer(): boolean
  dismissTextPickerPanels(): void
  hideImageMarkHint(...args: unknown[]): CoreRuntimeSlotReturn
  openAddMenuAtGraphPoint(...args: unknown[]): CoreRuntimeSlotReturn
  openAssetCenterPanel(): void
  openAssetsPanel(): void
  openComboModal(): void
  openConnectMenu(source: Node, releasePoint: { x: number; y: number }): void
  openConnectMenuByNodeId(...args: unknown[]): CoreRuntimeSlotReturn
  openFileUploadPicker(accept: string, filter: UploadFilter, multiple?: boolean): void
  openImageCrop(): Promise<void>
  openImageCustom(...args: unknown[]): CoreRuntimeSlotReturn
  openImageDialogue(nodeId?: string): void
  openImageEditText(): Promise<void>
  openImageErase(): Promise<void>
  openImageExpand(): Promise<void>
  openImageGenPromptBar(nodeId: string): void
  openImageGridSplit(rows?: number, cols?: number): Promise<void>
  openImageInpaint(): Promise<void>
  openImagePreview(): void
  openImageToolbarMore(): void
  openMediaContextMenu(...args: unknown[]): CoreRuntimeSlotReturn
  openMediaPreview(): void
  openNewProject(): void
  openTextExpand(...args: unknown[]): CoreRuntimeSlotReturn
  openVideoDialogue(nodeId?: string): void
  openVideoGenPromptBar(nodeId: string, tab?: string): void
  showImageMarkHint(...args: unknown[]): CoreRuntimeSlotReturn
  toggleAddMenu(): void
  toggleAssetCenterPanel(): void
  toggleAssetsPanel(): void
  toggleCanvasBgTheme(): Promise<void>
  toggleGrid(): void
  toggleHistoryPanel(): void
  toggleImageAddToDialogMenu(): void
  toggleImageDialogue(): void
  toggleImageDialogueCanvasPickMode(): void
  toggleImageHdMenu(): void
  toggleImageNodeLock(nodeId: string): void
  toggleImageToolbarMoreMenu(): void
  toggleMinimap(): Promise<void>
  togglePanMode(): void
  toggleProjectMenu(): void
  toggleShortcutsPanel(): void
  toggleUserMenu(): void
  toggleVideoDialogue(): void
  toggleVideoFramesPanel(): void
  toggleVideoGenCanvasPickMode(): void
  toggleVideoHdPanel(): void
  toggleZoomMenu(...args: unknown[]): CoreRuntimeSlotReturn
}

/** 动态安装槽位总览：由四域接口组合 */
export type CoreRuntimeInstallSlots = CoreRuntimeTaskSlots &
  CoreRuntimeGraphSlots &
  CoreRuntimePersistenceSlots &
  CoreRuntimePanelSlots
