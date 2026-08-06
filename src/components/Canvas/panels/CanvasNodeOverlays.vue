<template>
  <div
    v-if="showPromptBar"
    class="canvas__prompt"
    :class="{
      'canvas__prompt--light': canvasBgTheme === 'light',
      'canvas__prompt--dragover': isPromptDragOver,
    }"
    :style="{
      left: `${promptPos.left}px`,
      top: `${promptPos.top}px`,
      width: `${promptPos.width}px`,
    }"
    @mousedown.stop
    @dragenter.prevent="onPromptDragEnter"
    @dragover.prevent="onPromptDragOver"
    @dragleave="onPromptDragLeave"
    @drop.prevent.stop="onPromptDrop"
  >
    <div v-if="isPromptDragOver && isImg2PromptTask" class="canvas__prompt-drop-overlay" @mousedown.stop>
      <div class="canvas__prompt-drop-zone">
        <img src="@assets/images/add.png" alt="" class="canvas__prompt-drop-icon" />
        <p class="canvas__prompt-drop-text">点击或拖拽图片到此处上传</p>
      </div>
    </div>
    <div
      class="canvas__prompt-body"
      :class="{
        'canvas__prompt-body--img2prompt': isImg2PromptTask,
      }"
    >
      <span v-if="isImg2PromptTask" class="canvas__prompt-refs">
        <!-- 图片引用与上传入口暂隐藏，保留拖拽上传 -->
      </span>
      <div
        ref="promptInputRef"
        class="canvas__prompt-input canvas__prompt-input--rich"
        :class="{ 'canvas__prompt-input--empty': !promptText.length }"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :data-placeholder="PROMPT_PLACEHOLDER"
        @input="onPromptInput"
        @compositionstart="onPromptCompositionStart"
        @compositionend="onPromptCompositionEnd"
        @keydown="onPromptKeydown"
        @paste="onPromptPaste"
      />
    </div>
    <div class="canvas__prompt-footer">
      <VideoDialogueFooter
        v-if="isText2VideoTask"
        :chat-tools="chatTools"
        :disabled="!canSubmitTextPrompt || promptSubmitting"
        :translating="translating"
        default-mode="text-to-video"
        @translate="onTranslatePrompt"
        @submit="onSubmitText2Video"
      />
      <ImageDialogueFooter
        v-else-if="isText2ImageTask"
        :chat-tools="chatTools"
        :disabled="!canSubmitTextPrompt || promptSubmitting"
        :translating="translating"
        @translate="onTranslatePrompt"
        @submit="onSubmitText2Image"
      />
      <template v-else>
        <div class="canvas__prompt-model-wrap" />
        <div class="canvas__prompt-actions">
          <button
            type="button"
            class="canvas__prompt-icon"
            :class="{ 'canvas__prompt-icon--loading': translating }"
            :title="translating ? '翻译中' : '翻译'"
            :disabled="translating"
            @mousedown.stop
            @click.stop="onTranslatePrompt"
            style="background: transparent;"
          >
            <span v-if="translating" class="canvas__prompt-translate-label">翻译中...</span>
            <i v-else class="iconfont icon-fanyi" style="font-size: 16px;"></i>
            <!-- <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              xmlns:xlink="http://www.w3.org/1999/xlink"
              aria-hidden="true"
              role="img"
              class="iconify iconify--libtv pointer-events-none text-fg-default size-4"
              width="1.1em"
              height="1em"
              viewBox="0 0 19.71 18"
            ><path d="M15.52 7.2c.16 0 .31.1.37.26l3.8 10a.4.4 0 0 1-.38.54h-1.03a.4.4 0 0 1-.37-.27l-.88-2.48h-4.36l-.88 2.48a.4.4 0 0 1-.37.27h-1.03a.4.4 0 0 1-.37-.54l3.79-10a.4.4 0 0 1 .37-.26zM7.7 0c.22 0 .4.18.4.4v1.4H14c.22 0 .4.18.4.4v1a.4.4 0 0 1-.4.4h-2.21a16 16 0 0 1-1.42 3.33A11 11 0 0 1 8.5 9.54l1.99 2.02c.1.11.14.28.09.42l-.43 1.16a.3.3 0 0 1-.5.1l-2.4-2.46-4.27 4.24a.4.4 0 0 1-.56 0l-.7-.7a.4.4 0 0 1 0-.56L6 9.5q-.79-.8-1.43-1.8-.55-.85-1-1.89a.3.3 0 0 1 .27-.41h1.2a.4.4 0 0 1 .35.22q.39.74.79 1.31.45.65 1.08 1.3.73-.73 1.54-2.08.8-1.33 1.2-2.55H.4a.4.4 0 0 1-.4-.4v-1c0-.22.18-.4.4-.4h5.9V.4c0-.22.18-.4.4-.4zm5.53 13.68h3.24l-1.62-4.59z" fill="currentColor"></path></svg> -->
          </button>
          <button
            type="button"
            class="canvas__prompt-send"
            :class="{ 'canvas__prompt-send--disabled': !canSubmitTextPrompt }"
            :disabled="!canSubmitTextPrompt || promptSubmitting"
            title="发送"
            @click="emit('submit-text-prompt')"
          >
            {{ promptSubmitting ? '…' : '↑' }}
          </button>
        </div>
      </template>
    </div>
  </div>

  <div
    v-if="showImageGenPromptBar"
    class="canvas__node-dialogue"
    :style="{
      left: `${imageGenPromptPos.left}px`,
      top: `${imageGenPromptPos.top}px`,
      width: `${imageGenPromptPos.width}px`,
    }"
    @mousedown.stop
  >
    <ImageDialoguePanel
      :model-value="imageDialogueText"
      :settings="imageDialogueSettings"
      :preview-url="imageDialoguePreviewUrl"
      :previews="imageDialoguePreviews"
      :canvas-pick-mode="imageDialogueCanvasPickMode"
      :element-select-mode="elementSelectMode"
      :element-marks="elementMarks"
      :mention-insert-serial="mentionInsertSerial"
      :mention-insert-token="mentionInsertToken"
      :resolve-mark-preview-url="resolveMarkPreviewUrl"
      :chat-tools="chatTools"
      :workflows="workflows"
      @update:model-value="emit('update:imageDialogueText', $event)"
      @update:settings="emit('update:imageDialogueSettings', $event)"
      @remove="emit('remove-image-dialogue-preview', $event)"
      @upload-images="emit('upload-image-dialogue-images', $event)"
      @add-canvas-node="emit('add-image-dialogue-canvas-node', $event)"
      @toggle-canvas-pick="emit('toggle-image-dialogue-canvas-pick')"
      @toggle-mark="emit('toggle-image-dialogue-mark')"
      @add-digital-human-ref="emit('add-image-dialogue-digital-human', $event)"
      @mention-inserted="emit('mention-inserted')"
      @select-mark-label="(markId, index) => emit('select-mark-label', markId, index)"
      @remove-mark="emit('remove-mark', $event)"
      @clear-marks="emit('clear-marks')"
      @submit="emit('submit-image-dialogue', $event)"
    />
  </div>

  <div
    v-if="showVideoGenPromptBar"
    class="canvas__video-gen-prompt"
    :style="{
      left: `${videoGenPromptPos.left}px`,
      top: `${videoGenPromptPos.top}px`,
      width: `${videoGenPromptPos.width}px`,
    }"
    @mousedown.stop
  >
    <VideoGenPromptPanel
      ref="videoGenPromptPanelRef"
      :prompt="videoGenPromptText"
      :active-tab="videoGenActiveTab"
      :aspect-ratio="videoGenAspectRatio"
      :source-refs="videoGenSourceRefs"
      :element-marks="elementMarks"
      :saved-settings="videoGenSavedSettings"
      :element-select-mode="elementSelectMode"
      :canvas-pick-mode="videoGenCanvasPickMode"
      :mention-insert-serial="mentionInsertSerial"
      :mention-insert-token="mentionInsertToken"
      :resolve-mark-preview-url="resolveMarkPreviewUrl"
      :video-num="videoNum"
      :chat-tools="chatTools"
      @update:prompt="emit('update:videoGenPromptText', $event)"
      @update:video-num="emit('update:videoNum', $event)"
      @update:active-tab="emit('update:videoGenActiveTab', $event)"
      @update:aspect-ratio="emit('update:videoGenAspectRatio', $event)"
      @quick-action="emit('video-gen-quick-action', $event)"
      @remove-source-ref="emit('remove-video-source-ref', $event)"
      @upload-images="emit('upload-video-gen-images', $event)"
      @add-canvas-node="emit('add-video-gen-canvas-node', $event)"
      @toggle-canvas-pick="emit('toggle-video-gen-canvas-pick')"
      @mention-inserted="emit('mention-inserted')"
      @select-mark-label="(markId, index) => emit('select-mark-label', markId, index)"
      @remove-mark="emit('remove-mark', $event)"
      @clear-marks="emit('clear-marks')"
      @submit="emit('submit-video-gen-prompt', $event)"
    />
  </div>

  <CanvasImageResizeOverlay
    ref="imageResizeOverlayRef"
    :visible="showImageResizeOverlay"
    :box="imageResizeOverlay"
    :dimension-label="imageResizeOverlay.dimensionLabel"
    @resize-start="(event, corner) => emit('image-resize-start', event, corner)"
  />

  <div
    v-if="showImageCrop && selectedKind === 'image'"
    class="canvas__image-crop"
    :style="{
      left: `${imageCropPos.left}px`,
      top: `${imageCropPos.top}px`,
      width: `${imageCropPos.width}px`,
      height: `${imageCropPos.height}px`,
    }"
    @mousedown.stop
  >
    <ImageCropOverlay
      v-if="imageCropSource"
      :image-url="imageCropSource.previewUrl"
      :natural-width="imageCropSource.mediaWidth"
      :natural-height="imageCropSource.mediaHeight"
      @cancel="emit('close-image-crop')"
      @complete="emit('image-crop-complete', $event)"
    />
  </div>

  <div
    v-if="showImageGridSplit && selectedKind === 'image'"
    class="canvas__image-grid-split"
    :style="{
      left: `${imageGridSplitPos.left}px`,
      top: `${imageGridSplitPos.top}px`,
      width: `${imageGridSplitPos.width}px`,
      height: `${imageGridSplitPos.height}px`,
    }"
  >
    <ImageGridSplitOverlay
      v-if="imageGridSplitSource"
      :image-url="imageGridSplitSource.previewUrl"
      :natural-width="imageGridSplitSource.mediaWidth"
      :natural-height="imageGridSplitSource.mediaHeight"
      :rows="gridSplitRows"
      :cols="gridSplitCols"
      @cancel="emit('close-image-grid-split')"
      @complete="emit('image-grid-split-complete', $event)"
    />
  </div>

  <div
    v-if="showImageErase && selectedKind === 'image'"
    class="canvas__image-erase"
    :style="{
      left: `${imageErasePos.left}px`,
      top: `${imageErasePos.top}px`,
      width: `${imageErasePos.width}px`,
      height: `${imageErasePos.height}px`,
    }"
    @mousedown.stop
  >
    <ImageEraseOverlay
      v-if="imageEraseSource"
      :image-url="imageEraseSource.previewUrl"
      :natural-width="imageEraseSource.mediaWidth"
      :natural-height="imageEraseSource.mediaHeight"
      @cancel="emit('close-image-erase')"
      @complete="emit('image-erase-complete', $event)"
    />
  </div>

  <div
    v-if="showImageInpaint && selectedKind === 'image'"
    class="canvas__image-inpaint"
    :style="{
      left: `${imageInpaintPos.left}px`,
      top: `${imageInpaintPos.top}px`,
      width: `${imageInpaintPos.width}px`,
      height: `${imageInpaintPos.height}px`,
    }"
    @mousedown.stop
  >
    <ImageInpaintOverlay
      v-if="imageInpaintSource"
      :image-url="imageInpaintSource.previewUrl"
      :natural-width="imageInpaintSource.mediaWidth"
      :natural-height="imageInpaintSource.mediaHeight"
      @cancel="emit('close-image-inpaint')"
      @complete="emit('image-inpaint-complete', $event)"
    />
  </div>

  <div
    v-if="showImageExpand && selectedKind === 'image'"
    class="canvas__image-expand"
    :style="{
      left: `${imageExpandPos.left}px`,
      top: `${imageExpandPos.top}px`,
      width: `${imageExpandPos.width}px`,
      height: `${imageExpandPos.height}px`,
    }"
    @mousedown.stop
  >
    <ImageExpandOverlay
      v-if="imageExpandSource"
      :image-url="imageExpandSource.previewUrl"
      :natural-width="imageExpandSource.mediaWidth"
      :natural-height="imageExpandSource.mediaHeight"
      :pad-x="imageExpandPos.padX"
      :pad-y="imageExpandPos.padY"
      :display-width="imageExpandPos.mediaWidth"
      :display-height="imageExpandPos.mediaHeight"
      @cancel="emit('close-image-expand')"
      @complete="emit('image-expand-complete', $event)"
    />
  </div>

  <div
    v-if="showImageEditText && selectedKind === 'image'"
    class="canvas__node-side-panel canvas__image-edit-text"
    :style="{
      left: `${imageEditTextPos.left}px`,
      top: `${imageEditTextPos.top}px`,
      width: `${imageEditTextPos.width}px`,
      height: `${imageEditTextPos.height}px`,
    }"
    @mousedown.stop
  >
    <ImageEditTextPanel
      :entries="imageEditTextEntries"
      :recognizing="imageEditTextRecognizing"
      @cancel="emit('close-image-edit-text')"
      @apply="emit('image-edit-text-apply', $event)"
    />
  </div>

  <div
    v-if="showImageDialogue && selectedKind === 'image'"
    class="canvas__node-dialogue"
    :style="{
      left: `${dialoguePos.left}px`,
      top: `${dialoguePos.top}px`,
      width: `${dialoguePos.width}px`,
    }"
    @mousedown.stop
  >
    <ImageDialoguePanel
      :model-value="imageDialogueText"
      :settings="imageDialogueSettings"
      :preview-url="imageDialoguePreviewUrl"
      :previews="imageDialoguePreviews"
      :canvas-pick-mode="imageDialogueCanvasPickMode"
      :element-select-mode="elementSelectMode"
      :element-marks="elementMarks"
      :mention-insert-serial="mentionInsertSerial"
      :mention-insert-token="mentionInsertToken"
      :resolve-mark-preview-url="resolveMarkPreviewUrl"
      :chat-tools="chatTools"
      :workflows="workflows"
      @update:model-value="emit('update:imageDialogueText', $event)"
      @update:settings="emit('update:imageDialogueSettings', $event)"
      @remove="emit('remove-image-dialogue-preview', $event)"
      @upload-images="emit('upload-image-dialogue-images', $event)"
      @add-canvas-node="emit('add-image-dialogue-canvas-node', $event)"
      @toggle-canvas-pick="emit('toggle-image-dialogue-canvas-pick')"
      @toggle-mark="emit('toggle-image-dialogue-mark')"
      @add-digital-human-ref="emit('add-image-dialogue-digital-human', $event)"
      @mention-inserted="emit('mention-inserted')"
      @select-mark-label="(markId, index) => emit('select-mark-label', markId, index)"
      @remove-mark="emit('remove-mark', $event)"
      @clear-marks="emit('clear-marks')"
      @submit="emit('submit-image-dialogue', $event)"
    />
  </div>

  <div
    v-if="showVideoDialogue && selectedKind === 'video'"
    class="canvas__node-dialogue"
    :style="{
      left: `${dialoguePos.left}px`,
      top: `${dialoguePos.top}px`,
      width: `${dialoguePos.width}px`,
    }"
    @mousedown.stop
  >
    <VideoDialoguePanel
      :model-value="videoDialogueText"
      :settings="videoDialogueSettings"
      :source-refs="videoDialogueSourceRefs"
      :chat-tools="chatTools"
      :workflows="workflows"
      @update:model-value="emit('update:videoDialogueText', $event)"
      @update:settings="emit('update:videoDialogueSettings', $event)"
      @remove-source-ref="emit('remove-video-dialogue-source-ref', $event)"
      @upload-images="emit('upload-video-dialogue-images', $event)"
      @add-canvas-node="emit('add-video-dialogue-canvas-node', $event)"
      @submit="emit('submit-video-dialogue', $event)"
    />
  </div>

  <div
    v-if="showVideoHdPanel && selectedKind === 'video'"
    class="canvas__node-side-panel"
    :style="{
      left: `${videoHdPos.left}px`,
      top: `${videoHdPos.top}px`,
      width: `${videoHdPos.width}px`,
    }"
    @mousedown.stop
  >
    <VideoHdPanel
      :model-value="videoHdMagnification"
      @update:model-value="emit('update:videoHdMagnification', $event)"
      @close="emit('reset-video-hd-panel')"
      @cancel="emit('reset-video-hd-panel')"
      @start="emit('video-hd-start')"
    />
  </div>

  <div
    v-if="showVideoFramesPanel && selectedKind === 'video'"
    class="canvas__node-dialogue"
    :style="{
      left: `${dialoguePos.left}px`,
      top: `${dialoguePos.top}px`,
      width: `${dialoguePos.width}px`,
    }"
    @mousedown.stop
  >
    <VideoFramesPanel />
  </div>
</template>

<script setup lang="ts">
import VideoGenPromptPanel from '../VideoGenPromptPanel.vue'
import ImageDialoguePanel from '../ImageDialoguePanel.vue'
import ImageDialogueFooter from '../ImageDialogueFooter.vue'
import type { ImageDialogueFooterParams } from '../ImageDialogueFooter.vue'
import CanvasImageResizeOverlay, {
  type ImageResizeOverlayBox,
} from './CanvasImageResizeOverlay.vue'
import ImageCropOverlay from '../ImageCropOverlay.vue'
import ImageGridSplitOverlay from '../ImageGridSplitOverlay.vue'
import ImageEraseOverlay from '../ImageEraseOverlay.vue'
import ImageInpaintOverlay from '../ImageInpaintOverlay.vue'
import ImageExpandOverlay from '../ImageExpandOverlay.vue'
import type { ImageExpandOverlayLayout } from '../graph'
import ImageEditTextPanel from '../ImageEditTextPanel.vue'
import VideoDialoguePanel from '../VideoDialoguePanel.vue'
import VideoDialogueFooter from '../VideoDialogueFooter.vue'
import type { VideoDialogueFooterParams } from '../VideoDialogueFooter.vue'
import VideoHdPanel from '../VideoHdPanel.vue'
import VideoFramesPanel from '../VideoFramesPanel.vue'
import {
  CANVAS_IMAGE_NODE_DRAG_TYPE,
  PROMPT_PLACEHOLDER,
  buildImageWorkflowOptions,
  type ImageSourceRef,
  type ImageMarkItem,
  type ChatTools,
  type ImageCapability,
  type ImageDialogueSubmitPayload,
  type ImageDialogueSettings,
  type VideoDialogueSubmitPayload,
  type VideoDialogueSettings,
  type VideoGenPromptSubmitPayload,
  type VideoGenAspectRatio,
  type NodeKind,
  type VideoHdMagnification,
  type WorkflowCategoryGroup,
  type WorkflowRecord,
} from '../constants'
import type { CanvasBgTheme } from '../canvasTheme'
import { createPromptMentionApi, isInputComposing } from '../promptMention'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import api, { type PromptTranslationData } from '@/services/api'
import { isRequestError } from '@/utils/request'
import type { VideoSourceRef } from '../videoGen'

const videoGenPromptPanelRef = ref<InstanceType<typeof VideoGenPromptPanel> | null>(null)
const imageResizeOverlayRef = ref<InstanceType<typeof CanvasImageResizeOverlay> | null>(null)
const isPromptDragOver = ref(false)
const promptInputRef = ref<HTMLElement | null>(null)
const mentionApi = createPromptMentionApi('canvas__prompt-mention')
let skipPromptWatch = false
const isPromptComposing = ref(false)
const translating = ref(false)

const props = defineProps<{
  chatTools: ChatTools | null
  workflows: WorkflowCategoryGroup[]
  canvasBgTheme: CanvasBgTheme
  showPromptBar: boolean
  showImageGenPromptBar: boolean
  showVideoGenPromptBar: boolean
  promptPos: { left: number; top: number; width: number }
  imageGenPromptPos: { left: number; top: number; width: number }
  videoGenPromptPos: { left: number; top: number; width: number }
  imageCropPos: { left: number; top: number; width: number; height: number }
  showImageResizeOverlay: boolean
  imageResizeOverlay: {
    left: number
    top: number
    width: number
    height: number
    dimensionLabel: string
    nodeId: string
  }
  imageGridSplitPos: { left: number; top: number; width: number; height: number }
  imageErasePos: { left: number; top: number; width: number; height: number }
  imageInpaintPos: { left: number; top: number; width: number; height: number }
  imageExpandPos: ImageExpandOverlayLayout
  dialoguePos: { left: number; top: number; width: number }
  videoHdPos: { left: number; top: number; width: number }
  selectedKind: NodeKind | null
  showImageCrop: boolean
  showImageGridSplit: boolean
  showImageErase: boolean
  showImageInpaint: boolean
  showImageExpand: boolean
  showImageEditText: boolean
  imageEditTextPos: { left: number; top: number; width: number; height: number }
  imageEditTextEntries: import('../editTextUtils').ImageEditTextEntry[]
  imageEditTextRecognizing: boolean
  gridSplitRows: number
  gridSplitCols: number
  showImageDialogue: boolean
  showVideoDialogue: boolean
  showVideoHdPanel: boolean
  showVideoFramesPanel: boolean
  imageCropSource: {
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null
  imageGridSplitSource: {
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null
  imageEraseSource: {
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null
  imageInpaintSource: {
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null
  imageExpandSource: {
    previewUrl: string
    mediaWidth: number
    mediaHeight: number
  } | null
  promptText: string
  promptSourcePreviewUrl: string
  promptSourcePreviews: ImageSourceRef[]
  promptSubmitting: boolean
  canSubmitTextPrompt: boolean
  isImg2PromptTask: boolean
  isText2VideoTask: boolean
  isText2ImageTask: boolean
  promptSubmitLabel: string
  imageGenPromptText: string
  imageGenSeed: number
  imageGenSourceRefs: VideoSourceRef[]
  imageGenSubmitting: boolean
  videoGenPromptText: string
  videoNum: number
  videoGenActiveTab: string
  videoGenAspectRatio: VideoGenAspectRatio
  videoGenSourceRefs: VideoSourceRef[]
  videoGenSavedSettings?: VideoDialogueSettings
  videoDialogueSourceRefs: VideoSourceRef[]
  elementSelectMode: boolean
  videoGenCanvasPickMode: boolean
  imageDialogueCanvasPickMode: boolean
  imageDialogueText: string
  imageDialogueSettings: ImageDialogueSettings
  imageDialoguePreviewUrl: string
  imageDialoguePreviews: ImageSourceRef[]
  elementMarks: ImageMarkItem[]
  mentionInsertSerial: number
  mentionInsertToken: string
  resolveMarkPreviewUrl: (mark: ImageMarkItem) => string
  videoDialogueText: string
  videoDialogueSettings: VideoDialogueSettings
  videoHdMagnification: VideoHdMagnification
  imageCapabilities: ImageCapability[]
}>()

const emit = defineEmits<{
  'update:promptText': [value: string]
  'update:videoNum': [value: number]
  'update:imageGenPromptText': [value: string]
  'update:imageGenSeed': [value: number]
  'update:videoGenPromptText': [value: string]
  'update:videoGenActiveTab': [value: string]
  'update:videoGenAspectRatio': [value: VideoGenAspectRatio]
  'remove-prompt-source': [sourceNodeId?: string]
  'upload-prompt-images': [files: File[]]
  'add-prompt-canvas-node': [nodeId: string]
  'update:imageDialogueText': [value: string]
  'update:imageDialogueSettings': [value: ImageDialogueSettings]
  'remove-image-dialogue-preview': [sourceNodeId?: string]
  'upload-image-dialogue-images': [files: File[]]
  'add-image-dialogue-canvas-node': [nodeId: string]
  'submit-image-dialogue': [payload: ImageDialogueSubmitPayload]
  'submit-video-dialogue': [payload: VideoDialogueSubmitPayload]
  'remove-video-dialogue-source-ref': [nodeId: string]
  'upload-video-dialogue-images': [files: File[]]
  'add-video-dialogue-canvas-node': [nodeId: string]
  'submit-video-gen-prompt': [payload: VideoGenPromptSubmitPayload]
  'update:videoDialogueText': [value: string]
  'update:videoDialogueSettings': [value: VideoDialogueSettings]
  'update:videoHdMagnification': [value: VideoHdMagnification]
  'persist-prompt-bar-draft': []
  'submit-text-prompt': [payload?: VideoDialogueSubmitPayload | ImageDialogueSubmitPayload]
  'generate-image': []
  'remove-image-gen-source-ref': [nodeId: string]
  'close-image-crop': []
  'image-crop-complete': [payload: { dataUrl: string; width: number; height: number }]
  'image-resize-start': [event: MouseEvent, corner: import('../graph').ImageResizeCorner]
  'close-image-grid-split': []
  'image-grid-split-complete': [payload: {
    rows: number
    cols: number
    rowStops: number[]
    colStops: number[]
  }]
  'close-image-erase': []
  'image-erase-complete': [payload: { dataUrl: string; width: number; height: number }]
  'close-image-inpaint': []
  'image-inpaint-complete': [payload: {
    prompt: string
    mask: { dataUrl: string; width: number; height: number }
    settle?: () => void
  }]
  'close-image-expand': []
  'image-expand-complete': [payload: {
    expandDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'ALL'
    expandRatio: number
  }]
  'close-image-edit-text': []
  'image-edit-text-apply': [changes: import('../editTextUtils').ImageEditTextChange[]]
  'reset-video-hd-panel': []
  'video-hd-start': []
  'video-gen-quick-action': [key: string]
  'remove-video-source-ref': [nodeId: string]
  'upload-video-gen-images': [files: File[]]
  'add-video-gen-canvas-node': [nodeId: string]
  'toggle-video-gen-canvas-pick': []
  'toggle-image-dialogue-canvas-pick': []
  'toggle-image-dialogue-mark': []
  'add-image-dialogue-digital-human': [payload: { assetId: string; previewUrl: string }]
  'mention-inserted': []
  'select-mark-label': [markId: string, index: number]
  'remove-mark': [markId: string]
  'clear-marks': []
}>()

const selectedText2ImageWorkFlow = ref<string | undefined>(undefined)
const imageWorkflowOptions = computed(() => buildImageWorkflowOptions(props.workflows))
const selectedText2ImageWorkflowRecord = computed(() =>
  imageWorkflowOptions.value.find((workflow) => workflow.id === selectedText2ImageWorkFlow.value),
)

function onSubmitText2Video(params: VideoDialogueFooterParams) {
  const prompt = props.promptText.trim()
  if (!prompt || !props.canSubmitTextPrompt || props.promptSubmitting) return
  emit('submit-text-prompt', {
    prompt,
    ...params,
  })
}

function onSubmitText2Image(params: ImageDialogueFooterParams) {
  const prompt = props.promptText.trim()
  if (!prompt || !props.canSubmitTextPrompt || props.promptSubmitting) return
  const workflow = selectedText2ImageWorkflowRecord.value
  emit('submit-text-prompt', {
    prompt,
    ...params,
    workflowId: workflow?.id,
    workflow: workflow as WorkflowRecord | undefined,
  })
}

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:promptText', text)
  emit('persist-prompt-bar-draft')
  nextTick(() => {
    skipPromptWatch = false
  })
}

async function onTranslatePrompt() {
  const text = props.promptText.trim()
  if (!text) {
    message.warning('请输入需要翻译的提示词')
    return
  }
  if (translating.value) return

  translating.value = true
  try {
    const result = await api.translatePrompt<PromptTranslationData>({
      text,
      targetLanguage: 'EN',
    })
    const translated = result?.translatedText?.trim()
    if (!translated) {
      message.warning('翻译结果为空')
      return
    }
    emitPrompt(translated)
    nextTick(() => syncPromptView(translated))
  } catch (error) {
    message.error(isRequestError(error) ? error.message : '提示词翻译失败，请稍后重试')
  } finally {
    translating.value = false
  }
}

function syncPromptView(text = props.promptText) {
  if (isPromptComposing.value) return
  const el = promptInputRef.value
  if (!el) return

  const sel = window.getSelection()
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null
  const offset = range && el.contains(range.startContainer)
    ? mentionApi.getPlainTextOffset(el, range.startContainer, range.startOffset)
    : text.length

  mentionApi.renderPromptToEl(el, text)
  mentionApi.setPlainTextOffset(el, offset)
}

function onPromptCompositionStart() {
  isPromptComposing.value = true
}

function onPromptCompositionEnd() {
  isPromptComposing.value = false
  onPromptInput()
}

function onPromptInput(event?: Event) {
  const el = promptInputRef.value
  if (!el) return

  const text = mentionApi.serializePromptEl(el)
  emitPrompt(text)
  if (isPromptComposing.value || isInputComposing(event)) return
  nextTick(() => syncPromptView(text))
}

function onPromptKeydown(event: KeyboardEvent) {
  if (isPromptComposing.value || isInputComposing(event)) return

  if (event.key !== 'Backspace' && event.key !== 'Delete') return

  const el = promptInputRef.value
  if (!el) return

  const mention = event.key === 'Backspace'
    ? mentionApi.findMentionBeforeCursor()
    : mentionApi.findMentionAfterCursor()

  if (!mention) return

  event.preventDefault()
  mention.remove()
  emitPrompt(mentionApi.serializePromptEl(el))
  nextTick(() => syncPromptView())
}

function onPromptPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  document.execCommand('insertText', false, text)
  onPromptInput()
}

function hasPromptDropContent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files') || types.includes(CANVAS_IMAGE_NODE_DRAG_TYPE)
}

function onPromptDragEnter(event: DragEvent) {
  if (!props.isImg2PromptTask || !hasPromptDropContent(event)) return
  isPromptDragOver.value = true
}

function onPromptDragOver(event: DragEvent) {
  if (!props.isImg2PromptTask || !hasPromptDropContent(event)) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  isPromptDragOver.value = true
}

function onPromptDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  const current = event.currentTarget as HTMLElement | null
  if (related && current?.contains(related)) return
  isPromptDragOver.value = false
}

function onPromptDrop(event: DragEvent) {
  isPromptDragOver.value = false
  if (!props.isImg2PromptTask) return

  const nodeId = event.dataTransfer?.getData(CANVAS_IMAGE_NODE_DRAG_TYPE)
  if (nodeId) {
    emit('add-prompt-canvas-node', nodeId)
    return
  }

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.type.startsWith('image/'),
  )
  if (files.length) emit('upload-prompt-images', files)
}

watch(
  () => props.promptText,
  (value) => {
    if (skipPromptWatch || isPromptComposing.value) return
    const el = promptInputRef.value
    if (!el || mentionApi.serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

watch(
  imageWorkflowOptions,
  (options) => {
    if (!props.isText2ImageTask) return
    if (!options.length) {
      selectedText2ImageWorkFlow.value = undefined
      return
    }
    if (
      selectedText2ImageWorkFlow.value &&
      !options.some((workflow) => workflow.id === selectedText2ImageWorkFlow.value)
    ) {
      selectedText2ImageWorkFlow.value = undefined
    }
  },
  { immediate: true },
)

watch(
  () => props.showPromptBar,
  (visible) => {
    if (!visible) return
    nextTick(() => syncPromptView())
  },
)

onMounted(() => {
  nextTick(() => syncPromptView())
})

function dismissVideoGenPromptOverlay() {
  return videoGenPromptPanelRef.value?.dismissTopOverlay() ?? false
}

function applyImageResizeOverlayBox(box: ImageResizeOverlayBox | null) {
  imageResizeOverlayRef.value?.applyBox(box)
}

defineExpose({
  dismissVideoGenPromptOverlay,
  applyImageResizeOverlayBox,
})
</script>
<style scoped>

.image-dialogue__upload {
  width: 45px;
  height: 45px;
  padding: 0;
  border: 1px dashed #4b4b55;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: rgba(107, 124, 255, 0.55);
    background: rgba(107, 124, 255, 0.08);
  }

  .canvas__prompt--light & {
    border-color: #d1d5db;

    &:hover {
      border-color: rgba(79, 70, 229, 0.45);
      background: rgba(79, 70, 229, 0.06);
    }
  }
}

.image-dialogue__upload_icon {
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.canvas__prompt-file-input {
  display: none;
}

.canvas__prompt-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(20, 20, 24, 0.72);
  backdrop-filter: blur(4px);

  .canvas__prompt--light & {
    background: rgba(255, 255, 255, 0.88);
  }
}

.canvas__prompt-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 120px;
  padding: 20px 12px;
  border: 1px dashed #6b7280;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);

  .canvas__prompt--light & {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.canvas__prompt-drop-icon {
  width: 28px;
  height: 28px;
}

.canvas__prompt-drop-text {
  margin: 0;
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;

  .canvas__prompt--light & {
    color: #6b7280;
  }
}

.canvas__prompt--dragover {
  border-color: rgba(107, 124, 255, 0.55);
}
</style>
