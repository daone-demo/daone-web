<template>
  <div
    ref="canvasRef"
    class="canvas"
    :class="[
      `canvas--bg-${canvasBgTheme}`,
      { 'canvas--file-dragover': isCanvasFileDragOver },
      { 'canvas--group-selected': showGroupToolbar },
      { 'canvas--video-gen-pick': showVideoGenCanvasPickMode || showImageDialogueCanvasPickMode },
      { 'canvas--element-select': showElementSelectMode },
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
      :projects-loading="projectsLoading"
      :projects-has-more="projectsHasMore"
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
      @load-more-projects="emit('load-more-projects')"
      @open-project-browser="openProjectBrowser"
    />

    <div ref="graphRef" class="canvas__graph" />

    <CanvasEmptyHint v-if="nodeCount === 0" @focus-chat="emit('focus-chat')" />

    <CanvasElementSelectBar
      v-if="showElementSelectBar"
      @return-node="returnFromElementSelect"
      @exit="exitElementSelectMode"
    />

    <CanvasVideoGenPickHint v-if="showVideoGenCanvasPickMode || showImageDialogueCanvasPickMode" />

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
      @save-to-skill="handleGroupSaveToSkill"
      @batch-download="handleGroupBatchDownload"
    />

    <CanvasSaveSkillPopover
      v-if="showSaveSkillPopover"
      :position="saveSkillPopoverPos"
      :items="saveSkillItems"
      :existing-skills="listSavedCanvasSkills()"
      :is-light="canvasBgTheme === 'light'"
      :submitting="saveSkillSubmitting"
      @close="closeSaveSkillPopover"
      @submit="handleSubmitSaveSkill"
    />

    <ImageToolbarCustomizeModal
      v-if="showImageToolbarCustomize"
      :image-capabilities="imageCapabilities"
      :settings="imageToolbarCustomizeSettings"
      @cancel="closeImageToolbarCustomize"
      @save="saveImageToolbarCustomize"
    />

    <CanvasNodeToolbar
      v-if="showNodeToolbar && !showMultiSelectToolbar && !showGroupToolbar && showToolbarFeatureButtons && !showConnectMenu && !showImageCrop && !showImageGridSplit && !showImageErase && !showImageInpaint && !showImageExpand && !showImageEditText && !showImageDialogue && !showVideoDialogue && !showPromptBar && !showImageToolbarCustomize"
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
      @image-toolbar-action="onImageToolbarAction"
      @video-toolbar-action="onVideoToolbarAction"
      @toggle-video-dialogue="toggleVideoDialogue"
      @toggle-video-hd-panel="toggleVideoHdPanel"
      @toggle-video-frames-panel="toggleVideoFramesPanel"
      @add-video-to-dialog="addVideoToDialog"
      :image-capabilities="imageCapabilities"
      :video-capabilities="videoCapabilities"
      :image-toolbar-customize-settings="imageToolbarCustomizeSettings"
      :toolbar-revision="toolbarRevision"
    />

    <CanvasAssetsPanel
      v-if="showAssetsPanel"
      :tab="assetsTab"
      :date="assetsDate"
      :type="assetsType"
      @update:type="onChangeAssetsType($event)"
      :is-light="canvasBgTheme === 'light'"
      @update:tab="onChangeAssetsTab($event)"
      @update:date="onChangeAssetsDate($event)"
      @batch-insert="onBatchInsertAssets($event)"
      @close="showAssetsPanel = false"
    />

    <CanvasAssetCenterPanel
      v-if="showAssetCenterPanel"
      :tab="assetCenterTab"
      :search="assetCenterSearch"
      :loading="assetCenterLoading"
      :list="skillList"
      :is-light="canvasBgTheme === 'light'"
      @update:tab="onChangeAssetCenterTab($event)"
      @update:search="assetCenterSearch = $event"
      @close="closeAssetCenterPanel"
      @select="onSelectAssetCenterItem"
      @add-to-chat="onAddAssetCenterToChat"
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
      :show-image-resize-overlay="showImageResizeOverlay"
      :image-resize-overlay="imageResizeOverlay"
      :image-grid-split-pos="imageGridSplitPos"
      :image-erase-pos="imageErasePos"
      :image-inpaint-pos="imageInpaintPos"
      :image-expand-pos="imageExpandPos"
      :dialogue-pos="dialoguePos"
      :video-hd-pos="videoHdPos"
      :selected-kind="selectedKind"
      :show-image-crop="showImageCrop"
      :show-image-grid-split="showImageGridSplit"
      :show-image-erase="showImageErase"
      :show-image-inpaint="showImageInpaint"
      :show-image-expand="showImageExpand"
      :show-image-edit-text="showImageEditText"
      :image-edit-text-pos="imageEditTextPos"
      :image-edit-text-entries="imageEditTextEntries"
      :image-edit-text-recognizing="imageEditTextRecognizing"
      :grid-split-rows="gridSplitRows"
      :grid-split-cols="gridSplitCols"
      :show-image-dialogue="showImageDialogue"
      :show-video-dialogue="showVideoDialoguePanel"
      :show-video-hd-panel="showVideoHdPanel"
      :show-video-frames-panel="showVideoFramesPanel"
      :image-crop-source="imageCropSource"
      :image-grid-split-source="imageGridSplitSource"
      :image-erase-source="imageEraseSource"
      :image-inpaint-source="imageInpaintSource"
      :image-expand-source="imageExpandSource"
      :prompt-text="promptText"
      :prompt-source-preview-url="promptSourcePreviewUrl"
      :prompt-source-previews="promptSourcePreviews"
      :prompt-submitting="promptSubmitting"
      :can-submit-text-prompt="canSubmitTextPrompt"
      :is-img2-prompt-task="isImg2PromptTask"
      :is-text2-video-task="isText2VideoTask"
      :is-text2-image-task="isText2ImageTask"
      :prompt-submit-label="promptSubmitLabel"
      :image-gen-prompt-text="imageGenPromptText"
      :image-gen-seed="imageGenSeed"
      :image-gen-source-refs="imageGenSourceRefs"
      :image-gen-submitting="imageGenSubmitting"
      :video-gen-prompt-text="videoGenPromptText"
      :video-gen-active-tab="videoGenActiveTab"
      :video-gen-aspect-ratio="videoGenAspectRatio"
      :video-gen-source-refs="videoGenSourceRefs"
      :video-gen-saved-settings="videoGenSavedSettings"
      :video-dialogue-source-refs="videoDialogueSourceRefs"
      :element-select-mode="showElementSelectMode"
      :video-gen-canvas-pick-mode="showVideoGenCanvasPickMode"
      :image-dialogue-canvas-pick-mode="showImageDialogueCanvasPickMode"
      :image-dialogue-text="imageDialogueText"
      :image-dialogue-settings="imageDialogueSettings"
      :image-dialogue-preview-url="imageDialoguePreviewUrl"
      :image-dialogue-previews="imageDialoguePreviews"
      :element-marks="elementMarks"
      :mention-insert-serial="mentionInsertSerial"
      :mention-insert-token="mentionInsertToken"
      :resolve-mark-preview-url="resolveElementMarkPreviewUrl"
      :video-dialogue-text="videoDialogueText"
      :video-dialogue-settings="videoDialogueSettings"
      :video-hd-magnification="videoHdMagnification"
      :video-num="videoNum"
      :image-capabilities="imageCapabilities"
      :chat-tools="chatTools"
      :workflows="workflows"
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
      @remove-image-gen-source-ref="onRemoveImageGenSourceRef"
      @submit-video-gen-prompt="handleVideoGenPromptSubmit"
      @update:video-gen-prompt-text="videoGenPromptText = $event; persistVideoGenPrompt()"
      @update:video-gen-active-tab="videoGenActiveTab = $event; persistVideoGenPrompt()"
      @update:video-gen-aspect-ratio="onVideoGenAspectRatioChange"
      @update:image-dialogue-text="imageDialogueText = $event; persistImageDialogueFields()"
      @update:image-dialogue-settings="imageDialogueSettings = $event; persistImageDialogueFields()"
      @remove-image-dialogue-preview="clearImageDialoguePreview"
      @upload-image-dialogue-images="onImageDialogueUploadFiles"
      @add-image-dialogue-canvas-node="onImageDialogueAddCanvasNode"
      @submit-image-dialogue="handleImageDialogueSubmit"
      @submit-video-dialogue="handleVideoDialogueSubmit"
      @remove-video-dialogue-source-ref="onRemoveVideoSourceRef"
      @upload-video-dialogue-images="onVideoGenUploadFiles"
      @add-video-dialogue-canvas-node="onVideoGenAddCanvasNode"
      @update:video-dialogue-text="videoDialogueText = $event; persistVideoDialogueFields()"
      @update:video-dialogue-settings="videoDialogueSettings = $event; persistVideoDialogueFields()"
      @update:video-hd-magnification="videoHdMagnification = $event"
      @close-image-crop="closeImageCrop"
      @image-resize-start="onImageResizePointerDown"
      @image-crop-complete="onImageCropComplete"
      @close-image-grid-split="closeImageGridSplit"
      @image-grid-split-complete="onImageGridSplitComplete"
      @close-image-erase="closeImageErase"
      @image-erase-complete="onImageEraseComplete"
      @close-image-inpaint="closeImageInpaint"
      @image-inpaint-complete="onImageInpaintComplete"
      @close-image-expand="closeImageExpand"
      @image-expand-complete="onImageExpandComplete"
      @close-image-edit-text="closeImageEditText"
      @image-edit-text-apply="onImageEditTextApply"
      @reset-video-hd-panel="resetVideoHdPanel"
      @video-hd-start="onVideoHdStart"
      @video-gen-quick-action="onVideoGenQuickAction"
      @remove-video-source-ref="onRemoveVideoSourceRef"
      @upload-video-gen-images="onVideoGenUploadFiles"
      @add-video-gen-canvas-node="onVideoGenAddCanvasNode"
      @toggle-video-gen-canvas-pick="toggleVideoGenCanvasPickMode"
      @toggle-image-dialogue-canvas-pick="toggleImageDialogueCanvasPickMode"
      @toggle-image-dialogue-mark="toggleImageDialogueMarkMode"
      @mention-inserted="onMentionInserted"
      @select-mark-label="updateImageMarkLabel"
      @remove-mark="removeElementMark"
      @clear-marks="clearElementMarks"
    />

    <CanvasHiddenFileInput
      ref="fileInputComponentRef"
      :accept="fileInputAccept"
      :multiple="fileInputMultiple"
      @change="onFileSelected"
    />

    <CanvasHistoryAnchor
      v-if="showHistoryPanel"
      :list="historyList"
      :loading="historyLoading"
      :has-more="historyHasMore"
      :restoring="historyRestoring"
      @close="closeHistoryPanel"
      @load-more="onLoadMoreHistory"
      @select="onSelectHistoryVersion"
    />

    <CanvasLeftToolbar
      :canvas-bg-theme="canvasBgTheme"
      :show-add-menu="showAddMenu"
      :show-assets-panel="showAssetsPanel"
      :show-asset-center-panel="showAssetCenterPanel"
      :show-history-panel="showHistoryPanel"
      @toggle-add-menu="toggleAddMenu"
      @toggle-assets-panel="toggleAssetsPanel"
      @toggle-asset-center-panel="toggleAssetCenterPanel"
      @toggle-history-panel="toggleHistoryPanel"
    />

    <CanvasConnectMenu
      v-if="showConnectMenu"
      :position="connectMenuPos"
      @select="onConnectMenuItem"
    />

    <CanvasImageContextMenu
      v-if="showImageContextMenu"
      :position="imageContextMenuPos"
      :kind="imageContextMenuKind"
      :is-light="canvasBgTheme === 'light'"
      :node-locked="imageContextMenuLocked"
      @select="onImageContextMenuAction"
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

    <CanvasProjectBrowser
      v-if="showProjectBrowser"
      ref="projectBrowserRef"
      :active-project-id="activeProjectId"
      @close="closeProjectBrowser"
      @select-project="selectProject"
      @rename-project="(projectId, name) => emit('rename-project', projectId, name)"
      @delete-project="(projectId) => emit('delete-project', projectId)"
    />

    <CanvasImagePreview
      v-if="imagePreviewUrl"
      :url="imagePreviewUrl"
      :kind="imagePreviewKind"
      @close="closeImagePreview"
    />
  </div>
</template>

<script setup lang="ts">
import CanvasHeader from './panels/CanvasHeader.vue'
import CanvasLeftToolbar from './panels/CanvasLeftToolbar.vue'
import CanvasConnectMenu from './panels/CanvasConnectMenu.vue'
import CanvasImageContextMenu from './panels/CanvasImageContextMenu.vue'
import CanvasAddMenu from './panels/CanvasAddMenu.vue'
import CanvasAssetsPanel from './panels/CanvasAssetsPanel.vue'
import CanvasAssetCenterPanel from './panels/CanvasAssetCenterPanel.vue'
import CanvasNodeToolbar from './panels/CanvasNodeToolbar.vue'
import CanvasMultiSelectToolbar from './panels/CanvasMultiSelectToolbar.vue'
import CanvasEdgeDeleteButton from './panels/CanvasEdgeDeleteButton.vue'
import CanvasGroupOverlay from './panels/CanvasGroupOverlay.vue'
import CanvasGroupToolbar from './panels/CanvasGroupToolbar.vue'
import CanvasSaveSkillPopover from './panels/CanvasSaveSkillPopover.vue'
import ImageToolbarCustomizeModal from './panels/ImageToolbarCustomizeModal.vue'
import CanvasElementSelectBar from './panels/CanvasElementSelectBar.vue'
import CanvasVideoGenPickHint from './panels/CanvasVideoGenPickHint.vue'
import CanvasNodeOverlays from './panels/CanvasNodeOverlays.vue'
import CanvasImagePreview from './panels/CanvasImagePreview.vue'
import CanvasEmptyHint from './panels/CanvasEmptyHint.vue'
import CanvasBackToNodesBanner from './panels/CanvasBackToNodesBanner.vue'
import CanvasTextExpandEditor from './panels/CanvasTextExpandEditor.vue'
import CanvasHistoryAnchor from './panels/CanvasHistoryAnchor.vue'
import CanvasBottomLeftDock from './panels/CanvasBottomLeftDock.vue'
import CanvasTextFormatAnchor from './panels/CanvasTextFormatAnchor.vue'
import CanvasShortcutsBackdrop from './panels/CanvasShortcutsBackdrop.vue'
import CanvasProjectBrowser from './panels/CanvasProjectBrowser.vue'
import CanvasHiddenFileInput from './panels/CanvasHiddenFileInput.vue'
import { useCanvas } from './composables/useCanvas'
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import type { ProjectCanvasResponse, ProjectVersionDetailResponse, ProjectVersionRecord } from '@/services/api'
import { type ProjectTabKey } from '@/views/Project/projectData'
import type { ElementGroupRecord, AssetCenterTabKey } from './assetCenterData'
import type { ImageCapability, WorkflowCategoryGroup, CanvasAssetDragPayload } from './constants'

const emit = defineEmits<{
  'focus-chat': []
  'add-to-chat': [payload: { previewUrl: string; fileName: string; assetId?: string }],
  'add-asset-to-chat': [payload: { id: string; role: string; name: string }],
  'new-project': []
  'rename-project': [projectId: string, name: string],
  'delete-project': [projectId: string],
  'load-more-projects': [],
  'toolbar-preferences-saved': [payload: { nodeType: 'IMAGE' | 'VIDEO' | 'TEXT' }],
}>();

defineProps<{
  projectsList: CanvasProjectItem[]
  projectsLoading?: boolean
  projectsHasMore?: boolean
  imageCapabilities: ImageCapability[]
  videoCapabilities: ImageCapability[]
  textCapabilities: any[]
  chatTools: any
  workflows: WorkflowCategoryGroup[]
}>()

const skillList = ref<ElementGroupRecord[]>([])
const HISTORY_PAGE_SIZE = 50
const historyList = ref<ProjectVersionRecord[]>([])
const historyPage = ref(1)
const historyLoading = ref(false)
const historyHasMore = ref(true)
const historyRestoring = ref(false)

const canvasRef = ref<HTMLElement | null>(null)
const graphRef = ref<HTMLElement | null>(null)
const nodeOverlaysRef = ref<InstanceType<typeof CanvasNodeOverlays> | null>(null)
const fileInputComponentRef = ref<InstanceType<typeof CanvasHiddenFileInput> | null>(null)
const bottomLeftDockRef = ref<InstanceType<typeof CanvasBottomLeftDock> | null>(null)
const textExpandEditorComponentRef = ref<InstanceType<typeof CanvasTextExpandEditor> | null>(null)
const projectBrowserRef = ref<InstanceType<typeof CanvasProjectBrowser> | null>(null)

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
  assetsTab,
  assetsDate,
  assetsType,
  assetCenterLoading,
  assetCenterSearch,
  assetCenterTab,
  canRedo,
  canSubmitTextPrompt,
  canUndo,
  canvasBgTheme,
  canvasBgThemeLabel,
  canvasCredits,
  clearImageDialoguePreview,
  closeHistoryPanel,
  closeAssetCenterPanel,
  closeImageCrop,
  closeImageErase,
  closeImageInpaint,
  closeImageExpand,
  closeImageGridSplit,
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
  elementMarks,
  mentionInsertSerial,
  mentionInsertToken,
  exitElementSelectMode,
  fileInputAccept,
  fileInputMultiple,
  generateImageFromPrompt,
  handleImageDialogueSubmit,
  handleVideoDialogueSubmit,
  handleVideoGenPromptSubmit,
  onVideoGenAspectRatioChange,
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
  handleGroupSaveToSkill,
  handleGroupToStoryboard,
  handleSubmitSaveSkill,
  closeSaveSkillPopover,
  closeImageToolbarCustomize,
  saveImageToolbarCustomize,
  listSavedCanvasSkills,
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
  imageResizeOverlay,
  showImageResizeOverlay,
  imageCropSource,
  imageGridSplitPos,
  imageErasePos,
  imageInpaintPos,
  imageExpandPos,
  showImageEditText,
  imageEditTextPos,
  imageEditTextEntries,
  imageEditTextRecognizing,
  imageGridSplitSource,
  imageEraseSource,
  imageInpaintSource,
  imageExpandSource,
  gridSplitRows,
  gridSplitCols,
  imageDialoguePreviewUrl,
  imageDialoguePreviews,
  imageDialogueText,
  imageDialogueSettings,
  imageGenPromptPos,
  imageGenPromptText,
  imageGenSeed,
  imageGenSourceRefs,
  imageGenSubmitting,
  imagePreviewUrl,
  isCanvasFileDragOver,
  isImg2PromptTask,
  isText2VideoTask,
  isText2ImageTask,
  promptSubmitLabel,
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
  onImageResizePointerDown,
  onImageGridSplitComplete,
  onImageEraseComplete,
  onImageInpaintComplete,
  onImageExpandComplete,
  closeImageEditText,
  onImageEditTextApply,
  onImageDialogueAddCanvasNode,
  onImageDialogueUploadFiles,
  onImageToolbarAction,
  onVideoToolbarAction,
  onMenuItem,
  onPromptAddCanvasNode,
  onPromptUploadFiles,
  onRemoveImageGenSourceRef,
  onRemoveVideoSourceRef,
  onTextExpandInput,
  onTextFormatAction,
  onVideoGenAddCanvasNode,
  onVideoGenQuickAction,
  onVideoGenUploadFiles,
  onVideoHdStart,
  onZoomMenuAction,
  openComboModal,
  panMode,
  persistImageGenPrompt,
  persistImageDialogueFields,
  persistVideoDialogueFields,
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
  showAssetCenterPanel,
  showBackToNodesBanner,
  showConnectMenu,
  showImageContextMenu,
  imageContextMenuPos,
  imageContextMenuKind,
  imageContextMenuLocked,
  imagePreviewKind,
  onImageContextMenuAction,
  showEdgeDeleteButton,
  showElementSelectBar,
  showElementSelectMode,
  showVideoGenCanvasPickMode,
  showImageDialogueCanvasPickMode,
  toggleVideoGenCanvasPickMode,
  toggleImageDialogueCanvasPickMode,
  toggleImageDialogueMarkMode,
  updateImageMarkLabel,
  removeElementMark,
  clearElementMarks,
  resolveElementMarkPreviewUrl,
  showGroupToolbar,
  showSaveSkillPopover,
  saveSkillPopoverPos,
  saveSkillItems,
  saveSkillSubmitting,
  showHistoryPanel,
  showImageCreativeToolbar,
  showImageCrop,
  showImageErase,
  showImageInpaint,
  showImageExpand,
  showImageGridSplit,
  showImageDialogue,
  showImageGenPromptBar,
  showImageHdMenu,
  showImageToolbarMore,
  showImageToolbarMoreMenu,
  showImageToolbarCustomize,
  imageToolbarCustomizeSettings,
  showMinimap,
  showMultiSelectToolbar,
  showNodeToolbar,
  showProjectMenu,
  showProjectBrowser,
  showPromptBar,
  showShortcutsPanel,
  showTextFormatToolbar,
  showToolbarFeatureButtons,
  showUserMenu,
  showVideoDialogue,
  showVideoDialoguePanel,
  showVideoFramesPanel,
  showVideoGenPromptBar,
  showVideoHdPanel,
  showZoomMenu,
  submitTextPrompt,
  textExpandOpen,
  textExpandTitle,
  textFormatToolbarPos,
  toolbarRevision,
  toggleAddMenu,
  toggleAssetsPanel,
  toggleAssetCenterPanel,
  toggleCanvasBgTheme,
  toggleGrid,
  toggleHistoryPanel,
  toggleImageToolbarMoreMenu,
  toggleMinimap,
  togglePanMode,
  toggleProjectMenu,
  openProjectBrowser,
  closeProjectBrowser,
  toggleShortcutsPanel,
  toggleUserMenu,
  toggleVideoDialogue,
  toggleVideoFramesPanel,
  toggleVideoHdPanel,
  addVideoToDialog,
  toggleZoomMenu,
  toolbarPos,
  userMenuName,
  userMenuPoints,
  userMenuRole,
  videoDialogueText,
  videoDialogueSettings,
  videoGenActiveTab,
  videoGenAspectRatio,
  videoGenPromptPos,
  videoGenPromptText,
  videoGenSourceRefs,
  videoGenSavedSettings,
  videoDialogueSourceRefs,
  videoHdMagnification,
  videoHdPos,
  videoNum,
  zoomIn,
  zoomOut,
  zoomPercent,
  addElementGroupFromRecord,
  addImageFromFile,
  addImagesFromFiles,
  getNodeCount,
} = canvasRuntime

function onMentionInserted() {
  if (showImageDialogue.value) {
    persistImageDialogueFields()
    return
  }
  if (showVideoGenPromptBar.value) {
    persistVideoGenPrompt()
  }
}

defineExpose({
  addImageFromFile,
  addImagesFromFiles,
  getNodeCount,
  hasUnsavedChanges(): boolean {
    const fn = (canvasRuntime as { hasUnsavedChanges?: () => boolean }).hasUnsavedChanges
    return fn?.() ?? false
  },
  saveCanvas(saveType: 'MANUAL' | 'AUTO' = 'MANUAL') {
    const fn = (canvasRuntime as {
      handleSaveCanvas?: (saveType?: 'MANUAL' | 'AUTO') => void
    }).handleSaveCanvas
    fn?.(saveType)
  },
  async saveCanvasAndWait(saveType: 'MANUAL' | 'AUTO' = 'MANUAL'): Promise<boolean> {
    const fn = (canvasRuntime as {
      saveCanvasAndWait?: (saveType?: 'MANUAL' | 'AUTO') => Promise<boolean>
    }).saveCanvasAndWait
    return (await fn?.(saveType)) ?? true
  },
  setCanvasDescription(description: string, taskType?: string) {
    const fn = (canvasRuntime as {
      setCanvasDescription?: (description: string, taskType?: string) => void
    }).setCanvasDescription
    fn?.(description, taskType)
  },
  loadProjectCanvas(payload: ProjectCanvasResponse) {
    const load = (canvasRuntime as {
      loadProjectCanvas?: (payload: ProjectCanvasResponse) => boolean
    }).loadProjectCanvas
    return load?.(payload) ?? false
  },
  loadProjectCanvasFromVersion(detail: ProjectVersionDetailResponse) {
    const load = (canvasRuntime as {
      loadProjectCanvasFromVersion?: (detail: ProjectVersionDetailResponse) => boolean
    }).loadProjectCanvasFromVersion
    return load?.(detail) ?? false
  },
  reloadProjectBrowser() {
    projectBrowserRef.value?.reload()
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

const onChangeAssetsTab = (tab: ProjectTabKey) => {
  assetsTab.value = tab
}

const onChangeAssetsType = (type: 'all' | 'image' | 'video') => {
  assetsType.value = type
}

const onChangeAssetsDate = (date: any) => {
  assetsDate.value = date
}

const onBatchInsertAssets = (assets: CanvasAssetDragPayload[]) => {
  const fn = (canvasRuntime as {
    batchInsertAssetsFromLibrary?: (assets: CanvasAssetDragPayload[]) => number
  }).batchInsertAssetsFromLibrary
  fn?.(assets)
}

const onChangeAssetCenterTab = (tab: AssetCenterTabKey) => {
  assetCenterTab.value = tab
}

const onSelectAssetCenterItem = (item: ElementGroupRecord) => {
  addElementGroupFromRecord(item)
}

const onAddAssetCenterToChat = (payload: { id: string; role: string; name: string }) => {
  emit('add-asset-to-chat', payload)
}

const onLoadSkill = () => {
  api.queryElementGroups(activeProjectId.value, { pageSize: 50, page: 1 }).then((res: any) => {
    skillList.value = res.records ?? [];
  })
}

const onLoadHistory = async (reset = false) => {
  if (!activeProjectId.value || historyLoading.value) return
  if (!reset && !historyHasMore.value) return

  if (reset) {
    historyPage.value = 1
    historyHasMore.value = true
  }

  historyLoading.value = true
  try {
    const res = await api.getProjectVersions<ProjectVersionRecord>(activeProjectId.value, {
      pageSize: HISTORY_PAGE_SIZE,
      page: historyPage.value,
    })
    const records = res.records ?? []
    if (reset) {
      historyList.value = records
    } else {
      const existingIds = new Set(historyList.value.map((item) => String(item.id)))
      historyList.value.push(
        ...records.filter((item) => !existingIds.has(String(item.id))),
      )
    }
    historyHasMore.value = records.length >= HISTORY_PAGE_SIZE
  } finally {
    historyLoading.value = false
  }
}

const onLoadMoreHistory = () => {
  if (!historyHasMore.value || historyLoading.value) return
  historyPage.value += 1
  void onLoadHistory()
}

const onSelectHistoryVersion = async (versionId: string) => {
  if (!activeProjectId.value || historyRestoring.value || !versionId) return

  historyRestoring.value = true
  try {
    const detail = await api.getProjectVersion<ProjectVersionDetailResponse>(
      activeProjectId.value,
      versionId,
    )
    const loaded = (canvasRuntime as {
      loadProjectCanvasFromVersion?: (detail: ProjectVersionDetailResponse) => boolean
    }).loadProjectCanvasFromVersion?.(detail)
    if (!loaded) {
      message.error('恢复历史版本失败')
      return
    }
    closeHistoryPanel()
  } catch (error) {
    console.error('[Canvas] restore history version failed', error)
    message.error('加载历史版本失败')
  } finally {
    historyRestoring.value = false
  }
}

watch(showAssetCenterPanel, (open) => {
  if (open && activeProjectId.value) {
    onLoadSkill()
  }
})

watch(showHistoryPanel, (open) => {
  if (open && activeProjectId.value) {
    void onLoadHistory(true)
  }
})
</script>

<style lang="scss">
/* 子组件在 panels/ 中，样式须为非 scoped 才能作用于子组件 DOM */
@import './index.scss';
</style>
