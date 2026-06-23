<template>
  <div
    ref="canvasRef"
    class="canvas"
    :class="[
      `canvas--bg-${canvasBgTheme}`,
      { 'canvas--file-dragover': isCanvasFileDragOver },
      { 'canvas--group-selected': showGroupToolbar },
    ]"
    @dragenter.prevent="onCanvasDragEnter"
    @dragover.prevent="onCanvasDragOver"
    @dragleave="onCanvasDragLeave"
    @drop.prevent="onCanvasFileDrop"
  >
    <CanvasHeader
      :canvas-bg-theme="canvasBgTheme"
      :current-project-name="currentProjectName"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :credits="canvasCredits"
      :show-project-menu="showProjectMenu"
      :show-user-menu="showUserMenu"
      :projects="projectsList"
      :active-project-id="activeProjectId"
      :user-name="userMenuName"
      :user-role="userMenuRole"
      :user-points="userMenuPoints"
      @go-home="onGoHome"
      @toggle-project-menu="toggleProjectMenu"
      @select-project="selectProject"
      @undo="handleUndo"
      @redo="handleRedo"
      @save="handleSaveCanvas"
      @export="handleExportCanvas"
      @toggle-user-menu="toggleUserMenu"
      @go-user-center="goUserCenter"
      @open-combo="openComboModal"
      @user-menu-action="handleUserMenuAction"
      @logout="handleLogout"
      @new-project="emit('new-project')"
      @rename-project="(projectId, name) => emit('rename-project', projectId, name)"
      @delete-project="emit('delete-project', $event)"
    />

    <div ref="graphRef" class="canvas__graph" />

    <CanvasEmptyHint v-if="nodeCount === 0" @focus-chat="emit('focus-chat')" />

    <CanvasElementSelectBar
      v-if="showElementSelectMode"
      @return-node="returnFromElementSelect"
      @exit="exitElementSelectMode"
    />

    <CanvasMultiSelectToolbar
      v-if="showMultiSelectToolbar"
      :position="multiSelectToolbarPos"
      :is-light="canvasBgTheme === 'light'"
      @layout="handleMultiSelectLayout"
      @save-to-assets="handleMultiSelectSaveToAssets"
      @duplicate="duplicateSelectedNodes"
      @copy="copySelectedNodes"
      @group="handleMultiSelectGroup"
      @merge-storyboard="handleMergeStoryboardGroup"
    />

    <CanvasEdgeDeleteButton
      v-if="showEdgeDeleteButton"
      :position="edgeDeleteBtnPos"
      :is-light="canvasBgTheme === 'light'"
      @delete="removeHoveredEdge"
      @pointer-enter="handleEdgeDeletePointerEnter"
      @pointer-leave="handleEdgeDeletePointerLeave"
    />

    <CanvasGroupOverlay
      v-if="showGroupToolbar && groupOverlayBox"
      :box="groupOverlayBox"
      :node-count="activeGroupSelection?.nodeIds.length ?? 0"
      :is-light="canvasBgTheme === 'light'"
      @drag-start="onGroupOverlayDragStart"
    />

    <CanvasGroupToolbar
      v-if="showGroupToolbar"
      :position="groupToolbarPos"
      :is-light="canvasBgTheme === 'light'"
      @layout="handleGroupLayout"
      @execute="handleGroupExecute"
      @add-to-toolbox="handleGroupAddToToolbox"
      @to-storyboard="handleGroupToStoryboard"
      @ungroup="handleUngroup"
      @batch-download="handleGroupBatchDownload"
    />

    <CanvasNodeToolbar
      v-if="showNodeToolbar && !showMultiSelectToolbar && !showGroupToolbar && showToolbarFeatureButtons && !showImageCrop"
      :position="toolbarPos"
      :is-light="isLightNodeToolbar"
      :show-feature-buttons="showToolbarFeatureButtons"
      :selected-kind="selectedKind"
      :show-image-creative-toolbar="showImageCreativeToolbar"
      :show-image-toolbar-more="showImageToolbarMore"
      :show-image-toolbar-more-menu="showImageToolbarMoreMenu"
      :show-image-hd-menu="showImageHdMenu"
      :show-image-dialogue="showImageDialogue"
      :show-image-crop="showImageCrop"
      :show-video-dialogue="showVideoDialogue"
      :show-video-hd-panel="showVideoHdPanel"
      :show-video-frames-panel="showVideoFramesPanel"
      @close-image-toolbar-more="closeImageToolbarMore"
      @toggle-image-toolbar-more-menu="toggleImageToolbarMoreMenu"
      @toggle-image-hd-menu="toggleImageHdMenu"
      @toggle-image-dialogue="toggleImageDialogue"
      @image-toolbar-action="onImageToolbarAction"
      @toggle-video-dialogue="toggleVideoDialogue"
      @toggle-video-hd-panel="toggleVideoHdPanel"
      @toggle-video-frames-panel="toggleVideoFramesPanel"
      @toggle-image-addToDialog-menu="toggleImageAddToDialogMenu"
    />

    <CanvasAssetsPanel
      v-if="showAssetsPanel"
      :tab="assetsTab"
      :loading="assetsLoading"
      @update:tab="assetsTab = $event"
      @close="showAssetsPanel = false"
    />

    <CanvasNodeOverlays
      ref="nodeOverlaysRef"
      :canvas-bg-theme="canvasBgTheme"
      :show-prompt-bar="showPromptBar"
      :show-image-gen-prompt-bar="showImageGenPromptBar"
      :show-video-gen-prompt-bar="showVideoGenPromptBar"
      :prompt-pos="promptPos"
      :image-gen-prompt-pos="imageGenPromptPos"
      :video-gen-prompt-pos="videoGenPromptPos"
      :image-crop-pos="imageCropPos"
      :dialogue-pos="dialoguePos"
      :video-hd-pos="videoHdPos"
      :selected-kind="selectedKind"
      :show-image-crop="showImageCrop"
      :show-image-dialogue="showImageDialogue"
      :show-video-dialogue="showVideoDialogue"
      :show-video-hd-panel="showVideoHdPanel"
      :show-video-frames-panel="showVideoFramesPanel"
      :image-crop-source="imageCropSource"
      :prompt-text="promptText"
      :prompt-source-preview-url="promptSourcePreviewUrl"
      :prompt-source-previews="promptSourcePreviews"
      :prompt-submitting="promptSubmitting"
      :can-submit-text-prompt="canSubmitTextPrompt"
      :is-img2-prompt-task="isImg2PromptTask"
      :image-gen-prompt-text="imageGenPromptText"
      :image-gen-seed="imageGenSeed"
      :image-gen-source-preview-url="imageGenSourcePreviewUrl"
      :image-gen-submitting="imageGenSubmitting"
      :video-gen-prompt-text="videoGenPromptText"
      :video-gen-active-tab="videoGenActiveTab"
      :video-gen-source-refs="videoGenSourceRefs"
      :element-select-mode="showElementSelectMode"
      :image-dialogue-text="imageDialogueText"
      :image-dialogue-preview-url="imageDialoguePreviewUrl"
      :image-dialogue-previews="imageDialoguePreviews"
      :video-dialogue-text="videoDialogueText"
      :video-hd-magnification="videoHdMagnification"
      :video-num="videoNum"
      @update:prompt-text="promptText = $event"
      @update:video-num="videoNum = $event"
      @persist-prompt-bar-draft="persistPromptBarDraft"
      @submit-text-prompt="submitTextPrompt"
      @remove-prompt-source="removePromptImageSource"
      @upload-prompt-images="onPromptUploadFiles"
      @add-prompt-canvas-node="onPromptAddCanvasNode"
      @update:image-gen-prompt-text="imageGenPromptText = $event; persistImageGenPrompt()"
      @update:image-gen-seed="imageGenSeed = $event; persistImageGenPrompt()"
      @generate-image="generateImageFromPrompt"
      @update:video-gen-prompt-text="videoGenPromptText = $event; persistVideoGenPrompt()"
      @update:video-gen-active-tab="videoGenActiveTab = $event; persistVideoGenPrompt()"
      @update:image-dialogue-text="imageDialogueText = $event"
      @remove-image-dialogue-preview="clearImageDialoguePreview"
      @upload-image-dialogue-images="onImageDialogueUploadFiles"
      @add-image-dialogue-canvas-node="onImageDialogueAddCanvasNode"
      @update:video-dialogue-text="videoDialogueText = $event"
      @update:video-hd-magnification="videoHdMagnification = $event"
      @close-image-crop="closeImageCrop"
      @image-crop-complete="onImageCropComplete"
      @reset-video-hd-panel="resetVideoHdPanel"
      @video-hd-start="onVideoHdStart"
      @video-gen-drag-start="onVideoGenPromptDragStart"
      @video-gen-quick-action="onVideoGenQuickAction"
      @remove-video-source-ref="onRemoveVideoSourceRef"
      @upload-video-gen-images="onVideoGenUploadFiles"
      @add-video-gen-canvas-node="onVideoGenAddCanvasNode"
    />

    <CanvasHiddenFileInput
      ref="fileInputComponentRef"
      :accept="fileInputAccept"
      :multiple="fileInputMultiple"
      @change="onFileSelected"
    />

    <CanvasHistoryAnchor v-if="showHistoryPanel" @close="closeHistoryPanel" />

    <CanvasLeftToolbar
      :canvas-bg-theme="canvasBgTheme"
      :show-add-menu="showAddMenu"
      :show-assets-panel="showAssetsPanel"
      :show-history-panel="showHistoryPanel"
      @toggle-add-menu="toggleAddMenu"
      @toggle-assets-panel="toggleAssetsPanel"
      @toggle-history-panel="toggleHistoryPanel"
    />

    <CanvasConnectMenu
      v-if="showConnectMenu"
      :position="connectMenuPos"
      @select="onConnectMenuItem"
    />

    <CanvasAddMenu
      v-if="showAddMenu"
      :canvas-bg-theme="canvasBgTheme"
      :drop-point="addMenuDropPoint"
      :position="addMenuPos"
      @select="onMenuItem"
    />

    <CanvasBottomLeftDock
      ref="bottomLeftDockRef"
      :show-minimap="showMinimap"
      :grid-visible="gridVisible"
      :show-shortcuts-panel="showShortcutsPanel"
      :pan-mode="panMode"
      :show-zoom-menu="showZoomMenu"
      :zoom-percent="zoomPercent"
      :theme-label="canvasBgThemeLabel"
      @toggle-theme="toggleCanvasBgTheme"
      @tidy="handleTidyCanvas"
      @toggle-minimap="toggleMinimap"
      @toggle-grid="toggleGrid"
      @toggle-shortcuts="toggleShortcutsPanel"
      @toggle-pan="togglePanMode"
      @toggle-zoom-menu="toggleZoomMenu"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @zoom-menu-action="onZoomMenuAction"
    />

    <CanvasBackToNodesBanner
      v-if="showBackToNodesBanner"
      :is-recentering="isRecenteringToNodes"
      @recenter="recenterToNodes"
    />

    <CanvasTextFormatAnchor
      v-if="showTextFormatToolbar"
      :position="textFormatToolbarPos"
      @command="onTextFormatAction"
    />

    <CanvasTextExpandEditor
      v-if="textExpandOpen"
      ref="textExpandEditorComponentRef"
      :title="textExpandTitle"
      :placeholder="TEXT_EDITOR_PLACEHOLDER"
      :is-light="canvasBgTheme === 'light'"
      @close="closeTextExpand"
      @input="onTextExpandInput"
    />

    <CanvasShortcutsBackdrop
      v-if="showShortcutsPanel"
      @close="closeShortcutsPanel"
    />

    <CanvasImagePreview
      v-if="imagePreviewUrl"
      :url="imagePreviewUrl"
      @close="closeImagePreview"
    />
  </div>
</template>

<script setup lang="ts">
import CanvasHeader from './panels/CanvasHeader.vue'
import CanvasLeftToolbar from './panels/CanvasLeftToolbar.vue'
import CanvasConnectMenu from './panels/CanvasConnectMenu.vue'
import CanvasAddMenu from './panels/CanvasAddMenu.vue'
import CanvasAssetsPanel from './panels/CanvasAssetsPanel.vue'
import CanvasNodeToolbar from './panels/CanvasNodeToolbar.vue'
import CanvasMultiSelectToolbar from './panels/CanvasMultiSelectToolbar.vue'
import CanvasEdgeDeleteButton from './panels/CanvasEdgeDeleteButton.vue'
import CanvasGroupOverlay from './panels/CanvasGroupOverlay.vue'
import CanvasGroupToolbar from './panels/CanvasGroupToolbar.vue'
import CanvasElementSelectBar from './panels/CanvasElementSelectBar.vue'
import CanvasNodeOverlays from './panels/CanvasNodeOverlays.vue'
import CanvasImagePreview from './panels/CanvasImagePreview.vue'
import CanvasEmptyHint from './panels/CanvasEmptyHint.vue'
import CanvasBackToNodesBanner from './panels/CanvasBackToNodesBanner.vue'
import CanvasTextExpandEditor from './panels/CanvasTextExpandEditor.vue'
import CanvasHistoryAnchor from './panels/CanvasHistoryAnchor.vue'
import CanvasBottomLeftDock from './panels/CanvasBottomLeftDock.vue'
import CanvasTextFormatAnchor from './panels/CanvasTextFormatAnchor.vue'
import CanvasShortcutsBackdrop from './panels/CanvasShortcutsBackdrop.vue'
import CanvasHiddenFileInput from './panels/CanvasHiddenFileInput.vue'
import { useCanvas } from './composables/useCanvas'
import { ref } from 'vue'
import type { ProjectCanvasResponse } from '@/services/api'

const emit = defineEmits<{
  'focus-chat': []
  'add-to-chat': [payload: { previewUrl: string; fileName: string }],
  'new-project': []
  'rename-project': [projectId: string, name: string],
  'delete-project': [projectId: string],
}>()

const canvasRef = ref<HTMLElement | null>(null)
const graphRef = ref<HTMLElement | null>(null)
const nodeOverlaysRef = ref<InstanceType<typeof CanvasNodeOverlays> | null>(null)
const fileInputComponentRef = ref<InstanceType<typeof CanvasHiddenFileInput> | null>(null)
const bottomLeftDockRef = ref<InstanceType<typeof CanvasBottomLeftDock> | null>(null)
const textExpandEditorComponentRef = ref<InstanceType<typeof CanvasTextExpandEditor> | null>(null)

const canvasRuntime = useCanvas(emit, {
  canvasRef,
  graphRef,
  nodeOverlaysRef,
  fileInputComponentRef,
  bottomLeftDockRef,
  textExpandEditorComponentRef,
})

const {
  TEXT_EDITOR_PLACEHOLDER,
  activeGroupSelection,
  activeProjectId,
  addMenuDropPoint,
  addMenuPos,
  assetsLoading,
  assetsTab,
  canRedo,
  canSubmitTextPrompt,
  canUndo,
  canvasBgTheme,
  canvasBgThemeLabel,
  canvasCredits,
  clearImageDialoguePreview,
  closeHistoryPanel,
  closeImageCrop,
  closeImagePreview,
  closeImageToolbarMore,
  closeShortcutsPanel,
  closeTextExpand,
  connectMenuPos,
  copySelectedNodes,
  currentProjectName,
  dialoguePos,
  duplicateSelectedNodes,
  edgeDeleteBtnPos,
  exitElementSelectMode,
  fileInputAccept,
  fileInputMultiple,
  generateImageFromPrompt,
  goUserCenter,
  gridVisible,
  groupOverlayBox,
  groupToolbarPos,
  handleExportCanvas,
  handleEdgeDeletePointerEnter,
  handleEdgeDeletePointerLeave,
  handleGroupAddToToolbox,
  handleGroupBatchDownload,
  handleGroupExecute,
  handleGroupLayout,
  handleGroupToStoryboard,
  handleLogout,
  handleMergeStoryboardGroup,
  handleMultiSelectGroup,
  handleMultiSelectLayout,
  handleMultiSelectSaveToAssets,
  handleRedo,
  handleSaveCanvas,
  handleTidyCanvas,
  handleUndo,
  handleUngroup,
  handleUserMenuAction,
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
  isImg2PromptTask,
  isLightNodeToolbar,
  isRecenteringToNodes,
  multiSelectToolbarPos,
  nodeCount,
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
  onMenuItem,
  onPromptAddCanvasNode,
  onPromptUploadFiles,
  onRemoveVideoSourceRef,
  onTextExpandInput,
  onTextFormatAction,
  onVideoGenAddCanvasNode,
  onVideoGenPromptDragStart,
  onVideoGenQuickAction,
  onVideoGenUploadFiles,
  onVideoHdStart,
  onZoomMenuAction,
  openComboModal,
  panMode,
  persistImageGenPrompt,
  persistPromptBarDraft,
  persistVideoGenPrompt,
  promptPos,
  promptSourcePreviewUrl,
  promptSourcePreviews,
  promptSubmitting,
  promptText,
  recenterToNodes,
  removeHoveredEdge,
  removePromptImageSource,
  resetVideoHdPanel,
  returnFromElementSelect,
  selectProject,
  selectedKind,
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
  submitTextPrompt,
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
  userMenuName,
  userMenuPoints,
  userMenuRole,
  videoDialogueText,
  videoGenActiveTab,
  videoGenPromptPos,
  videoGenPromptText,
  videoGenSourceRefs,
  videoHdMagnification,
  videoHdPos,
  videoNum,
  zoomIn,
  zoomOut,
  zoomPercent,
  addImageFromFile,
  addImagesFromFiles,
  getNodeCount,
} = canvasRuntime

defineExpose({
  addImageFromFile,
  addImagesFromFiles,
  getNodeCount,
  loadProjectCanvas(payload: ProjectCanvasResponse) {
    const load = (canvasRuntime as {
      loadProjectCanvas?: (payload: ProjectCanvasResponse) => boolean
    }).loadProjectCanvas
    return load?.(payload) ?? false
  },
})

export type CanvasProjectItem = {
  id: string
  title: string
  coverAssetId: string | null
  coverUrl: string | null
  revision: number
  createdAt: string
  updatedAt: string
}

defineProps<{
  projectsList: CanvasProjectItem[]
}>()
</script>

<style lang="scss">
/* 子组件在 panels/ 中，样式须为非 scoped 才能作用于子组件 DOM */
@import './index.scss';
</style>
