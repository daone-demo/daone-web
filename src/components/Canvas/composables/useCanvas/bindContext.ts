import type { CanvasBindings } from './types'

/** 从 bind 解构画布运行时上下文，供各 register 模块共享同一闭包变量名 */
export function unpackBind(bind: CanvasBindings) {
  return bind as CanvasBindings & Record<string, unknown>
}

export const BIND_KEYS = [
  'emit', 'canvasRef', 'graphRef', 'nodeOverlaysRef', 'fileInputComponentRef',
  'bottomLeftDockRef', 'textExpandEditorComponentRef', 'fileInputRef', 'minimapContainerRef',
  'textExpandEditorRef', 'modelType', 'promptSourcePreviewUrl', 'promptSourceFileName',
  'promptSourcePreviews', 'promptSubmitting', 'userMenuName', 'userMenuRole', 'userMenuPoints',
  'graph', 'nodeCount', 'zoomLevel', 'showZoomMenu', 'gridVisible', 'canvasBgTheme',
  'panMode', 'showShortcutsPanel', 'imagePreviewUrl', 'canUndo', 'canRedo', 'nodeClipboard',
  'showMinimap', 'showBackToNodesBanner', 'isRecenteringToNodes', 'showProjectMenu',
  'showUserMenu', 'canvasProjects', 'activeProjectId', 'showAddMenu', 'showConnectMenu',
  'showImageContextMenu', 'imageContextMenuPos', 'imageContextMenuNodeId', 'imageContextMenuKind',
  'connectMenuPos', 'connectReleasePoint', 'addMenuPos', 'addMenuDropPoint',
  'connectSourceNodeId', 'showAssetsPanel', 'showHistoryPanel', 'assetsTab', 'assetsLoading',
  'promptText', 'activePickerNodeId', 'activeImageGenPromptNodeId', 'imageGenPromptText',
  'imageGenSeed', 'imageGenSourcePreviewUrl', 'imageGenSourceTextPreview', 'imageGenSourceRefs', 'imageGenSubmitting', 'activeVideoGenPromptNodeId',
  'videoGenPromptText', 'videoNum', 'videoGenActiveTab', 'videoGenAspectRatio', 'selectedNodeId', 'selectedNodeIds',
  'selectedEdgeId', 'hoveredEdgeId', 'edgeDeleteBtnPos', 'pendingUploadNodeId', 'fileInputAccept', 'fileInputMultiple',
  'isCanvasFileDragOver', 'canvasFileDragDepth', 'pendingUploadFilter', 'toolbarPos',
  'multiSelectToolbarPos', 'groupToolbarPos', 'groupOverlayItems', 'dialoguePos', 'promptPos',
  'imageGenPromptPos', 'videoGenPromptPos', 'showElementSelectMode',
  'elementSelectReturnNodeId', 'elementSelectContext', 'imageCropPos', 'imageGridSplitPos', 'videoHdPos', 'selectedKind',
  'showImageToolbarMore', 'showImageToolbarMoreMenu', 'showImageToolbarCustomize',
  'imageToolbarCustomizeSettings', 'showImageHdMenu', 'showImageDialogue',
  'showImageCrop', 'cropSourceNodeId', 'showImageGridSplit', 'gridSplitSourceNodeId',
  'gridSplitRows', 'gridSplitCols', 'showImageErase', 'eraseSourceNodeId', 'imageErasePos',
  'showImageInpaint', 'inpaintSourceNodeId', 'imageInpaintPos',
  'showImageExpand', 'expandSourceNodeId', 'imageExpandPos',
  'showImageEditText', 'editTextSourceNodeId', 'imageEditTextPos', 'imageEditTextEntries', 'imageEditTextRecognizing',
  'showVideoDialogue', 'showVideoHdPanel',
  'showVideoFramesPanel', 'imageDialogueText', 'mentionInsertSerial', 'mentionInsertToken', 'imageDialogueSettings', 'videoDialogueText', 'videoDialogueSettings', 'videoHdMagnification',
  'canvasCredits', 'textFormatToolbarPos', 'textDownloadPos', 'textEditorToolbarActive', 'textExpandOpen',
  'textExpandNodeId', 'textExpandTitle', 'toolbarRevision', 'router', 'modalStore',
  'canvasHistory', 'historyPushTimer', 'scrollerScrollTarget', 'textEditorApis',
  'groupOverlayDrag', 'groupOverlayResize', 'groupMoveState', 'zoomPercent', 'currentProjectName', 'canvasBgThemeLabel',
  'activeGroupSelection', 'overlayGroupSelection', 'showGroupOverlay', 'showGroupToolbar', 'showPromptBar', 'showImageGenPromptBar',
  'showVideoGenPromptBar', 'videoGenSourceRefs', 'videoGenSavedSettings', 'videoDialogueSourceRefs', 'onVideoGenAspectRatioChange', 'showImageCreativeToolbar',
  'showTextFormatToolbar', 'isImg2PromptTask', 'isText2VideoTask', 'isText2ImageTask', 'promptSubmitLabel', 'canSubmitTextPrompt', 'imageCropSource',
  'imageGridSplitSource', 'imageEraseSource', 'imageInpaintSource', 'imageExpandSource', 'imageDialoguePreviews', 'imageDialoguePreviewUrl', 'imageDialogueHideWorkflowAndMark', 'showNodeToolbar', 'showMultiSelectToolbar',
  'showToolbarFeatureButtons', 'isLightNodeToolbar', 'altVoiceTimer', 'bindKeyboard',
  'unbindKeyboard', 'unbindLongPressPan', 'endSpacePan',
] as const
