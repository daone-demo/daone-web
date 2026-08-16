<template>
  <div
    class="video-dialogue"
    :class="{ 'video-dialogue--dragover': isDragOver }"
    @dragenter.prevent="onPanelDragEnter"
    @dragover.prevent="onPanelDragOver"
    @dragleave="onPanelDragLeave"
    @drop.prevent.stop="onPanelDrop"
  >
    <div v-if="isDragOver" class="video-dialogue__drop-overlay" @mousedown.stop>
      <div class="video-dialogue__drop-zone">
        <img src="@assets/images/add.png" alt="" class="video-dialogue__drop-icon" />
        <p class="video-dialogue__drop-text">点击或拖拽图片到此处上传</p>
      </div>
    </div>

    <!-- <div class="video-dialogue__head">
      <div class="video-dialogue__advisor-wrap">
        <button
          type="button"
          class="video-dialogue__select"
          :class="{ 'video-dialogue__select--active': showAdvisorMenu }"
          @click="toggleAdvisorMenu"
        >
          {{ advisorButtonLabel }}
          <span class="video-dialogue__select-arrow" aria-hidden="true" />
        </button>
        <div
          v-if="showAdvisorMenu"
          class="video-dialogue__advisor-menu"
          @mousedown.stop
        >
          <template v-if="workflowOptionGroups.length">
            <div
              v-for="item in workflowOptionGroups"
              :key="item.categoryId"
              class="video-dialogue__advisor-item"
              :class="{ 'video-dialogue__advisor-item--active': activeAdvisorKey === item.categoryId }"
              @mouseenter="activeAdvisorKey = item.categoryId"
            >
              <span>{{ item.categoryName }}</span>
              <span class="video-dialogue__advisor-arrow" aria-hidden="true" />
              <div
                v-if="activeAdvisorKey === item.categoryId"
                class="video-dialogue__advisor-submenu"
              >
                <button
                  v-for="child in item.children"
                  :key="child.id"
                  type="button"
                  class="video-dialogue__advisor-subitem"
                  :class="{ 'video-dialogue__advisor-subitem--active': child.id === selectedWorkflowId }"
                  @click="selectAdvisorItem(child.id)"
                >
                  {{ child.name }}
                </button>
              </div>
            </div>
          </template>
          <p v-else class="video-dialogue__advisor-empty">暂无工作流</p>
        </div>
      </div>
    </div> -->

    <div class="video-dialogue__refs">
      <div
        v-for="ref in displayRefs"
        :key="ref.nodeId"
        class="video-dialogue__ref"
        :title="`点击插入 @${getRefDisplayName(ref)}`"
        @mousedown.stop
        @click.stop="insertRefMention(ref)"
      >
        <img :src="ref.previewUrl" alt="" />
        <button
          type="button"
          class="video-dialogue__ref-remove"
          title="删除"
          @click.stop="emit('remove-source-ref', ref.nodeId)"
        >
          ×
        </button>
        <span v-if="ref.badge" class="video-dialogue__ref-badge">{{ ref.badge }}</span>
        <span v-else class="video-dialogue__ref-index">{{ ref.index }}</span>
      </div>
      <button
        type="button"
        class="video-dialogue__upload"
        title="添加图片"
        @mousedown.stop
        @click.stop="openFilePicker"
      >
        <img src="@assets/images/add.png" alt="" class="video-dialogue__upload-icon" />
      </button>
      <input
        ref="fileInputRef"
        type="file"
        class="video-dialogue__file-input"
        accept="image/*"
        multiple
        @change="onFileInputChange"
      />
    </div>

    <div
      ref="promptInputRef"
      class="video-dialogue__input video-dialogue__input--rich"
      :class="{ 'video-dialogue__input--empty': !modelValue.length }"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="VIDEO_GEN_PROMPT_PLACEHOLDER"
      @input="onPromptInput"
      @compositionstart="onPromptCompositionStart"
      @compositionend="onPromptCompositionEnd"
      @keydown="onPromptKeydown"
      @paste="onPromptPaste"
    />

    <div class="video-dialogue__footer">
      <div class="video-dialogue__model-wrap">
        <button
          type="button"
          class="video-dialogue__chip video-dialogue__chip--vip"
          :class="{ 'video-dialogue__chip--active': showModelMenu }"
          @click.stop="toggleModelMenu"
        >
          {{ selectedModelName }} ▾
        </button>
        <div
          v-if="showModelMenu"
          class="video-dialogue__model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in modelMenu"
            :key="model.key"
            type="button"
            class="video-dialogue__model-item"
            :class="{ 'video-dialogue__model-item--active': model.key === selectedModelKey }"
            @click="selectModel(model)"
          >
            <span
              class="video-dialogue__model-item-icon"
              :class="{ 'video-dialogue__model-item-icon--font': isDialogueModelIconfont(model.icon) }"
              :data-icon="isDialogueModelIconfont(model.icon) ? undefined : model.icon"
              aria-hidden="true"
            >
              <i
                v-if="isDialogueModelIconfont(model.icon)"
                class="iconfont"
                :class="normalizeDialogueModelIcon(model.icon)"
              />
            </span>
            <span class="video-dialogue__model-item-name">{{ model.name }}</span>
          </button>
        </div>
      </div>

      <div class="video-dialogue__settings-wrap">
        <button
          type="button"
          class="video-dialogue__chip"
          :class="{ 'video-dialogue__chip--active': showVideoSettings }"
          @click.stop="toggleVideoSettings"
        >
          {{ videoSettingsLabel }}{{ generateAudio ? ' 🔊' : '' }} ▾
        </button>
        <div
          v-if="showVideoSettings"
          class="video-dialogue__settings-menu"
          @mousedown.stop
        >
          <VideoGenSettingsPopover
            v-model:duration="videoDuration"
            v-model:aspect-ratio="videoAspectRatio"
            v-model:resolution="videoResolution"
            v-model:generate-audio="generateAudio"
            :model-key="selectedModelKey"
            :chat-tools="chatTools"
            @close="showVideoSettings = false"
          />
        </div>
      </div>

      <button
        type="button"
        class="video-dialogue__tool"
        :class="{ 'video-dialogue__tool--loading': translating }"
        :title="translating ? '翻译中' : '翻译'"
        :disabled="translating"
        @mousedown.stop
        @click.stop="onTranslatePrompt"
      >
        <span v-if="translating" class="video-dialogue__translate-label">翻译中...</span>
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

      <a-select
        :value="videoCount"
        class="video-dialogue__count-select"
        @update:value="onVideoCountChange"
      >
        <a-select-option
          v-for="count in countOptions"
          :key="count"
          :value="count"
        >
          {{ count }}个
        </a-select-option>
      </a-select>

      <span class="video-dialogue__credits">
        <!-- <span class="video-dialogue__credits-icon" aria-hidden="true" />
        {{ VIDEO_DIALOGUE_CREDITS }} -->
      </span>
      <a-popover placement="top">
        <template #content>
          <span>发送</span>
        </template>
        <button type="button" class="video-dialogue__send" @click="onSend">
          <span class="video-dialogue__send-icon" aria-hidden="true" />
        </button>
      </a-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import api, { type PromptTranslationData } from '@/services/api'
import { isRequestError } from '@/utils/request'
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import { createPromptMentionApi, isInputComposing, needsSpaceBeforeMention } from './promptMention'
import {
  createMentionSpan,
  findMentionAfterCursor,
  findMentionBeforeCursor,
  getPlainTextOffset,
  renderPromptToEl,
  serializePromptEl,
  setPlainTextOffset,
  VIDEO_GEN_MENTION_CLASS,
} from './videoGenPromptMention'
import {
  CANVAS_IMAGE_NODE_DRAG_TYPE,
  VIDEO_GEN_PROMPT_PLACEHOLDER,
  VIDEO_DIALOGUE_MODEL_MENU,
  VIDEO_GEN_DURATIONS,
  buildVideoDialogueCountOptionsFromCapabilities,
  buildVideoDialogueModelsFromCapabilities,
  formatVideoGenSettings,
  isDialogueModelIconfont,
  normalizeDialogueModelIcon,
  normalizeVideoDialogueSettingsForModel,
  resolveVideoDialogueModelApiValue,
  type ChatTools,
  type VideoDialogueModelItem,
  type VideoDialogueSettings,
  type VideoDialogueSubmitPayload,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenResolution,
  type WorkflowCategoryGroup,
} from './constants'
import type { VideoSourceRef } from './videoGen'

const props = defineProps<{
  modelValue: string
  settings: VideoDialogueSettings
  sourceRefs?: VideoSourceRef[]
  chatTools?: ChatTools | null
  workflows?: WorkflowCategoryGroup[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:settings': [value: VideoDialogueSettings]
  'remove-source-ref': [nodeId: string]
  'upload-images': [files: File[]]
  'add-canvas-node': [nodeId: string]
  submit: [payload: VideoDialogueSubmitPayload]
}>()

const showAdvisorMenu = ref(false)
const showVideoSettings = ref(false)
const showModelMenu = ref(false)
// const activeAdvisorKey = ref('')
// const selectedWorkflowId = ref('')
// Advisor menu UI is commented out in template; keep refs for re-enable.
// const workflowOptionGroups = computed(() => buildVideoWorkflowOptionGroups(props.workflows))
// const advisorButtonLabel = computed(() => {
//   for (const group of workflowOptionGroups.value) {
//     const found = group.children.find((item) => item.id === selectedWorkflowId.value)
//     if (found) return found.name
//   }
//   return '视频参谋'
// })
const videoDuration = ref<VideoGenDuration>(VIDEO_GEN_DURATIONS[0])
const videoAspectRatio = ref<VideoGenAspectRatio>('16:9')
const videoResolution = ref<VideoGenResolution>('480P')
const generateAudio = ref(true)
const videoCount = ref(1)
const selectedModelKey = ref(VIDEO_DIALOGUE_MODEL_MENU[0].key)
let skipSettingsWatch = false

const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const promptInputRef = ref<HTMLElement | null>(null)
let skipPromptWatch = false
const isPromptComposing = ref(false)
const translating = ref(false)
const mentionApi = createPromptMentionApi(VIDEO_GEN_MENTION_CLASS)

function buildSettingsFromRefs(): VideoDialogueSettings {
  return {
    modelKey: selectedModelKey.value,
    aspectRatio: videoAspectRatio.value,
    resolution: videoResolution.value,
    duration: videoDuration.value,
    generateAudio: generateAudio.value,
    videoCount: videoCount.value,
    mode: props.settings.mode,
  }
}

function applySettingsToRefs(settings: VideoDialogueSettings) {
  skipSettingsWatch = true
  const normalized = normalizeVideoDialogueSettingsForModel(settings, props.chatTools)
  selectedModelKey.value = normalized.modelKey
  videoAspectRatio.value = normalized.aspectRatio
  videoResolution.value = normalized.resolution
  videoDuration.value = normalized.duration
  generateAudio.value = normalized.generateAudio
  videoCount.value = normalized.videoCount
  nextTick(() => {
    skipSettingsWatch = false
  })
}

function emitSettings() {
  if (skipSettingsWatch) return
  emit('update:settings', buildSettingsFromRefs())
}

watch(
  () => props.settings,
  (settings) => {
    applySettingsToRefs(settings)
  },
  { deep: true, immediate: true },
)

watch(
  [selectedModelKey, videoAspectRatio, videoResolution, videoDuration, generateAudio, videoCount],
  () => {
    emitSettings()
  },
)

const modelMenu = computed(() =>
  buildVideoDialogueModelsFromCapabilities(props.chatTools),
)
const selectedModelName = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.name ??
    modelMenu.value[0]?.name ??
    VIDEO_DIALOGUE_MODEL_MENU[0].name,
)
const countOptions = computed(() =>
  buildVideoDialogueCountOptionsFromCapabilities(props.chatTools, selectedModelKey.value),
)

function applyNormalizedToolbarSettings(
  partial: Partial<VideoDialogueSettings> = {},
) {
  const normalized = normalizeVideoDialogueSettingsForModel(
    {
      modelKey: selectedModelKey.value,
      aspectRatio: videoAspectRatio.value,
      resolution: videoResolution.value,
      duration: videoDuration.value,
      generateAudio: generateAudio.value,
      videoCount: videoCount.value,
      mode: props.settings.mode,
      ...partial,
    },
    props.chatTools,
  )
  selectedModelKey.value = normalized.modelKey
  videoAspectRatio.value = normalized.aspectRatio
  videoResolution.value = normalized.resolution
  videoDuration.value = normalized.duration
  generateAudio.value = normalized.generateAudio
  videoCount.value = normalized.videoCount
}

function syncDialogueDefaultsFromChatTools() {
  applyNormalizedToolbarSettings()
}

watch(
  () => props.chatTools,
  () => {
    syncDialogueDefaultsFromChatTools()
  },
  { immediate: true, deep: true },
)

watch(
  () => selectedModelKey.value,
  () => {
    if (skipSettingsWatch) return
    applyNormalizedToolbarSettings()
  },
)

const videoSettingsLabel = computed(() =>
  formatVideoGenSettings(videoDuration.value, videoAspectRatio.value, videoResolution.value),
)

const displayRefs = computed(() => {
  const refs = props.sourceRefs ?? []
  if (props.settings.mode === 'first-last-frame') {
    return refs.slice(0, 2).map((ref, index) => ({
      ...ref,
      badge: index === 0 ? '首帧' : '尾帧',
    }))
  }
  return refs.map((ref) => ({ ...ref, badge: '' }))
})

function getRefDisplayName(ref: VideoSourceRef) {
  return `图片${ref.index}`
}

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:modelValue', text)
  nextTick(() => {
    skipPromptWatch = false
  })
}

function syncPromptView(text = props.modelValue) {
  if (isPromptComposing.value) return
  const el = promptInputRef.value
  if (!el) return

  const sel = window.getSelection()
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null
  const offset = range && el.contains(range.startContainer)
    ? getPlainTextOffset(el, range.startContainer, range.startOffset)
    : text.length

  renderPromptToEl(el, text)
  setPlainTextOffset(el, offset)
}

function insertRefMention(ref: VideoSourceRef) {
  const token = `@${getRefDisplayName(ref)}`
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

  const mention = createMentionSpan(token)
  range.insertNode(mention)
  const space = document.createTextNode(' ')
  mention.after(space)

  const nextRange = document.createRange()
  nextRange.setStartAfter(space)
  nextRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(nextRange)

  emitPrompt(serializePromptEl(el))
  nextTick(() => syncPromptView())
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

  const text = serializePromptEl(el)
  emitPrompt(text)
  if (isPromptComposing.value || isInputComposing(event)) return
  nextTick(() => syncPromptView(text))
}

function onPromptKeydown(event: KeyboardEvent) {
  if (isPromptComposing.value || isInputComposing(event)) return

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    onSend()
    return
  }

  if (event.key !== 'Backspace' && event.key !== 'Delete') return

  const el = promptInputRef.value
  if (!el) return

  const mention = event.key === 'Backspace'
    ? findMentionBeforeCursor()
    : findMentionAfterCursor()

  if (!mention) return

  event.preventDefault()
  mention.remove()
  emitPrompt(serializePromptEl(el))
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
    if (skipPromptWatch || isPromptComposing.value) return
    const el = promptInputRef.value
    if (!el || serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

async function onTranslatePrompt() {
  const text = props.modelValue.trim()
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

function toggleVideoSettings() {
  showVideoSettings.value = !showVideoSettings.value
  if (showVideoSettings.value) {
    showModelMenu.value = false
    showAdvisorMenu.value = false
  }
}

function toggleModelMenu() {
  showModelMenu.value = !showModelMenu.value
  if (showModelMenu.value) {
    showVideoSettings.value = false
    showAdvisorMenu.value = false
  }
}

function selectModel(model: VideoDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

// function toggleAdvisorMenu() {
//   showAdvisorMenu.value = !showAdvisorMenu.value
//   if (showAdvisorMenu.value) {
//     activeAdvisorKey.value = workflowOptionGroups.value[0]?.categoryId ?? ''
//     showVideoSettings.value = false
//     showModelMenu.value = false
//   }
// }

// function selectAdvisorItem(workflowId: string) {
//   selectedWorkflowId.value = workflowId
//   showAdvisorMenu.value = false
// }

function onVideoCountChange(value: unknown) {
  if (value === undefined || value === null) return
  videoCount.value = Number(value)
}

function hasPanelDropContent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files') || types.includes(CANVAS_IMAGE_NODE_DRAG_TYPE)
}

function onPanelDragEnter(event: DragEvent) {
  if (!hasPanelDropContent(event)) return
  isDragOver.value = true
}

function onPanelDragOver(event: DragEvent) {
  if (!hasPanelDropContent(event)) return
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  isDragOver.value = true
}

function onPanelDragLeave(event: DragEvent) {
  const related = event.relatedTarget as Node | null
  const current = event.currentTarget as HTMLElement | null
  if (related && current?.contains(related)) return
  isDragOver.value = false
}

function onPanelDrop(event: DragEvent) {
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
  if (showAdvisorMenu.value && !target.closest('.video-dialogue__advisor-wrap')) {
    showAdvisorMenu.value = false
  }
  if (showModelMenu.value && !target.closest('.video-dialogue__model-wrap')) {
    showModelMenu.value = false
  }
  if (showVideoSettings.value && !target.closest('.video-dialogue__settings-wrap')) {
    showVideoSettings.value = false
  }
}

function onSend() {
  const prompt = props.modelValue.trim()
  if (!prompt) {
    message.warning('请输入提示词')
    return
  }

  const payload: VideoDialogueSubmitPayload = {
    prompt,
    model: resolveVideoDialogueModelApiValue(selectedModelKey.value, props.chatTools),
    ratio: videoAspectRatio.value,
    clarity: videoResolution.value,
    duration: videoDuration.value,
    generateAudio: generateAudio.value,
    videoCount: videoCount.value,
    mode: props.settings.mode,
  }
  emit('submit', payload)
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  nextTick(() => syncPromptView())
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
})
</script>

<style scoped lang="scss" src="./VideoDialoguePanel.scss"></style>
