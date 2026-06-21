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
  'connectMenuPos', 'connectReleasePoint', 'addMenuPos', 'addMenuDropPoint',
  'connectSourceNodeId', 'showAssetsPanel', 'showHistoryPanel', 'assetsTab', 'assetsLoading',
  'promptText', 'activePickerNodeId', 'activeImageGenPromptNodeId', 'imageGenPromptText',
  'imageGenSeed', 'imageGenSourcePreviewUrl', 'imageGenSubmitting', 'activeVideoGenPromptNodeId',
  'videoGenPromptText', 'videoNum', 'videoGenActiveTab', 'selectedNodeId', 'selectedNodeIds',
  'selectedEdgeId', 'pendingUploadNodeId', 'fileInputAccept', 'fileInputMultiple',
  'isCanvasFileDragOver', 'canvasFileDragDepth', 'pendingUploadFilter', 'toolbarPos',
  'multiSelectToolbarPos', 'groupToolbarPos', 'groupOverlayBox', 'dialoguePos', 'promptPos',
  'imageGenPromptPos', 'videoGenPromptPos', 'videoGenPromptDragOffset', 'showElementSelectMode',
  'elementSelectReturnNodeId', 'imageCropPos', 'videoHdPos', 'selectedKind',
  'showImageToolbarMore', 'showImageToolbarMoreMenu', 'showImageHdMenu', 'showImageDialogue',
  'showImageCrop', 'cropSourceNodeId', 'showVideoDialogue', 'showVideoHdPanel',
  'showVideoFramesPanel', 'imageDialogueText', 'videoDialogueText', 'videoHdMagnification',
  'canvasCredits', 'textFormatToolbarPos', 'textDownloadPos', 'textExpandOpen',
  'textExpandNodeId', 'textExpandTitle', 'toolbarRevision', 'router', 'modalStore',
  'canvasHistory', 'historyPushTimer', 'scrollerScrollTarget', 'textEditorApis',
  'groupOverlayDrag', 'groupMoveState', 'zoomPercent', 'currentProjectName', 'canvasBgThemeLabel',
  'activeGroupSelection', 'showGroupToolbar', 'showPromptBar', 'showImageGenPromptBar',
  'showVideoGenPromptBar', 'videoGenSourceRefs', 'showImageCreativeToolbar',
  'showTextFormatToolbar', 'isImg2PromptTask', 'canSubmitTextPrompt', 'imageCropSource',
  'imageDialoguePreviews', 'imageDialoguePreviewUrl', 'showNodeToolbar', 'showMultiSelectToolbar',
  'showToolbarFeatureButtons', 'isLightNodeToolbar', 'altVoiceTimer', 'bindKeyboard',
  'unbindKeyboard', 'endSpacePan',
] as const
