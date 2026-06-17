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
    <div style="display: flex;justify-content: flex-end;padding-right: 20px;margin-bottom: 12px;">
      <div class="canvas__prompt-model-wrap">
        <button
          type="button"
          class="canvas__prompt-model-chip"
          :class="{ 'canvas__prompt-model-chip--active': showPromptWorkFlow }"
          @mousedown.stop
          @click.stop="togglePromptWorkFlow"
        >
          <span class="canvas__prompt-model-mark" aria-hidden="true" />
          {{ selectedPromptWorkFlowName }}
          <span class="canvas__prompt-model-arrow">▾</span>
        </button>
        <div
          v-if="showPromptWorkFlow"
          class="canvas__prompt-model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in TEXT_PROMPT_MODEL_MENU"
            :key="model.key"
            type="button"
            class="canvas__prompt-model-item"
            :class="{ 'canvas__prompt-model-item--active': model.key === selectedPromptModelKey }"
            @click="selectPromptWorkFlow(model)"
          >
            <span class="canvas__prompt-model-item-mark" aria-hidden="true" />
            <span class="canvas__prompt-model-item-main">
              <span class="canvas__prompt-model-item-name">{{ model.name }}</span>
              <span v-if="model.desc" class="canvas__prompt-model-item-desc">{{ model.desc }}</span>
            </span>
            <span class="canvas__prompt-model-item-time">{{ model.duration }}</span>
          </button>
        </div>
      </div>
    </div>
    <div
      class="canvas__prompt-body"
      :class="{
        'canvas__prompt-body--img2prompt': isImg2PromptTask,
      }"
    >
      <span v-if="isImg2PromptTask" class="canvas__prompt-refs">
        <span
          v-for="(item, index) in promptRefList"
          :key="item.key"
          class="canvas__prompt-ref"
          :title="`点击插入 @图片${index + 1}`"
          @mousedown.stop
          @click.stop="insertRefMention(index + 1)"
          @mouseenter="hoveredPromptRef = item.key"
          @mouseleave="hoveredPromptRef = null"
        >
          <img :src="item.previewUrl" alt="" />
          <button
            v-if="hoveredPromptRef === item.key"
            type="button"
            class="canvas__prompt-ref-remove"
            title="移除"
            @mousedown.stop
            @click.stop="emit('remove-prompt-source', item.nodeId)"
          >
            <span class="canvas__prompt-ref-remove-icon" aria-hidden="true" />
          </button>
          <span v-else class="canvas__prompt-ref-badge">{{ index + 1 }}</span>

          <div v-if="hoveredPromptRef === item.key" class="canvas__prompt-ref-preview">
            <img :src="item.previewUrl" alt="" />
          </div>
        </span>
        <button
          type="button"
          class="image-dialogue__upload"
          title="添加图片"
          @mousedown.stop
          @click.stop="openPromptFilePicker"
        >
          <img src="@assets/images/add.png" alt="" class="image-dialogue__upload_icon" />
        </button>
        <input
          ref="promptFileInputRef"
          type="file"
          class="canvas__prompt-file-input"
          accept="image/*"
          multiple
          @change="onPromptFileInputChange"
        />
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
        @keydown="onPromptKeydown"
        @paste="onPromptPaste"
      />
    </div>
    <div class="canvas__prompt-footer">
      <div class="canvas__prompt-model-wrap">
        <button
          type="button"
          class="canvas__prompt-model-chip"
          :class="{ 'canvas__prompt-model-chip--active': showPromptModelMenu }"
          @mousedown.stop
          @click.stop="togglePromptModelMenu"
        >
          <span class="canvas__prompt-model-mark" aria-hidden="true" />
          {{ selectedPromptModelName }}
          <span class="canvas__prompt-model-arrow">▾</span>
        </button>
        <div
          v-if="showPromptModelMenu"
          class="canvas__prompt-model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in IMAGE_DIALOGUE_MODEL_MENU"
            :key="model.key"
            type="button"
            class="canvas__prompt-model-item"
            :class="{ 'canvas__prompt-model-item--active': model.key === selectedPromptModelKey }"
            @click="selectPromptModel(model)"
          >
            <span class="canvas__prompt-model-item-mark" aria-hidden="true" />
            <span class="canvas__prompt-model-item-main">
              <span class="canvas__prompt-model-item-name">{{ model.name }}</span>
              <span v-if="model.desc" class="canvas__prompt-model-item-desc">{{ model.desc }}</span>
            </span>
            <span class="canvas__prompt-model-item-time">{{ model.duration }}</span>
          </button>
        </div>
      </div>
      <div class="canvas__prompt-actions">
        <button type="button" class="canvas__prompt-icon" title="翻译">文A</button>
        <span class="canvas__prompt-credits">⚡ 1</span>
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
    </div>
  </div>

  <div
    v-if="showImageGenPromptBar"
    class="canvas__img2img-prompt"
    :style="{
      left: `${imageGenPromptPos.left}px`,
      top: `${imageGenPromptPos.top}px`,
      width: `${imageGenPromptPos.width}px`,
    }"
  >
    <ImageGenPromptPanel
      :prompt="imageGenPromptText"
      :seed="imageGenSeed"
      :source-preview-url="imageGenSourcePreviewUrl"
      :submitting="imageGenSubmitting"
      @update:prompt="emit('update:imageGenPromptText', $event)"
      @update:seed="emit('update:imageGenSeed', $event)"
      @generate="emit('generate-image')"
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
  >
    <VideoGenPromptPanel
      ref="videoGenPromptPanelRef"
      :prompt="videoGenPromptText"
      :active-tab="videoGenActiveTab"
      :source-refs="videoGenSourceRefs"
      :element-select-mode="elementSelectMode"
      :video-num="videoNum"
      @update:prompt="emit('update:videoGenPromptText', $event)"
      @update:video-num="emit('update:videoNum', $event)"
      @update:active-tab="emit('update:videoGenActiveTab', $event)"
      @drag-start="emit('video-gen-drag-start', $event)"
      @quick-action="emit('video-gen-quick-action', $event)"
      @remove-source-ref="emit('remove-video-source-ref', $event)"
      @upload-images="emit('upload-video-gen-images', $event)"
      @add-canvas-node="emit('add-video-gen-canvas-node', $event)"
    />
  </div>

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
      :preview-url="imageDialoguePreviewUrl"
      :previews="imageDialoguePreviews"
      @update:model-value="emit('update:imageDialogueText', $event)"
      @remove="emit('remove-image-dialogue-preview', $event)"
      @upload-images="emit('upload-image-dialogue-images', $event)"
      @add-canvas-node="emit('add-image-dialogue-canvas-node', $event)"
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
      @update:model-value="emit('update:videoDialogueText', $event)"
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
import ImageGenPromptPanel from '../ImageGenPromptPanel.vue'
import VideoGenPromptPanel from '../VideoGenPromptPanel.vue'
import ImageDialoguePanel from '../ImageDialoguePanel.vue'
import ImageCropOverlay from '../ImageCropOverlay.vue'
import VideoDialoguePanel from '../VideoDialoguePanel.vue'
import VideoHdPanel from '../VideoHdPanel.vue'
import VideoFramesPanel from '../VideoFramesPanel.vue'
import {
  CANVAS_IMAGE_NODE_DRAG_TYPE,
  IMAGE_DIALOGUE_MODEL_MENU,
  PROMPT_PLACEHOLDER,
  TEXT_PROMPT_MODEL_LABEL,
  TEXT_PROMPT_MODEL_MENU,
  type ImageSourceRef,
  type NodeKind,
  type TextPromptModelItem,
  type VideoHdMagnification,
} from '../constants'
import type { CanvasBgTheme } from '../canvasTheme'
import { createPromptMentionApi, needsSpaceBeforeMention } from '../promptMention'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { VideoSourceRef } from '../videoGen'

const videoGenPromptPanelRef = ref<InstanceType<typeof VideoGenPromptPanel> | null>(null)
const hoveredPromptRef = ref<string | null>(null)
const isPromptDragOver = ref(false)
const promptFileInputRef = ref<HTMLInputElement | null>(null)
const promptInputRef = ref<HTMLElement | null>(null)
const mentionApi = createPromptMentionApi('canvas__prompt-mention')
let skipPromptWatch = false

const props = defineProps<{
  canvasBgTheme: CanvasBgTheme
  showPromptBar: boolean
  showImageGenPromptBar: boolean
  showVideoGenPromptBar: boolean
  promptPos: { left: number; top: number; width: number }
  imageGenPromptPos: { left: number; top: number; width: number }
  videoGenPromptPos: { left: number; top: number; width: number }
  imageCropPos: { left: number; top: number; width: number; height: number }
  dialoguePos: { left: number; top: number; width: number }
  videoHdPos: { left: number; top: number; width: number }
  selectedKind: NodeKind | null
  showImageCrop: boolean
  showImageDialogue: boolean
  showVideoDialogue: boolean
  showVideoHdPanel: boolean
  showVideoFramesPanel: boolean
  imageCropSource: {
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
  imageGenPromptText: string
  imageGenSeed: number
  imageGenSourcePreviewUrl: string
  imageGenSubmitting: boolean
  videoGenPromptText: string
  videoNum: number
  videoGenActiveTab: string
  videoGenSourceRefs: VideoSourceRef[]
  elementSelectMode: boolean
  imageDialogueText: string
  imageDialoguePreviewUrl: string
  imageDialoguePreviews: ImageSourceRef[]
  videoDialogueText: string
  videoHdMagnification: VideoHdMagnification
}>()

const emit = defineEmits<{
  'update:promptText': [value: string]
  'update:videoNum': [value: number]
  'update:imageGenPromptText': [value: string]
  'update:imageGenSeed': [value: number]
  'update:videoGenPromptText': [value: string]
  'update:videoGenActiveTab': [value: string]
  'remove-prompt-source': [sourceNodeId?: string]
  'upload-prompt-images': [files: File[]]
  'add-prompt-canvas-node': [nodeId: string]
  'update:imageDialogueText': [value: string]
  'remove-image-dialogue-preview': [sourceNodeId?: string]
  'upload-image-dialogue-images': [files: File[]]
  'add-image-dialogue-canvas-node': [nodeId: string]
  'update:videoDialogueText': [value: string]
  'update:videoHdMagnification': [value: VideoHdMagnification]
  'persist-prompt-bar-draft': []
  'submit-text-prompt': []
  'generate-image': []
  'close-image-crop': []
  'image-crop-complete': [payload: { dataUrl: string; width: number; height: number }]
  'reset-video-hd-panel': []
  'video-hd-start': []
  'video-gen-drag-start': [event: MouseEvent]
  'video-gen-quick-action': [key: string]
  'remove-video-source-ref': [nodeId: string]
  'upload-video-gen-images': [files: File[]]
  'add-video-gen-canvas-node': [nodeId: string]
}>()

const showPromptModelMenu = ref(false)
const showPromptWorkFlow = ref(false)
const selectedPromptModelKey = ref(IMAGE_DIALOGUE_MODEL_MENU[0]?.key ?? '')
const selectedPromptWorkFlowKey = ref(TEXT_PROMPT_MODEL_MENU[0]?.key ?? '')
const selectedPromptWorkFlowName = computed(
  () =>
    TEXT_PROMPT_MODEL_MENU.find((model) => model.key === selectedPromptWorkFlowKey.value)?.name ??
    TEXT_PROMPT_MODEL_LABEL,
)
const selectedPromptModelName = computed(
  () =>
  IMAGE_DIALOGUE_MODEL_MENU.find((model) => model.key === selectedPromptModelKey.value)?.name ??
    TEXT_PROMPT_MODEL_LABEL,
)

const promptRefList = computed(() => {
  if (props.promptSourcePreviews.length) {
    return props.promptSourcePreviews.map((item, index) => ({
      key: item.nodeId || `src-${index}`,
      nodeId: item.nodeId,
      previewUrl: item.previewUrl,
    }))
  }
  if (props.promptSourcePreviewUrl) {
    return [{ key: 'src-0', nodeId: '', previewUrl: props.promptSourcePreviewUrl }]
  }
  return []
})

function togglePromptModelMenu() {
  showPromptWorkFlow.value = false;
  showPromptModelMenu.value = !showPromptModelMenu.value
}

function togglePromptWorkFlow() {
  showPromptModelMenu.value = false;
  showPromptWorkFlow.value = !showPromptWorkFlow.value
}

function selectPromptModel(model: TextPromptModelItem) {
  console.log(model)
  selectedPromptModelKey.value = model.key
  showPromptModelMenu.value = false
}

function selectPromptWorkFlow(model: TextPromptModelItem) {
  console.log(model)
  selectedPromptWorkFlowKey.value = model.key
  showPromptWorkFlow.value = false
}

function onPromptModelDocMouseDown(event: MouseEvent) {
  if (!showPromptModelMenu.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.canvas__prompt-model-wrap')) return
  showPromptModelMenu.value = false
}

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:promptText', text)
  emit('persist-prompt-bar-draft')
  nextTick(() => {
    skipPromptWatch = false
  })
}

function syncPromptView(text = props.promptText) {
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

function insertRefMention(index: number) {
  const token = `@图片${index}`
  const el = promptInputRef.value
  if (!el) {
    const current = props.promptText
    const needsSpace = current.length > 0 && !/[\s]$/.test(current)
    emitPrompt(`${current}${needsSpace ? ' ' : ''}${token} `)
    return
  }

  el.focus()
  const sel = window.getSelection()
  if (!sel?.rangeCount) {
    emitPrompt(`${props.promptText}${props.promptText && !/[\s]$/.test(props.promptText) ? ' ' : ''}${token} `)
    nextTick(() => syncPromptView())
    return
  }

  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(el)
    range.collapse(false)
  }

  range.deleteContents()

  if (needsSpaceBeforeMention(range, el, mentionApi.isMentionEl)) {
    range.insertNode(document.createTextNode(' '))
    range.collapse(false)
  }

  const mention = mentionApi.createMentionSpan(token)
  range.insertNode(mention)
  const space = document.createTextNode(' ')
  mention.after(space)

  const nextRange = document.createRange()
  nextRange.setStartAfter(space)
  nextRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(nextRange)

  emitPrompt(mentionApi.serializePromptEl(el))
  nextTick(() => syncPromptView())
}

function onPromptInput() {
  const el = promptInputRef.value
  if (!el) return

  const text = mentionApi.serializePromptEl(el)
  emitPrompt(text)
  nextTick(() => syncPromptView(text))
}

function onPromptKeydown(event: KeyboardEvent) {
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

function openPromptFilePicker() {
  promptFileInputRef.value?.click()
}

function onPromptFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (files.length) emit('upload-prompt-images', files)
  input.value = ''
}

watch(
  () => props.promptText,
  (value) => {
    if (skipPromptWatch) return
    const el = promptInputRef.value
    if (!el || mentionApi.serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

watch(
  () => props.showPromptBar,
  (visible) => {
    if (!visible) return
    nextTick(() => syncPromptView())
  },
)

onMounted(() => {
  document.addEventListener('mousedown', onPromptModelDocMouseDown, true)
  nextTick(() => syncPromptView())
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPromptModelDocMouseDown, true)
})

function dismissVideoGenPromptOverlay() {
  return videoGenPromptPanelRef.value?.dismissTopOverlay() ?? false
}

defineExpose({
  dismissVideoGenPromptOverlay,
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
