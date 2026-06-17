<template>
  <div
    class="video-gen-prompt-panel"
    :class="{
      'video-gen-prompt-panel--light': isLightTheme,
      'video-gen-prompt-panel--dragover': isDragOver,
    }"
    @mousedown="onPanelMouseDown"
    @dragenter.prevent="onPanelDragEnter"
    @dragover.prevent="onPanelDragOver"
    @dragleave="onPanelDragLeave"
    @drop.prevent.stop="onPanelDrop"
  >
    <div v-if="isDragOver && showSourceRefs" class="video-gen-prompt-panel__drop-overlay" @mousedown.stop>
      <div class="video-gen-prompt-panel__drop-zone">
        <img src="@assets/images/add.png" alt="" class="video-gen-prompt-panel__drop-icon" />
        <p class="video-gen-prompt-panel__drop-text">点击或拖拽图片到此处上传</p>
      </div>
    </div>
    <!-- <p
      v-if="validationHint"
      class="video-gen-prompt-panel__hint"
      :class="{ 'video-gen-prompt-panel__hint--error': validationError }"
    >
      {{ validationHint }}
    </p> -->

    <div class="video-gen-prompt-panel__tabs">
      <div 
        v-for="tab in videoGenTabs"
        :key="tab.key"
      >
        <a-tooltip v-if="tab.disabled">
          <template #title>{{ tab.disabledHint }}</template>
          <button
            type="button"
            class="video-gen-prompt-panel__tab"
            :class="{
              'video-gen-prompt-panel__tab--active': activeTab === tab.key,
              'video-gen-prompt-panel__tab--active-disabled': activeTab === tab.key && tab.disabled,
            }"
            :disabled="tab.disabled"
            @click="selectTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </a-tooltip>
        <button
          v-else
          type="button"
          class="video-gen-prompt-panel__tab"
          :class="{
            'video-gen-prompt-panel__tab--active': activeTab === tab.key,
            'video-gen-prompt-panel__tab--active-disabled': activeTab === tab.key && tab.disabled,
          }"
          :disabled="tab.disabled"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- <div class="video-gen-prompt-panel__head">
      <div class="video-gen-prompt-panel__actions">
        <button
          v-for="action in VIDEO_GEN_QUICK_ACTIONS"
          :key="action.key"
          type="button"
          class="video-gen-prompt-panel__action"
          :class="{ 'video-gen-prompt-panel__action--active': action.key === 'mark' && elementSelectMode }"
          @click="emit('quick-action', action.key)"
        >
          <span class="video-gen-prompt-panel__action-icon" :data-icon="action.icon" />
          {{ action.label }}
        </button>
      </div>
      <button type="button" class="video-gen-prompt-panel__expand" title="展开">⤢</button>
    </div> -->

    <div
      v-if="showSourceRefs"
      class="video-gen-prompt-panel__refs"
    >
      <div
        v-for="ref in displayRefs"
        :key="ref.nodeId"
        class="video-gen-prompt-panel__ref"
        :class="{ 'video-gen-prompt-panel__ref--invalid': validationError }"
        :title="`点击插入 @${getRefDisplayName(ref)}`"
        @mousedown.stop
        @click.stop="insertRefMention(ref)"
      >
        <img :src="ref.previewUrl" alt="" />
        <button
          type="button"
          class="video-gen-prompt-panel__ref-remove"
          title="删除"
          @click.stop="emit('remove-source-ref', ref.nodeId)"
        >
          ×
        </button>
        <span v-if="ref.badge" class="video-gen-prompt-panel__ref-badge">{{ ref.badge }}</span>
        <span v-else class="video-gen-prompt-panel__ref-index">{{ ref.index }}</span>
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
        class="video-gen-prompt-panel__file-input"
        accept="image/*"
        multiple
        @change="onFileInputChange"
      />
    </div>

    <div
      ref="promptInputRef"
      class="video-gen-prompt-panel__input video-gen-prompt-panel__input--rich"
      :class="{ 'video-gen-prompt-panel__input--empty': !prompt.length }"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="VIDEO_GEN_PROMPT_PLACEHOLDER"
      @input="onPromptInput"
      @keydown="onPromptKeydown"
      @paste="onPromptPaste"
    />

    <div class="video-gen-prompt-panel__footer">
      <div class="video-gen-prompt-panel__model-wrap">
        <button
          type="button"
          class="video-gen-prompt-panel__chip video-gen-prompt-panel__chip--vip"
          :class="{ 'video-gen-prompt-panel__chip--active': showVideoModelPicker }"
          @click.stop="toggleVideoModelPicker"
        >
          {{ selectedVideoModel?.name ?? 'Seedance 2.0 VIP' }} ▾
        </button>
        <div
          v-if="showVideoModelPicker"
          class="video-gen-prompt-panel__model-menu"
          @mousedown.stop
        >
          <VideoGenModelPicker
            :model-id="videoModelId"
            @update:model-id="onVideoModelChange"
            @select="showVideoModelPicker = false"
          />
        </div>
      </div>
      <div class="video-gen-prompt-panel__settings-wrap">
        <button
          type="button"
          class="video-gen-prompt-panel__chip"
          :class="{ 'video-gen-prompt-panel__chip--active': showVideoSettings }"
          @click.stop="toggleVideoSettings"
        >
          {{ videoSettingsLabel }}{{ generateAudio ? ' 🔊' : '' }} ▾
        </button>
        <div
          v-if="showVideoSettings"
          class="video-gen-prompt-panel__settings-menu"
          @mousedown.stop
        >
          <VideoGenSettingsPopover
            v-model:duration="videoDuration"
            v-model:aspect-ratio="videoAspectRatio"
            v-model:resolution="videoResolution"
            v-model:generate-audio="generateAudio"
            @close="showVideoSettings = false"
          />
        </div>
      </div>
      <a-tooltip>
        <template #title>标记</template>
        <button type="button" class="video-gen-prompt-panel__tool" title="标记">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            aria-hidden="true"
            role="img"
            class="iconify iconify--libtv text-fg-muted canvas-light:text-neutral-700"
            width="1em" height="1em" viewBox="0 0 16 16"
          >
            <g transform="translate(1.22 1.77)">
              <path d="M5.10059 0C7.91853 0.000212037 10.2001 2.2928 10.2002 5.11719L10.1943 5.37598C10.1317 6.63474 9.61327 7.77289 8.80469 8.63086C8.7912 8.64972 8.77744 8.66874 8.76074 8.68555L5.87793 11.5791C5.44885 12.0091 4.75232 12.0091 4.32324 11.5791L1.44043 8.68555C1.42361 8.66866 1.40906 8.64984 1.39551 8.63086C0.587075 7.77292 0.0694293 6.63459 0.00683594 5.37598L0 5.11719C0.000138958 2.29268 2.28246 0 5.10059 0ZM5.10059 0.867188C2.7641 0.867188 0.867315 2.76831 0.867188 5.11719C0.867188 6.26873 1.32268 7.31233 2.06348 8.07812C2.07238 8.08733 2.08091 8.0976 2.08887 8.10742L4.93652 10.9668C5.02701 11.0575 5.17318 11.0575 5.26367 10.9668L8.11133 8.10742C8.11936 8.09749 8.12772 8.08742 8.13672 8.07812C8.87758 7.31231 9.33301 6.26877 9.33301 5.11719C9.33288 2.84165 7.55295 0.985713 5.31738 0.87207L5.10059 0.867188ZM5.09863 3.72754C5.83057 3.72754 6.42467 4.32083 6.4248 5.05273C6.4248 5.78475 5.83065 6.37793 5.09863 6.37793C4.3668 6.37771 3.77344 5.78462 3.77344 5.05273C3.77357 4.32096 4.36688 3.72776 5.09863 3.72754ZM11.0459 8.02061C11.1147 7.83511 11.3774 7.83525 11.4463 8.02061L11.9326 9.33409C11.9542 9.3924 12.0003 9.43842 12.0586 9.46006L13.3721 9.94639C13.5578 10.0151 13.5578 10.278 13.3721 10.3468L12.0586 10.8331C12.0003 10.8547 11.9542 10.9008 11.9326 10.9591L11.4463 12.2726C11.3776 12.4583 11.1146 12.4583 11.0459 12.2726L10.5605 10.9591C10.539 10.9009 10.4927 10.8548 10.4346 10.8331L9.12012 10.3468C8.93479 10.2779 8.93469 10.0152 9.12012 9.94639L10.4346 9.46006C10.4927 9.43837 10.539 9.39229 10.5605 9.33409L11.0459 8.02061Z" fill="currentColor"></path>
            </g>
          </svg>
        </button>
      </a-tooltip>
      <a-tooltip>
        <template #title>从画布选图</template>
        <button type="button" class="video-gen-prompt-panel__tool" title="标记">
          <i className="iconfont icon-shubiaojiantou"></i>
        </button>
      </a-tooltip>
      <span class="video-gen-prompt-panel__tools">
        <button type="button" class="video-gen-prompt-panel__tool" title="翻译">文</button>
        <!-- <button type="button" class="video-gen-prompt-panel__tool" title="设置">☰</button> -->
      </span>
      <a-select
        :value="videoNum"
        class="video-gen-prompt-panel__count-select"
        @update:value="onVideoNumChange"
      >
        <a-select-option :value="1">1个</a-select-option>
        <a-select-option :value="2">2个</a-select-option>
        <a-select-option :value="3">3个</a-select-option>
      </a-select>
      <span class="video-gen-prompt-panel__credits">⚡ 122/135</span>
      <button
        type="button"
        class="video-gen-prompt-panel__send"
        :class="{ 'video-gen-prompt-panel__send--disabled': Boolean(validationError) }"
        :disabled="Boolean(validationError)"
        title="生成"
      >
        ↑
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useCanvasBgTheme } from './useCanvasBgTheme'
import VideoGenModelPicker from './VideoGenModelPicker.vue'
import { createPromptMentionApi, needsSpaceBeforeMention } from './promptMention'
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
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import {
  CANVAS_IMAGE_NODE_DRAG_TYPE,
  VIDEO_GEN_MODELS,
  VIDEO_GEN_PROMPT_PLACEHOLDER,
  VIDEO_GEN_TABS,
  formatVideoGenSettings,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenModelId,
  type VideoGenResolution,
} from './constants'
import { getVideoGenTabValidation } from './videoGen'
import type { VideoSourceRef } from './videoGen'


const { isLightTheme } = useCanvasBgTheme()
const videoGenTabs = ref<Array<{ key: string; label: string; disabled?: boolean; disabledHint?: string }>>([
  { key: 'text2video', label: '文生视频', disabled: true, disabledHint: '已接入媒体输入,无法使用纯文生视频' },
  { key: 'reference', label: '全能参考', disabled: false, disabledHint: '' },
  { key: 'img2video', label: '图生视频', disabled: false, disabledHint: '' },
  { key: 'frames', label: '首尾帧', disabled: false, disabledHint: '' },
  { key: 'imageRef', label: '图片参考', disabled: false, disabledHint: '' },
])

const props = defineProps<{
  videoNum: number
  prompt: string
  activeTab: string
  sourceRefs?: VideoSourceRef[]
  elementSelectMode?: boolean
}>()

const emit = defineEmits<{
  'update:videoNum': [value: number]
  'update:prompt': [value: string]
  'update:activeTab': [value: string]
  'drag-start': [event: MouseEvent]
  'quick-action': [key: string]
  'remove-source-ref': [nodeId: string]
  'upload-images': [files: File[]]
  'add-canvas-node': [nodeId: string]
}>()

const DRAG_IGNORE_SELECTOR =
  'button, textarea, input, select, a, [contenteditable], .ant-dropdown, .ant-dropdown-menu'

function onPanelMouseDown(event: MouseEvent) {
  event.stopPropagation()
  const target = event.target as HTMLElement | null
  if (target?.closest(DRAG_IGNORE_SELECTOR)) return
  emit('drag-start', event)
}

function onVideoNumChange(value: unknown) {
  if (value === undefined || value === null) return
  emit('update:videoNum', Number(value))
}

const sourceCount = computed(() => props.sourceRefs?.length ?? 0)

const showVideoModelPicker = ref(false)
const showVideoSettings = ref(false)
const videoModelId = ref<VideoGenModelId>('seedance-2-vip')
const videoDuration = ref<VideoGenDuration>(5)
const videoAspectRatio = ref<VideoGenAspectRatio>('16:9')
const videoResolution = ref<VideoGenResolution>('720P')
const generateAudio = ref(true)

const videoSettingsLabel = computed(() =>
  formatVideoGenSettings(videoDuration.value, videoAspectRatio.value, videoResolution.value),
)

const selectedVideoModel = computed(() =>
  VIDEO_GEN_MODELS.find((item) => item.id === videoModelId.value),
)

function toggleVideoModelPicker() {
  showVideoModelPicker.value = !showVideoModelPicker.value
  if (showVideoModelPicker.value) showVideoSettings.value = false
}

function onVideoModelChange(id: VideoGenModelId) {
  videoModelId.value = id
}

function toggleVideoSettings() {
  showVideoSettings.value = !showVideoSettings.value
  if (showVideoSettings.value) showVideoModelPicker.value = false
}

function dismissTopOverlay() {
  if (showVideoModelPicker.value) {
    showVideoModelPicker.value = false
    return true
  }
  if (showVideoSettings.value) {
    showVideoSettings.value = false
    return true
  }
  return false
}

defineExpose({ dismissTopOverlay })

function syncVideoGenTabsBySourceCount() {
  const count = sourceCount.value
  videoGenTabs.value = videoGenTabs.value.map((item) => {
    const next = { ...item }
    if (next.key === 'img2video') {
      next.disabledHint = `当前图片数量 ${count} 个，需要1个`
      if (count > 1) {
        if (props.activeTab === 'img2video') {
          emit('update:activeTab', 'reference')
        }
        next.disabled = true
      } else {
        next.disabled = false
      }
    }
    if (next.key === 'frames') {
      next.disabledHint = `当前图片数量 ${count} 个，需要1~2个`
      if (count > 2) {
        if (props.activeTab === 'frames') {
          emit('update:activeTab', 'reference')
        }
        next.disabled = true
      } else {
        next.disabled = false
      }
    }
    return next
  })
}

watch(sourceCount, syncVideoGenTabsBySourceCount, { immediate: true })

const validationHint = computed(() =>
  getVideoGenTabValidation(props.activeTab, sourceCount.value),
)

const validationError = computed(() => {
  const hint = validationHint.value
  if (!hint) return false
  return sourceCount.value > 0
})

const showSourceRefs = computed(() => props.activeTab !== 'text2video')

const isDragOver = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const displayRefs = computed(() => {
  const refs = props.sourceRefs ?? []
  if (props.activeTab === 'frames') {
    return refs.slice(0, 2).map((ref, index) => ({
      ...ref,
      badge: index === 0 ? '首帧' : '尾帧',
    }))
  }
  if (props.activeTab === 'imageRef' && refs.length === 1) {
    return refs.map((ref) => ({ ...ref, badge: '首帧' }))
  }
  return refs.map((ref) => ({ ...ref, badge: '' }))
})

function selectTab(key: string) {
  const tab = VIDEO_GEN_TABS.find((item) => item.key === key);
  if (tab?.disabled) return
  emit('update:activeTab', key);
}

const promptInputRef = ref<HTMLElement | null>(null)
let skipPromptWatch = false

function getRefDisplayName(ref: VideoSourceRef) {
  return `图片${ref.index}`
}

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:prompt', text)
  nextTick(() => {
    skipPromptWatch = false
  })
}

function syncPromptView(text = props.prompt) {
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

const mentionApi = createPromptMentionApi(VIDEO_GEN_MENTION_CLASS)

function needsSpaceBefore(range: Range, root: HTMLElement): boolean {
  return needsSpaceBeforeMention(range, root, mentionApi.isMentionEl)
}

function insertRefMention(ref: VideoSourceRef) {
  const token = `@${getRefDisplayName(ref)}`
  const el = promptInputRef.value
  if (!el) {
    const current = props.prompt
    const needsSpace = current.length > 0 && !/[\s]$/.test(current)
    emitPrompt(`${current}${needsSpace ? ' ' : ''}${token} `)
    return
  }

  el.focus()
  const sel = window.getSelection()
  if (!sel?.rangeCount) {
    emitPrompt(`${props.prompt}${props.prompt && !/[\s]$/.test(props.prompt) ? ' ' : ''}${token} `)
    nextTick(() => syncPromptView())
    return
  }

  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) {
    range.selectNodeContents(el)
    range.collapse(false)
  }

  range.deleteContents()

  if (needsSpaceBefore(range, el)) {
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

function onPromptInput() {
  const el = promptInputRef.value
  if (!el) return

  const text = serializePromptEl(el)
  emitPrompt(text)
  nextTick(() => syncPromptView(text))
}

function onPromptKeydown(event: KeyboardEvent) {
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

function hasPanelDropContent(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? [])
  return types.includes('Files') || types.includes(CANVAS_IMAGE_NODE_DRAG_TYPE)
}

function onPanelDragEnter(event: DragEvent) {
  if (!showSourceRefs.value || !hasPanelDropContent(event)) return
  isDragOver.value = true
}

function onPanelDragOver(event: DragEvent) {
  if (!showSourceRefs.value || !hasPanelDropContent(event)) return
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
  if (!showSourceRefs.value) return

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

watch(
  () => props.prompt,
  (value) => {
    if (skipPromptWatch) return
    const el = promptInputRef.value
    if (!el || serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

onMounted(() => {
  nextTick(() => syncPromptView())
})
</script>

<style scoped lang="scss">
.video-gen-prompt-panel {
  position: relative;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #3d3d45;
  border-radius: 14px;
  background: rgba(24, 24, 28, 0.98);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  cursor: move;

  &--light {
    border-color: #e5e7eb;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.1);
  }
}

.video-gen-prompt-panel__hint {
  margin: 0 0 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: #252528;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;

  &--error {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
  }

  .video-gen-prompt-panel--light & {
    background: #f3f4f6;
    color: #6b7280;

    &--error {
      background: rgba(239, 68, 68, 0.08);
      color: #dc2626;
    }
  }
}

.video-gen-prompt-panel__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2e2e34;
  overflow-x: auto;

  .video-gen-prompt-panel--light & {
    border-bottom-color: #e5e7eb;
  }
}

.video-gen-prompt-panel__tab {
  flex-shrink: 0;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;

  &:hover:not(:disabled) {
    color: #e5e7eb;
    background: #2a2a30;
  }

  &--active,
  &--active-disabled {
    color: #f3f4f6;
    background: #3d3d45;
  }

  .video-gen-prompt-panel--light & {
    color: #9ca3af;

    &:hover:not(:disabled) {
      color: #374151;
      background: #f3f4f6;
    }

    &--active,
    &--active-disabled {
      color: #111827;
      background: #e5e7eb;
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.video-gen-prompt-panel__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.video-gen-prompt-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.video-gen-prompt-panel__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 52px;
  padding: 6px 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;

  &:hover,
  &--active {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .video-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover,
    &--active {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.video-gen-prompt-panel__action-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #3d3d45;

  .video-gen-prompt-panel--light & {
    background: #e5e7eb;
  }

  &[data-icon='mark']::after {
    content: '⌖';
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 14px;
    color: #9ca3af;
  }

  &[data-icon='camera']::after {
    content: '▣';
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 12px;
    color: #9ca3af;
  }

  &[data-icon='role']::after {
    content: '♟';
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 14px;
    color: #9ca3af;
  }
}

.video-gen-prompt-panel__expand {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;

  &:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .video-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.video-gen-prompt-panel__refs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.video-gen-prompt-panel__ref {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid transparent;
  background: #2a2a30;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: rgba(107, 124, 255, 0.55);
    transform: translateY(-1px);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &--invalid {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .video-gen-prompt-panel--light & {
    background: #f3f4f6;
  }
}

.video-gen-prompt-panel__ref-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;

  .video-gen-prompt-panel__ref:hover & {
    opacity: 1;
  }

  &:hover {
    background: rgba(239, 68, 68, 0.9);
  }

  .video-gen-prompt-panel--light & {
    background: rgba(17, 24, 39, 0.45);

    &:hover {
      background: rgba(239, 68, 68, 0.9);
    }
  }
}

.video-gen-prompt-panel__ref-badge,
.video-gen-prompt-panel__ref-index {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 10px;
  line-height: 1.3;
}

.video-gen-prompt-panel__ref-index {
  left: auto;
  right: 4px;
  min-width: 16px;
  text-align: center;
  border-radius: 50%;
  padding: 1px 0;
}

.video-gen-prompt-panel__input {
  width: 100%;
  min-height: 52px;
  margin-bottom: 10px;
  padding: 0;
  border: none;
  background: transparent;
  color: #e5e7eb;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  box-sizing: border-box;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;

  &--rich.video-gen-prompt-panel__input--empty::before {
    content: attr(data-placeholder);
    color: #6b7280;
    pointer-events: none;
  }

  :deep(.video-gen-prompt-panel__mention) {
    color: #6b7cff;
    font-weight: 500;
    user-select: all;
    cursor: default;
  }

  .video-gen-prompt-panel--light & {
    color: #111827;

    &--rich.video-gen-prompt-panel__input--empty::before {
      color: #9ca3af;
    }

    :deep(.video-gen-prompt-panel__mention) {
      color: #4f46e5;
    }
  }
}

.video-gen-prompt-panel__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.video-gen-prompt-panel__model-wrap,
.video-gen-prompt-panel__settings-wrap {
  position: relative;
}

.video-gen-prompt-panel__model-menu,
.video-gen-prompt-panel__settings-menu {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  z-index: 10;
}

.video-gen-prompt-panel__chip {
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: #252528;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    background: #2a2a30;
    color: #e5e7eb;
  }

  &--vip {
    color: #c4b5fd;
  }

  &--active {
    background: #2a2a30;
    color: #e5e7eb;
  }

  .video-gen-prompt-panel--light & {
    background: #f3f4f6;
    color: #6b7280;

    &:hover {
      background: #e5e7eb;
      color: #374151;
    }

    &--vip {
      color: #7c3aed;
    }

    &--active {
      background: #e5e7eb;
      color: #111827;
    }
  }
}

.video-gen-prompt-panel__tools {
  display: flex;
  gap: 4px;
}

.video-gen-prompt-panel__tool {
  padding: 4px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #252528;
    color: #e5e7eb;
  }

  .video-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.video-gen-prompt-panel__credits {
  margin-left: auto;
  font-size: 11px;
  color: #6b7280;
  white-space: nowrap;

  .video-gen-prompt-panel--light & {
    color: #9ca3af;
  }
}

.video-gen-prompt-panel__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: #111827;
  color: #fff;
  font-size: 18px;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #1f2937;
  }

  &--disabled,
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .video-gen-prompt-panel--light & {
    background: #111827;
  }
}

.image-dialogue__upload {
  width: 48px;
  height: 48px;
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

.video-gen-prompt-panel__file-input {
  display: none;
}

.video-gen-prompt-panel__drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(20, 20, 24, 0.72);
  backdrop-filter: blur(4px);
  cursor: copy;

  .video-gen-prompt-panel--light & {
    background: rgba(255, 255, 255, 0.88);
  }
}

.video-gen-prompt-panel__drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 120px;
  padding: 20px 12px;
  border: 1px dashed #6b7280;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);

  .video-gen-prompt-panel--light & {
    border-color: #d1d5db;
    background: #f9fafb;
  }
}

.video-gen-prompt-panel__drop-icon {
  width: 28px;
  height: 28px;
}

.video-gen-prompt-panel__drop-text {
  margin: 0;
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.45;
  text-align: center;

  .video-gen-prompt-panel--light & {
    color: #6b7280;
  }
}

.video-gen-prompt-panel--dragover {
  border-color: rgba(107, 124, 255, 0.55);
}
</style>
