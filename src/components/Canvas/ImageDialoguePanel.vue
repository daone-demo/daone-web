<template>
  <div
    class="image-dialogue"
    :class="{
      'image-dialogue--light': isLightTheme,
      'image-dialogue--dragover': isDragOver,
    }"
    @dragenter.prevent="onDialogueDragEnter"
    @dragover.prevent="onDialogueDragOver"
    @dragleave="onDialogueDragLeave"
    @drop.prevent.stop="onDialogueDrop"
  >
    <div v-if="isDragOver" class="image-dialogue__drop-overlay" @mousedown.stop>
      <div class="image-dialogue__drop-zone">
        <img src="@assets/images/add.png" alt="" class="image-dialogue__drop-icon" />
        <p class="image-dialogue__drop-text">点击或拖拽图片到此处上传</p>
      </div>
    </div>
    <div style="display: flex;justify-content: flex-end;padding-right: 20px;">
      <a-select 
        v-model="selectedWorkFlow"
        class="image-dialogue__model-select"
        placeholder="选择工作流"
      >
        <a-select-option value="1"></a-select-option>
        <a-select-option value="2">小红书种草文案</a-select-option>
        <!-- <a-select-option value="3">3</a-select-option> -->
      </a-select>
      <button type="button" class="image-dialogue__expand" title="展开">
        <span class="image-dialogue__expand-icon" aria-hidden="true" />
      </button>
    </div>

    <div class="image-dialogue__head">
      <!-- <button
        type="button"
        class="image-dialogue__chip"
        @mousedown.stop
        @click.stop="openStyleModal"
      >
        <span class="image-dialogue__chip-icon" data-icon="style" aria-hidden="true" />
        风格
      </button>
      <button type="button" class="image-dialogue__chip">
        <span class="image-dialogue__chip-icon" data-icon="mark" aria-hidden="true" />
        标记
      </button> -->
      <div class="image-dialogue__thumbs">
        <div
          v-for="(item, index) in previewList"
          :key="item.key"
          class="image-dialogue__thumb"
          :title="`点击插入 @图片${index + 1}`"
          @mousedown.stop
          @click.stop="insertRefMention(index + 1)"
          @mouseenter="hoveredThumb = item.key"
          @mouseleave="hoveredThumb = null"
        >
          <img :src="item.previewUrl" alt="" class="image-dialogue__thumb-img" />
          <button
            v-if="hoveredThumb === item.key"
            type="button"
            class="image-dialogue__thumb-remove"
            title="移除"
            @mousedown.stop
            @click.stop="emit('remove', item.nodeId)"
          >
            <span class="image-dialogue__thumb-remove-icon" aria-hidden="true" />
          </button>
          <span v-else class="image-dialogue__thumb-badge">{{ index + 1 }}</span>

          <div v-if="hoveredThumb === item.key" class="image-dialogue__thumb-preview">
            <img :src="item.previewUrl" alt="" />
          </div>
        </div>
        <button
          type="button"
          class="image-dialogue__upload"
          title="添加图片"
          @mousedown.stop
          @click.stop="openFilePicker"
        >
          <img src="@assets/images/add.png" alt="" class="image-dialogue__upload_icon" />
        </button>
        <input
          ref="fileInputRef"
          type="file"
          class="image-dialogue__file-input"
          accept="image/*"
          multiple
          @change="onFileInputChange"
        />
      </div>
    </div>

    <div
      ref="promptInputRef"
      class="image-dialogue__input image-dialogue__input--rich"
      :class="{ 'image-dialogue__input--empty': !modelValue.length }"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="IMAGE_DIALOGUE_PLACEHOLDER"
      @input="onPromptInput"
      @keydown="onPromptKeydown"
      @paste="onPromptPaste"
    />

    <div class="image-dialogue__footer">
      <div class="image-dialogue__footer-left">
        <div class="image-dialogue__model-wrap">
          <button
            type="button"
            class="image-dialogue__model"
            :class="{ 'image-dialogue__model--active': showModelMenu }"
            @click="toggleModelMenu"
          >
            <span class="image-dialogue__model-icon" aria-hidden="true" />
            {{ selectedModelName }}
            <span class="image-dialogue__model-caret" aria-hidden="true" />
          </button>
          <div
            v-if="showModelMenu"
            class="image-dialogue__model-menu"
            @mousedown.stop
          >
            <button
              v-for="model in IMAGE_DIALOGUE_MODEL_MENU"
              :key="model.key"
              type="button"
              class="image-dialogue__model-item"
              :class="{ 'image-dialogue__model-item--active': model.key === selectedModelKey }"
              @click="selectModel(model)"
            >
              <span
                class="image-dialogue__model-item-icon"
                :data-icon="model.icon"
                aria-hidden="true"
              />
              <span class="image-dialogue__model-item-main">
                <span class="image-dialogue__model-item-name">
                  {{ model.name }}
                  <span v-if="model.badge" class="image-dialogue__model-item-badge">{{ model.badge }}</span>
                </span>
                <span v-if="model.desc" class="image-dialogue__model-item-desc">{{ model.desc }}</span>
              </span>
              <span class="image-dialogue__model-item-duration">{{ model.duration }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="image-dialogue__footer-right">
        <div class="image-dialogue__gen-settings-wrap">
          <button
            type="button"
            class="image-dialogue__pill"
            :class="{ 'image-dialogue__pill--active': showGenSettings }"
            @click="toggleGenSettings"
          >
            <span class="image-dialogue__pill-icon" data-icon="frame" aria-hidden="true" />
            {{ IMAGE_DIALOGUE_QUALITY_LABEL }}
            <span class="image-dialogue__select-arrow" aria-hidden="true" />
          </button>
          <div
            v-if="showGenSettings"
            class="image-dialogue__gen-settings-menu"
            @mousedown.stop
          >
            <ImageGenSettingsPopover
              v-model:aspect-ratio="genAspectRatio"
              v-model:image-count="genImageCount"
              @close="showGenSettings = false"
            />
          </div>
        </div>

        <!-- <button type="button" class="image-dialogue__tool" title="摄像机">
          <span class="image-dialogue__tool-icon" data-icon="camera" aria-hidden="true" />
          摄像机
        </button>
        <button type="button" class="image-dialogue__tool" title="全景">
          <span class="image-dialogue__tool-icon" data-icon="panorama" aria-hidden="true" />
          全景
        </button> -->
        <button type="button" class="image-dialogue__icon" title="标记">
          <span class="image-dialogue__chip-icon" data-icon="mark" aria-hidden="true" />
        </button>
        <button type="button" class="image-dialogue__icon" title="翻译">
          <span class="image-dialogue__icon-glyph" data-icon="translate" aria-hidden="true" />
        </button>

        <div class="image-dialogue__count-wrap">
          <button
            type="button"
            class="image-dialogue__tool image-dialogue__tool--count"
            :class="{ 'image-dialogue__tool--active': showCountMenu }"
            title="生成张数"
            @click="toggleCountMenu"
          >
            {{ selectedCount }}张
            <span class="image-dialogue__select-arrow" aria-hidden="true" />
          </button>
          <div
            v-if="showCountMenu"
            class="image-dialogue__count-menu"
            @mousedown.stop
          >
            <button
              v-for="count in IMAGE_DIALOGUE_COUNT_OPTIONS"
              :key="count"
              type="button"
              class="image-dialogue__count-item"
              :class="{ 'image-dialogue__count-item--active': count === selectedCount }"
              @click="selectCount(count)"
            >
              {{ count }}张
            </button>
          </div>
        </div>

        <span class="image-dialogue__credits">
          <span class="image-dialogue__credits-icon" aria-hidden="true" />
          {{ IMAGE_DIALOGUE_CREDITS }}
        </span>

        <button type="button" class="image-dialogue__send" title="发送">
          <span class="image-dialogue__send-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <ImageStylePanel
        v-if="showStyleModal"
        @close="showStyleModal = false"
        @select="onStyleSelect"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCanvasBgTheme } from './useCanvasBgTheme'
import ImageGenSettingsPopover from './ImageGenSettingsPopover.vue'
import ImageStylePanel from './ImageStylePanel.vue'
import { createPromptMentionApi, needsSpaceBeforeMention } from './promptMention'
import {
  CANVAS_IMAGE_NODE_DRAG_TYPE,
  IMAGE_DIALOGUE_PLACEHOLDER,
  IMAGE_DIALOGUE_QUALITY_LABEL,
  IMAGE_DIALOGUE_CREDITS,
  IMAGE_DIALOGUE_MODEL_MENU,
  IMAGE_DIALOGUE_COUNT_OPTIONS,
  type ImageDialogueModelItem,
  type ImageGenAspectRatio,
  type ImageGenCount,
  type ImageSourceRef,
  type ImageStyleCard,
} from './constants'

const props = defineProps<{
  modelValue: string
  previewUrl?: string
  previews?: ImageSourceRef[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  remove: [sourceNodeId?: string]
  'upload-images': [files: File[]]
  'add-canvas-node': [nodeId: string]
}>()

const { isLightTheme } = useCanvasBgTheme()

const mentionApi = createPromptMentionApi('image-dialogue__mention')
const promptInputRef = ref<HTMLElement | null>(null)
let skipPromptWatch = false

const previewList = computed(() => {
  const list = Array.isArray(props.previews)
    ? props.previews.filter((item) => item.previewUrl)
    : []
  if (list.length) {
    return list.map((item, index) => ({
      key: item.nodeId || `src-${index}`,
      nodeId: item.nodeId,
      previewUrl: item.previewUrl,
    }))
  }
  if (props.previewUrl) {
    return [{ key: 'src-0', nodeId: '', previewUrl: props.previewUrl }]
  }
  return []
})

const hoveredThumb = ref<string | null>(null)
const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showStyleModal = ref(false)
const showGenSettings = ref(false)
const showModelMenu = ref(false)
const showCountMenu = ref(false)
const genAspectRatio = ref<ImageGenAspectRatio>('auto')
const genImageCount = ref<ImageGenCount>(1)
const selectedCount = ref<number>(IMAGE_DIALOGUE_COUNT_OPTIONS[0])
const selectedModelKey = ref(IMAGE_DIALOGUE_MODEL_MENU[0].key)
const selectedWorkFlow = ref('');

const selectedModelName = computed(
  () =>
    IMAGE_DIALOGUE_MODEL_MENU.find((model) => model.key === selectedModelKey.value)?.name ??
    IMAGE_DIALOGUE_MODEL_MENU[0].name,
)

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:modelValue', text)
  nextTick(() => {
    skipPromptWatch = false
  })
}

function syncPromptView(text = props.modelValue) {
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
    const current = props.modelValue
    const needsSpace = current.length > 0 && !/[\s]$/.test(current)
    emitPrompt(`${current}${needsSpace ? ' ' : ''}${token} `)
    return
  }

  el.focus()
  const sel = window.getSelection()
  if (!sel?.rangeCount) {
    emitPrompt(`${props.modelValue}${props.modelValue && !/[\s]$/.test(props.modelValue) ? ' ' : ''}${token} `)
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

watch(
  () => props.modelValue,
  (value) => {
    if (skipPromptWatch) return
    const el = promptInputRef.value
    if (!el || mentionApi.serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

onMounted(() => {
  nextTick(() => syncPromptView())
})

// function openStyleModal() {
//   showStyleModal.value = true
//   showModelMenu.value = false
//   showCountMenu.value = false
//   showGenSettings.value = false
// }

function onStyleSelect(card: ImageStyleCard) {
  void card
  showStyleModal.value = false
}

function toggleGenSettings() {
  showGenSettings.value = !showGenSettings.value
  if (showGenSettings.value) {
    showModelMenu.value = false
    showCountMenu.value = false
  }
}

function toggleModelMenu() {
  showModelMenu.value = !showModelMenu.value
  if (showModelMenu.value) {
    showGenSettings.value = false
    showCountMenu.value = false
  }
}

function toggleCountMenu() {
  showCountMenu.value = !showCountMenu.value
  if (showCountMenu.value) {
    showGenSettings.value = false
    showModelMenu.value = false
  }
}

function selectModel(model: ImageDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

function selectCount(count: number) {
  selectedCount.value = count
  showCountMenu.value = false
}

function hasDialogueDropContent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files') || types.includes(CANVAS_IMAGE_NODE_DRAG_TYPE)
}

function onDialogueDragEnter(event: DragEvent) {
  if (!hasDialogueDropContent(event)) return
  isDragOver.value = true
}

function onDialogueDragOver(event: DragEvent) {
  if (!hasDialogueDropContent(event)) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

function onDialogueDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  const current = event.currentTarget as HTMLElement | null
  if (related && current?.contains(related)) return
  isDragOver.value = false
}

function onDialogueDrop(event: DragEvent) {
  isDragOver.value = false
  const nodeId = event.dataTransfer?.getData(CANVAS_IMAGE_NODE_DRAG_TYPE)
  if (nodeId) {
    emit('add-canvas-node', nodeId)
    return
  }

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.type.startsWith('image/'),
  )
  if (files.length) emit('upload-images', files)
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function onFileInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'))
  if (files.length) emit('upload-images', files)
  input.value = ''
}

function onDocumentMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  if (showModelMenu.value && !target.closest('.image-dialogue__model-wrap')) {
    showModelMenu.value = false
  }
  if (showCountMenu.value && !target.closest('.image-dialogue__count-wrap')) {
    showCountMenu.value = false
  }
  if (showGenSettings.value && !target.closest('.image-dialogue__gen-settings-wrap')) {
    showGenSettings.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
})
</script>

<style scoped lang="scss">
.image-dialogue {
  position: relative;
  width: 100%;
  padding: 14px 16px 12px;
  border: 1px solid #3d3d45;
  border-radius: 18px;
  background: rgba(30, 30, 34, 0.98);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: visible;

  &--light {
    border-color: #e5e7eb;
    background: #fff;
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
  }
}

.image-dialogue__expand {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light &:hover {
    background: #f3f4f6;
  }
}

.image-dialogue__expand-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M5.5 8.5 11 3m0 0H7.5M11 3v3.5'/%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M11 9v1.5A1.5 1.5 0 0 1 9.5 12H3.5A1.5 1.5 0 0 1 2 10.5v-6A1.5 1.5 0 0 1 3.5 3H5'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.image-dialogue__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-right: 28px;
  padding-top: 12px;
}

.image-dialogue__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid #4b4b55;
  border-radius: 10px;
  background: #252528;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    border-color: #ebedf0;
    background: #fff;
    color: #374151;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);

    &:hover {
      background: #f9fafb;
    }
  }
}

.image-dialogue__chip-icon {
  width: 14px;
  height: 14px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px 14px;

  &[data-icon='style'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 4.5 7 2.5l4.5 2v5L7 11.5l-4.5-2zM7 2.5v9M2.5 4.5 7 6.5l4.5-2'/%3E%3C/svg%3E");
  }

  &[data-icon='mark'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M7 12.5s4-3.2 4-6.5a4 4 0 1 0-8 0c0 3.3 4 6.5 4 6.5Z'/%3E%3Ccircle cx='7' cy='6' r='1.5' stroke='%236b7280' stroke-width='1.2'/%3E%3C/svg%3E");
  }
}

.image-dialogue__thumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.image-dialogue__thumb {
  position: relative;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border-radius: 8px;
  border: 1px solid #4b4b55;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(107, 124, 255, 0.55);
    transform: translateY(-1px);
  }

  .image-dialogue--light & {
    border-color: #ebedf0;

    &:hover {
      border-color: rgba(79, 70, 229, 0.45);
    }
  }
}
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

  .image-dialogue--light & {
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

.image-dialogue__file-input {
  display: none;
}

.image-dialogue__drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(20, 20, 24, 0.72);
  backdrop-filter: blur(4px);

  .image-dialogue--light & {
    background: rgba(255, 255, 255, 0.88);
  }
}

.image-dialogue__drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 120px;
  padding: 20px 12px;
  border: 1px dashed #6b7280;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);

  .image-dialogue--light & {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.image-dialogue__drop-icon {
  width: 28px;
  height: 28px;
}

.image-dialogue__drop-text {
  margin: 0;
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;

  .image-dialogue--light & {
    color: #6b7280;
  }
}

.image-dialogue--dragover {
  border-color: rgba(107, 124, 255, 0.55);
}

.image-dialogue__thumb-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
  background: linear-gradient(135deg, #d6f5c8 0%, #aee08a 55%, #8fd06a 100%);
}

.image-dialogue__thumb-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 7px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  font-weight: 600;
}

.image-dialogue__thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.82);
  cursor: pointer;

  &:hover {
    background: rgba(17, 24, 39, 0.95);
  }
}

.image-dialogue__thumb-remove-icon {
  width: 9px;
  height: 9px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' fill='none' viewBox='0 0 9 9'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-width='1.3' d='m2 2 5 5M7 2 2 7'/%3E%3C/svg%3E") center / 9px 9px no-repeat;
}

.image-dialogue__thumb-preview {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  z-index: 8;
  transform: translateX(-50%);
  padding: 6px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.22);
  pointer-events: none;

  img {
    display: block;
    width: 150px;
    max-height: 260px;
    object-fit: contain;
    border-radius: 8px;
  }
}

.image-dialogue__input {
  width: 100%;
  min-height: 56px;
  padding: 4px 2px;
  border: none;
  background: transparent;
  color: #f3f4f6;
  font-size: 14px;
  line-height: 1.55;
  resize: none;
  outline: none;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;

  &--rich.image-dialogue__input--empty::before {
    content: attr(data-placeholder);
    color: #6b7280;
    pointer-events: none;
  }

  :deep(.image-dialogue__mention) {
    color: #6b7cff;
    font-weight: 500;
    user-select: all;
    cursor: default;
  }

  .image-dialogue--light & {
    color: #111827;

    &.image-dialogue__input--rich.image-dialogue__input--empty::before {
      color: #9ca3af;
    }

    :deep(.image-dialogue__mention) {
      color: #4f46e5;
    }
  }
}

.image-dialogue__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}

.image-dialogue__footer-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.image-dialogue__footer-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.image-dialogue__gen-settings-wrap {
  position: relative;
}

.image-dialogue__gen-settings-menu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 5;
}

.image-dialogue__select-arrow {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 3.75 5 6.25 7.5 3.75'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.image-dialogue__model {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #4b4b55;
  border-radius: 999px;
  background: #252528;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    border-color: #ebedf0;
    background: #fff;
    color: #374151;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);

    &:hover {
      background: #f9fafb;
    }
  }
}

.image-dialogue__model-icon {
  width: 14px;
  height: 14px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Cpath fill='%237c8cff' d='M7 1.5 8.3 5 11.8 6.3 8.3 7.6 7 11.1 5.7 7.6 2.2 6.3 5.7 5z'/%3E%3C/svg%3E") center / 14px 14px no-repeat;
}

.image-dialogue__model-caret {
  width: 10px;
  height: 10px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='none' viewBox='0 0 10 10'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 6.25 5 3.75 7.5 6.25'/%3E%3C/svg%3E") center / 10px 10px no-repeat;
}

.image-dialogue__model-wrap {
  position: relative;
}

.image-dialogue__model--active {
  background: #2a2a30;
  border-color: #4b4b55;

  .image-dialogue--light & {
    background: #f3f4f6;
    border-color: #d1d5db;
  }
}

.image-dialogue__model-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 6;
  width: 300px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #3d3d45;
  border-radius: 14px;
  background: #1e1e22;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);

  .image-dialogue--light & {
    border-color: #ebedf0;
    background: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  }
}

.image-dialogue__model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    &:hover {
      background: #f6f7f9;
    }
  }
}

.image-dialogue__model-item--active {
  background: #2a2a30;

  .image-dialogue--light & {
    background: #f3f4f6;
  }
}

.image-dialogue__model-item-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background-color: #2a2a30;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 18px 18px;

  .image-dialogue--light & {
    background-color: #f3f4f6;
  }

  &[data-icon='lib'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Ccircle cx='9' cy='9' r='6' stroke='%236b7280' stroke-width='1.3'/%3E%3Ccircle cx='9' cy='9' r='2.2' stroke='%236b7280' stroke-width='1.3'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.3' d='M9 3v1.6M9 13.4V15M3 9h1.6M13.4 9H15'/%3E%3C/svg%3E");
  }

  &[data-icon='navo'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.4' d='m4.5 4.5 9 9m0-9-9 9'/%3E%3C/svg%3E");
  }

  &[data-icon='seedream'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }

  &[data-icon='mj'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M9 3v9M9 12 4 11c.8 2 2.7 3 5 3s4.2-1 5-3zM9 5.5c1.6.4 3 1.8 3.4 3.5'/%3E%3C/svg%3E");
  }
}

.image-dialogue__model-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.image-dialogue__model-item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f3f4f6;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;

  .image-dialogue--light & {
    color: #1f2937;
  }
}

.image-dialogue__model-item-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 6px;
  background: #fde68a;
  color: #92400e;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.image-dialogue__model-item-desc {
  color: #9ca3af;
  font-size: 12px;
  line-height: 1.3;

  .image-dialogue--light & {
    color: #6b7280;
  }
}

.image-dialogue__model-item-duration {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1;

  .image-dialogue--light & {
    color: #6b7280;
  }
}

.image-dialogue__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #4b4b55;
  border-radius: 999px;
  background: #252528;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    border-color: #ebedf0;
    background: #fff;
    color: #374151;

    &:hover {
      background: #f9fafb;
    }
  }
}

.image-dialogue__pill--active {
  background: #2a2a30;
  border-color: #4b4b55;

  .image-dialogue--light & {
    background: #f3f4f6;
    border-color: #d1d5db;
  }
}

.image-dialogue__pill-icon {
  width: 14px;
  height: 14px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 14px 14px;

  &[data-icon='frame'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' viewBox='0 0 14 14'%3E%3Crect x='2.5' y='2.5' width='9' height='9' rx='1.5' stroke='%236b7280' stroke-width='1.2'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-width='1.2' d='M2.5 5.5h9M5.5 2.5v9'/%3E%3C/svg%3E");
  }
}

.image-dialogue__tool {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #cbd0d8;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    color: #4b5563;

    &:hover {
      background: #f3f4f6;
    }
  }
}

.image-dialogue__tool--count {
  gap: 2px;
}

.image-dialogue__tool--active {
  background: #2a2a30;

  .image-dialogue--light & {
    background: #f3f4f6;
  }
}

.image-dialogue__count-wrap {
  position: relative;
}

.image-dialogue__count-menu {
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  transform: translateX(-50%);
  z-index: 6;
  width: 92px;
  padding: 6px;
  border: 1px solid #3d3d45;
  border-radius: 12px;
  background: #1e1e22;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);

  .image-dialogue--light & {
    border-color: #ebedf0;
    background: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  }
}

.image-dialogue__count-item {
  display: block;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1;
  text-align: center;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light & {
    color: #374151;

    &:hover {
      background: #f3f4f6;
    }
  }
}

.image-dialogue__count-item--active {
  background: #2a2a30;
  font-weight: 600;

  .image-dialogue--light & {
    background: #f3f4f6;
    color: #111827;
  }
}

.image-dialogue__tool-icon {
  width: 15px;
  height: 15px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 15px 15px;

  &[data-icon='camera'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' fill='none' viewBox='0 0 15 15'%3E%3Crect x='1.8' y='4.2' width='8' height='6.6' rx='1.4' stroke='%236b7280' stroke-width='1.2'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m9.8 6.4 3.4-1.8v5.8L9.8 8.6'/%3E%3C/svg%3E");
  }

  &[data-icon='panorama'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' fill='none' viewBox='0 0 15 15'%3E%3Crect x='2' y='3' width='11' height='9' rx='1.4' stroke='%236b7280' stroke-width='1.2'/%3E%3Ccircle cx='5.2' cy='6' r='1' fill='%236b7280'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m2.6 11 3.2-3.2 2.2 2.2 2.4-2.6 2 2.2'/%3E%3C/svg%3E");
  }
}

.image-dialogue__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
  }

  .image-dialogue--light &:hover {
    background: #f3f4f6;
  }
}

.image-dialogue__icon-glyph {
  width: 16px;
  height: 16px;

  &[data-icon='translate'] {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 4h5M5 2.5v1.5M6.5 4c-.4 2.6-2 4.6-4 5.5M3.5 6.5c.6 1.4 1.8 2.4 3.2 2.9'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m8.2 13 2.4-6h.4l2.4 6M9 11h3.6'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  }
}

.image-dialogue__credits {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 4px;
  color: #9ca3af;
  font-size: 12px;
  line-height: 1;

  .image-dialogue--light & {
    color: #6b7280;
  }
}

.image-dialogue__credits-icon {
  width: 13px;
  height: 13px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='13' fill='none' viewBox='0 0 13 13'%3E%3Cpath fill='%23f5a623' d='M7.2 1 3 7.3h2.6L5.2 12 9.8 5.4H7z'/%3E%3C/svg%3E") center / 13px 13px no-repeat;
}

.image-dialogue__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #6b7cff;
  cursor: pointer;

  &:hover {
    background: #5b6cff;
  }

  .image-dialogue--light & {
    background: #111827;

    &:hover {
      background: #1f2937;
    }
  }
}

.image-dialogue__send-icon {
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M8 12.5v-9M4.5 7 8 3.5 11.5 7'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
}
</style>
