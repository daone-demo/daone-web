<template>
  <div
    class="video-gen-prompt-panel"
    :class="{
      'video-gen-prompt-panel--light': isLightTheme,
      'video-gen-prompt-panel--dragover': isDragOver,
    }"
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
        v-for="(ref, index) in displayRefs"
        :key="ref.nodeId"
        class="video-gen-prompt-panel__ref"
        :class="{
          'video-gen-prompt-panel__ref--text': ref.kind === 'text',
          'video-gen-prompt-panel__ref--invalid': validationError,
        }"
        :title="ref.kind === 'text' ? ref.textPreview : `点击插入 @${getRefDisplayName(ref)}`"
        @mousedown.prevent.stop="onRefMouseDown"
        @click.stop="ref.kind === 'text' ? undefined : insertRefMention(ref)"
      >
        <img v-if="ref.kind !== 'text'" :src="ref.previewUrl" alt="" />
        <span class="inline-block" v-else>
          <div class="group relative size-12 flex-none" :title="ref.textPreview">
            <div 
              class="border-hair size-full overflow-hidden rounded-xl border-canvas-controls-border bg-panel-background"
            >
              <div class="flex size-full items-center justify-center bg-neutral-200">
                <svg 
                  xmlns="http://www.w3.org/2000/svg"
                  xmlns:xlink="http://www.w3.org/1999/xlink"
                  aria-hidden="true"
                  role="img"
                  class="iconify iconify--libtv pointer-events-none text-neutral-600"
                  width="14"
                  height="15"
                  viewBox="0 0 16 16"
                >
                  <g transform="translate(1 0.5)">
                    <path d="M9.33 14.62H0v-2.1h9.33zM14 10.44H0v-2.1h14zm0-4.17H0v-2.1h14zm0-4.17H0V0h14z" fill="currentColor"></path>
                  </g>
                </svg>
              </div>
            </div>
            <span class="pointer-events-none absolute left-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-lg bg-black/65 px-1 text-[9px] leading-none text-white backdrop-blur-sm transition-opacity group-hover:opacity-0">{{index+1}}</span>
            <button
              type="button"
              class="absolute right-0.5 top-0.5 z-20 flex size-[15px] items-center justify-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100 border-neutral-300/90 bg-white text-neutral-600 shadow-sm hover:bg-neutral-100"
              title="移除"
              @click.stop="emit('remove-source-ref', ref.nodeId)"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                aria-hidden="true"
                role="img"
                class="iconify iconify--libtv pointer-events-none size-[7px] text-neutral-600"
                width="1em"
                height="1em"
                viewBox="0 0 17.19 17.19"
              >
                <path d="M15.8.12a.4.4 0 0 1 .56 0l.7.7a.4.4 0 0 1 0 .57l-7.2 7.2 7.2 7.2a.4.4 0 0 1 0 .57l-.7.7a.4.4 0 0 1-.56 0l-7.2-7.2-7.2 7.2a.4.4 0 0 1-.57 0l-.71-.7a.4.4 0 0 1 0-.57l7.2-7.2-7.2-7.2a.4.4 0 0 1 0-.57l.7-.7a.4.4 0 0 1 .57 0l7.2 7.2z" fill="currentColor"></path>
              </svg>
            </button>
          </div>
        </span>
        <!-- <span v-else class="video-gen-prompt-panel__text-ref-preview">{{ ref.textPreview }}</span> -->
        <button
          v-if="ref.kind !== 'text'"
          type="button"
          class="video-gen-prompt-panel__ref-remove"
          title="删除"
          @click.stop="emit('remove-source-ref', ref.nodeId)"
        >
          ×
        </button>
        <span v-if="ref.badge" class="video-gen-prompt-panel__ref-badge">{{ ref.badge }}</span>
        <span v-else-if="ref.kind !== 'text'" class="video-gen-prompt-panel__ref-index">{{ ref.index }}</span>
      </div>
      <button
        v-if="showImageUpload"
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

    <div class="video-gen-prompt-panel__input-wrap">
      <MarkTagsEcho
        :marks="elementMarks ?? []"
        @remove="emit('remove-mark', $event)"
        @clear="emit('clear-marks')"
        @open-label-menu="onMarkTagOpenLabelMenu"
      />
      <div
        ref="promptInputRef"
        class="video-gen-prompt-panel__input video-gen-prompt-panel__input--rich"
        :class="{ 'video-gen-prompt-panel__input--empty': !prompt.length }"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :data-placeholder="VIDEO_GEN_PROMPT_PLACEHOLDER"
        @input="onPromptInput"
        @compositionstart="onPromptCompositionStart"
        @compositionend="onPromptCompositionEnd"
        @keydown="onPromptKeydown"
        @paste="onPromptPaste"
        @click="onPromptClick"
        @keyup="capturePromptCaret"
        @mouseup="capturePromptCaret"
        @focus="capturePromptCaret"
        @blur="capturePromptCaret"
      />
      <MarkLabelOptionMenu
        :visible="Boolean(markLabelMenuState)"
        :options="activeMarkOptions"
        :selected-index="activeMarkSelectedIndex"
        :left="markLabelMenuState?.left ?? 0"
        :top="markLabelMenuState?.top ?? 0"
        @select="selectMarkLabelOption"
      />
    </div>

    <div class="video-gen-prompt-panel__footer">
      <div class="video-gen-prompt-panel__model-wrap">
        <button
          type="button"
          class="video-gen-prompt-panel__chip video-gen-prompt-panel__chip--vip"
          :class="{ 'video-gen-prompt-panel__chip--active': showVideoModelPicker }"
          @click.stop="toggleVideoModelPicker"
        >
          {{ selectedModelName }} ▾
        </button>
        <div
          v-if="showVideoModelPicker"
          class="video-gen-prompt-panel__model-menu"
          @mousedown.stop
        >
          <button
            v-for="model in modelMenu"
            :key="model.key"
            type="button"
            class="video-gen-prompt-panel__model-item"
            :class="{ 'video-gen-prompt-panel__model-item--active': model.key === selectedModelKey }"
            @click="selectModel(model)"
          >
            <span
              class="video-gen-prompt-panel__model-item-icon"
              :class="{ 'video-gen-prompt-panel__model-item-icon--font': isDialogueModelIconfont(model.icon) }"
              :data-icon="isDialogueModelIconfont(model.icon) ? undefined : model.icon"
              aria-hidden="true"
            >
              <i
                v-if="isDialogueModelIconfont(model.icon)"
                class="iconfont"
                :class="normalizeDialogueModelIcon(model.icon)"
              />
            </span>
            <span class="video-gen-prompt-panel__model-item-name">{{ model.name }}</span>
          </button>
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
            :model-key="selectedModelKey"
            :chat-tools="chatTools"
            @close="showVideoSettings = false"
          />
        </div>
      </div>
      <a-tooltip>
        <template #title>标记</template>
        <button
          type="button"
          class="video-gen-prompt-panel__tool"
          :class="{ 'video-gen-prompt-panel__tool--active': elementSelectMode }"
          title="标记"
          @mousedown.stop
          @click.stop="emit('quick-action', 'mark')"
        >
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
      <a-tooltip v-if="showCanvasPick">
        <template #title>从画布选图</template>
        <button
          type="button"
          class="canvas-dialogue-tool"
          :class="{ 'canvas-dialogue-tool--active': canvasPickMode }"
          title="从画布选图"
          @mousedown.stop
          @click.stop="emit('toggle-canvas-pick')"
        >
          <i class="iconfont icon-shubiaoxuanze" />
        </button>
      </a-tooltip>
      <span class="video-gen-prompt-panel__tools">
        <button
          type="button"
          class="video-gen-prompt-panel__tool"
          :class="{ 'video-gen-prompt-panel__tool--loading': translating }"
          :title="translating ? '翻译中' : '翻译'"
          :disabled="translating"
          @mousedown.stop
          @click.stop="onTranslatePrompt"
        >
          <span v-if="translating" class="video-gen-prompt-panel__translate-label">翻译中...</span>
          <i v-else class="iconfont icon-fanyi" style="font-size: 16px;color: #000000;"></i>
        </button>
      </span>
      <a-select
        :value="videoNum"
        class="video-gen-prompt-panel__count-select"
        @update:value="onVideoNumChange"
      >
        <a-select-option
          v-for="count in countOptions"
          :key="count"
          :value="count"
        >
          {{ count }}个
        </a-select-option>
      </a-select>
      <span class="video-gen-prompt-panel__credits">
        <!-- ⚡ 22 -->
      </span>
      <button
        type="button"
        class="video-gen-prompt-panel__send"
        :class="{ 'video-gen-prompt-panel__send--disabled': Boolean(validationError) }"
        :disabled="Boolean(validationError)"
        title="生成"
        @click="onSend"
      >
        ↑
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useCanvasBgTheme } from './useCanvasBgTheme'
import { useCanvasImageDropUpload } from './composables/useCanvasImageDropUpload'
import { usePromptTranslate } from './composables/usePromptTranslate'
import {
  buildMarkMentionThumbStyle,
  createPromptMentionApi,
  isInputComposing,
  needsSpaceBeforeMention,
  parseImageMarkMentionToken,
  type PromptMarkMentionMeta,
} from './promptMention'
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import MarkLabelOptionMenu from './MarkLabelOptionMenu.vue'
import MarkTagsEcho from './MarkTagsEcho.vue'
import { getMarkLabelOptions, hasMultipleMarkLabels, useImageMarkLabelMenu } from './useImageMarkLabelMenu'
import {
  VIDEO_GEN_PROMPT_PLACEHOLDER,
  VIDEO_DIALOGUE_MODEL_MENU,
  VIDEO_GEN_DURATIONS,
  buildVideoDialogueCountOptionsFromCapabilities,
  buildVideoDialogueModelsFromCapabilities,
  buildVideoGenTabsForModel,
  formatVideoGenSettings,
  isDialogueModelIconfont,
  normalizeDialogueModelIcon,
  normalizeVideoDialogueSettingsForModel,
  resolveVideoDialogueModelApiValue,
  resolveVideoGenTabForModel,
  type ChatTools,
  type VideoDialogueModelItem,
  type VideoDialogueSettings,
  type VideoGenAspectRatio,
  type VideoGenDuration,
  type VideoGenResolution,
  type VideoGenPromptSubmitPayload,
  resolveVideoGenApiMode,
  type ImageMarkItem,
} from './constants'
import { getVideoGenTabValidation } from './videoGen'
import type { VideoSourceRef } from './videoGen'


const { isLightTheme } = useCanvasBgTheme()

const props = defineProps<{
  videoNum: number
  prompt: string
  activeTab: string
  aspectRatio?: VideoGenAspectRatio
  sourceRefs?: VideoSourceRef[]
  elementMarks?: ImageMarkItem[]
  savedSettings?: Partial<VideoDialogueSettings> | null
  elementSelectMode?: boolean
  canvasPickMode?: boolean
  mentionInsertSerial?: number
  mentionInsertToken?: string
  resolveMarkPreviewUrl?: (mark: ImageMarkItem) => string
  chatTools?: ChatTools | null
}>()

const emit = defineEmits<{
  'update:videoNum': [value: number]
  'update:prompt': [value: string]
  'update:activeTab': [value: string]
  'update:aspectRatio': [value: VideoGenAspectRatio]
  'quick-action': [key: string]
  'remove-source-ref': [nodeId: string]
  'upload-images': [files: File[]]
  'add-canvas-node': [nodeId: string]
  'toggle-canvas-pick': []
  'mention-inserted': []
  'select-mark-label': [markId: string, index: number]
  'remove-mark': [markId: string]
  'clear-marks': []
  submit: [payload: VideoGenPromptSubmitPayload]
}>()

function onVideoNumChange(value: unknown) {
  if (value === undefined || value === null) return
  emit('update:videoNum', Number(value))
}

const imageSourceCount = computed(
  () => (props.sourceRefs ?? []).filter((ref) => ref.kind !== 'text' && ref.previewUrl).length,
)

const textSourceCount = computed(
  () => (props.sourceRefs ?? []).filter((ref) => ref.kind === 'text').length,
)

const showVideoModelPicker = ref(false)
const showVideoSettings = ref(false)
const selectedModelKey = ref(VIDEO_DIALOGUE_MODEL_MENU[0].key)
const videoDuration = ref<VideoGenDuration>(VIDEO_GEN_DURATIONS[0])
const videoAspectRatio = computed({
  get: () => props.aspectRatio ?? '16:9',
  set: (value: VideoGenAspectRatio) => emit('update:aspectRatio', value),
})
const videoResolution = ref<VideoGenResolution>('480P')
const generateAudio = ref(true)

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

/** 按当前模型 modes 展示 tabs；再叠加图片数量禁用规则 */
const videoGenTabs = computed(() => {
  const imageCount = imageSourceCount.value
  return buildVideoGenTabsForModel(props.chatTools, selectedModelKey.value).map((item) => {
    const next = { ...item }
    if (next.key === 'text2video') {
      next.disabled = imageCount > 0
      next.disabledHint = imageCount > 0 ? '已接入媒体输入,无法使用纯文生视频' : ''
    }
    if (next.key === 'img2video') {
      next.disabledHint = `当前图片数量 ${imageCount} 个，需要1个`
      next.disabled = imageCount > 1
    }
    if (next.key === 'frames') {
      next.disabledHint = `当前图片数量 ${imageCount} 个，需要1~2个`
      next.disabled = imageCount > 2
    }
    return next
  })
})

function ensureActiveTabSupportedByModel(modelKey = selectedModelKey.value) {
  const nextTab = resolveVideoGenTabForModel(props.activeTab, props.chatTools, modelKey)
  if (nextTab !== props.activeTab) {
    emit('update:activeTab', nextTab)
  }
}

function syncActiveTabBySourceCount() {
  const imageCount = imageSourceCount.value
  const active = props.activeTab
  if (imageCount > 0 && active === 'text2video') {
    emit('update:activeTab', resolveVideoGenTabForModel('reference', props.chatTools, selectedModelKey.value))
    return
  }
  if (imageCount > 1 && active === 'img2video') {
    emit('update:activeTab', resolveVideoGenTabForModel('reference', props.chatTools, selectedModelKey.value))
    return
  }
  if (imageCount > 2 && active === 'frames') {
    emit('update:activeTab', resolveVideoGenTabForModel('reference', props.chatTools, selectedModelKey.value))
  }
}

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
      videoCount: props.videoNum,
      mode: resolveVideoGenApiMode(props.activeTab),
      ...partial,
    },
    props.chatTools,
  )
  selectedModelKey.value = normalized.modelKey
  videoAspectRatio.value = normalized.aspectRatio
  videoResolution.value = normalized.resolution
  videoDuration.value = normalized.duration
  generateAudio.value = normalized.generateAudio
  if (normalized.videoCount !== props.videoNum) {
    emit('update:videoNum', normalized.videoCount)
  }
}

function syncToolbarDefaultsFromChatTools() {
  applyNormalizedToolbarSettings()
}

function applySavedSettings(saved?: Partial<VideoDialogueSettings> | null) {
  if (!saved) return
  applyNormalizedToolbarSettings(saved)
}

watch(
  () => props.chatTools,
  () => {
    syncToolbarDefaultsFromChatTools()
  },
  { immediate: true, deep: true },
)

watch(
  () => selectedModelKey.value,
  () => {
    applyNormalizedToolbarSettings()
  },
)

watch(
  () => props.savedSettings,
  (saved) => {
    applySavedSettings(saved)
  },
  { immediate: true, deep: true },
)

const videoSettingsLabel = computed(() =>
  formatVideoGenSettings(videoDuration.value, videoAspectRatio.value, videoResolution.value),
)

function selectModel(model: VideoDialogueModelItem) {
  selectedModelKey.value = model.key
  showVideoModelPicker.value = false
  // 新模型不支持当前模式（如首尾帧）时，回退到全能参考
  ensureActiveTabSupportedByModel(model.key)
}

function toggleVideoModelPicker() {
  showVideoModelPicker.value = !showVideoModelPicker.value
  if (showVideoModelPicker.value) showVideoSettings.value = false
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

watch([imageSourceCount, textSourceCount], syncActiveTabBySourceCount, { immediate: true })

watch(
  [() => props.chatTools, selectedModelKey],
  () => {
    ensureActiveTabSupportedByModel()
  },
  { deep: true },
)

const validationHint = computed(() =>
  getVideoGenTabValidation(props.activeTab, imageSourceCount.value),
)

const validationError = computed(() => {
  const hint = validationHint.value
  if (!hint) return false
  return imageSourceCount.value > 0
})

const showSourceRefs = computed(() => props.activeTab !== 'text2video')

/** 首尾帧最多 2 张；满员后隐藏上传/从画布选图，不影响全能参考等其它模式 */
const canAddMoreImages = computed(() => {
  if (props.activeTab === 'frames') {
    return imageSourceCount.value < 2
  }
  return true
})

const showImageUpload = computed(
  () => props.activeTab !== 'text2video' && canAddMoreImages.value,
)

const showCanvasPick = computed(() => canAddMoreImages.value)

/** 首尾帧已满时若仍处于画布选图模式，自动退出，避免入口隐藏后仍可点选 */
watch(canAddMoreImages, (canAdd) => {
  if (!canAdd && props.canvasPickMode) {
    emit('toggle-canvas-pick')
  }
})

const fileInputRef = ref<HTMLInputElement | null>(null)
const {
  isDragOver,
  onDragEnter: onPanelDragEnter,
  onDragOver: onPanelDragOver,
  onDragLeave: onPanelDragLeave,
  onDrop: onPanelDrop,
  openFilePicker,
  onFileInputChange,
} = useCanvasImageDropUpload({
  fileInputRef,
  canAccept: () => showSourceRefs.value && canAddMoreImages.value,
  onAddCanvasNode: (nodeId) => emit('add-canvas-node', nodeId),
  onUploadImages: (files) => emit('upload-images', files),
})

const displayRefs = computed(() => {
  const refs = (props.sourceRefs ?? []).filter((ref) => {
    if (props.activeTab === 'text2video') return ref.kind === 'text'
    return ref.kind !== 'text' && Boolean(ref.previewUrl)
  })
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
  const tab = videoGenTabs.value.find((item) => item.key === key)
  if (tab?.disabled) return
  emit('update:activeTab', key)
}

const promptInputRef = ref<HTMLElement | null>(null)
let skipPromptWatch = false
const isPromptComposing = ref(false)
const { translating, onTranslatePrompt } = usePromptTranslate({
  getText: () => props.prompt,
  onTranslated: (translated) => {
    emitPrompt(translated)
    nextTick(() => syncPromptView(translated))
  },
})
/** 点击缩略图插入前缓存光标，避免 mousedown 抢焦点导致插入到末尾 */
let savedPromptCaret = { start: 0, end: 0 }

function getRefDisplayName(ref: VideoSourceRef) {
  if (ref.kind === 'text') {
    return ref.textPreview || ref.title || `文本${ref.index}`
  }
  return `图片${ref.index}`
}

function capturePromptCaret() {
  const el = promptInputRef.value
  if (!el) return
  const offsets = mentionApi.getSelectionPlainOffsets(el)
  if (!offsets) return
  savedPromptCaret = offsets
}

function onRefMouseDown() {
  // 先记下当前光标，再 preventDefault 保住输入框焦点
  capturePromptCaret()
}

function emitPrompt(text: string) {
  skipPromptWatch = true
  emit('update:prompt', text)
  nextTick(() => {
    skipPromptWatch = false
  })
}

function resolveMarkPreviewUrl(mark: ImageMarkItem) {
  const resolved = props.resolveMarkPreviewUrl?.(mark)
  if (resolved) return resolved
  const ref = props.sourceRefs?.find((item) => item.nodeId === mark.sourceNodeId)
  return ref?.previewUrl || ''
}

function formatMarkDisplayLabel(mark: ImageMarkItem) {
  const marks = props.elementMarks ?? []
  const index = marks.findIndex((item) => item.id === mark.id)
  const order = index >= 0 ? index + 1 : marks.length + 1
  const label = mark.pending ? '识别中' : mark.label
  return `${order}. ${label}`
}

function getMarkThumbStyle(mark: ImageMarkItem) {
  const thumbUrl = resolveMarkPreviewUrl(mark)
  return buildMarkMentionThumbStyle({
    thumbUrl,
    imageWidth: mark.imageWidth,
    imageHeight: mark.imageHeight,
    bbox: mark.bbox,
  })
}

function resolveMarkMentionMeta(token: string): PromptMarkMentionMeta | null {
  const parsed = parseImageMarkMentionToken(token)
  if (!parsed) return null

  const mark = (props.elementMarks ?? []).find((item) =>
    item.mentionToken === token
    || (parsed.markId && item.id === parsed.markId)
    || (parsed.label && item.label === parsed.label),
  )

  const labelOptions = mark ? getMarkLabelOptions(mark) : (parsed.label ? [parsed.label] : [])
  const label = mark ? formatMarkDisplayLabel(mark) : (parsed.label ? parsed.label : token)
  if (!mark) {
    return {
      label,
      markId: parsed.markId || undefined,
      labelOptions,
      switchable: labelOptions.length > 1,
    }
  }

  return {
    label,
    markId: mark.id,
    labelOptions,
    selectedLabelIndex: mark.selectedLabelIndex ?? 0,
    switchable: hasMultipleMarkLabels(mark),
    thumbStyle: getMarkThumbStyle(mark),
  }
}

const {
  menu: markLabelMenuState,
  activeMarkOptions,
  activeMarkSelectedIndex,
  openMenuForMark,
  openMenuFromMention,
  selectOption: selectMarkLabelOption,
  bindDocumentClose: bindMarkLabelMenuDocumentClose,
  unbindDocumentClose: unbindMarkLabelMenuDocumentClose,
} = useImageMarkLabelMenu({
  getMarks: () => props.elementMarks,
  onSelectLabel: (markId, index) => emit('select-mark-label', markId, index),
  onAfterSelect: () => nextTick(() => syncPromptView()),
})

function onMarkTagOpenLabelMenu(markId: string, anchor: HTMLElement) {
  const container = promptInputRef.value?.parentElement
  if (!container) return
  openMenuForMark(markId, anchor, container)
}

const mentionApi = createPromptMentionApi('video-gen-prompt-panel__mention', {
  resolveMention: resolveMarkMentionMeta,
})

function syncPromptView(text = props.prompt) {
  if (isPromptComposing.value) return
  const el = promptInputRef.value
  if (!el) return

  const offsets = mentionApi.getSelectionPlainOffsets(el)
  const start = offsets?.start ?? text.length
  const end = offsets?.end ?? start

  mentionApi.renderPromptToEl(el, text)
  mentionApi.setPlainTextSelection(el, start, end)
  savedPromptCaret = { start, end }
}

function needsSpaceBefore(range: Range, root: HTMLElement): boolean {
  return needsSpaceBeforeMention(range, root, mentionApi.isMentionEl)
}

function insertMentionToken(token: string) {
  if (!token) return
  const el = promptInputRef.value
  if (!el) {
    const current = props.prompt
    const needsSpace = current.length > 0 && !/[\s]$/.test(current)
    emitPrompt(`${current}${needsSpace ? ' ' : ''}${token} `)
    return
  }

  el.focus()
  const sel = window.getSelection()
  if (!sel) {
    emitPrompt(`${props.prompt}${props.prompt && !/[\s]$/.test(props.prompt) ? ' ' : ''}${token} `)
    nextTick(() => syncPromptView())
    return
  }

  // 选区不在输入框内（点缩略图丢焦点）时，恢复到点击前光标位置
  const live = mentionApi.getSelectionPlainOffsets(el)
  if (!live) {
    mentionApi.setPlainTextSelection(el, savedPromptCaret.start, savedPromptCaret.end)
  }

  if (!sel.rangeCount) {
    mentionApi.setPlainTextSelection(el, savedPromptCaret.start, savedPromptCaret.end)
  }

  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) {
    mentionApi.setPlainTextSelection(el, savedPromptCaret.start, savedPromptCaret.end)
  }

  const insertRange = sel.getRangeAt(0)
  insertRange.deleteContents()

  if (needsSpaceBefore(insertRange, el)) {
    insertRange.insertNode(document.createTextNode(' '))
    insertRange.collapse(false)
  }

  const mention = mentionApi.createMentionSpan(token)
  insertRange.insertNode(mention)
  const space = document.createTextNode(' ')
  mention.after(space)

  const nextRange = document.createRange()
  nextRange.setStartAfter(space)
  nextRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(nextRange)

  const nextText = mentionApi.serializePromptEl(el)
  const nextOffsets = mentionApi.getSelectionPlainOffsets(el)
  if (nextOffsets) savedPromptCaret = nextOffsets

  emitPrompt(nextText)
  // 已手工插入 mention 节点，无需整段重绘以免光标跳动
}

function insertRefMention(ref: VideoSourceRef) {
  insertMentionToken(`@${getRefDisplayName(ref)}`)
}

function stripMarkMentionsFromPrompt() {
  const marks = props.elementMarks ?? []
  let text = props.prompt
  for (const mark of marks) {
    const tokens = [mark.mentionToken, `@标记#${mark.id}`].filter(Boolean)
    for (const token of tokens) {
      text = text.split(token).join('')
    }
  }
  text = text.replace(/@标记#[^\s@]+(?:：[^\s@]+)?/g, '').replace(/\s{2,}/g, ' ').trim()
  if (text === props.prompt) return
  emitPrompt(text)
  nextTick(() => syncPromptView(text))
}

function onPromptClick(event: MouseEvent) {
  const el = promptInputRef.value
  if (!el) return
  const mention = (event.target as HTMLElement).closest('.video-gen-prompt-panel__mention--mark-switchable') as HTMLElement | null
  if (!mention) return
  event.preventDefault()
  event.stopPropagation()
  openMenuFromMention(mention, el.parentElement ?? el)
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
  capturePromptCaret()
  emitPrompt(text)
  if (isPromptComposing.value || isInputComposing(event)) return
  // 仅当纯文本里出现未转成 chip 的 @图片/@标记 时才重绘，避免输入时光标乱跳
  if (!mentionApi.needsMentionRerender(el)) return
  nextTick(() => syncPromptView(text))
}

function onPromptKeydown(event: KeyboardEvent) {
  if (isPromptComposing.value || isInputComposing(event)) return

  if (event.key !== 'Backspace' && event.key !== 'Delete') return

  const el = promptInputRef.value
  if (!el) return

  const sel = window.getSelection()
  if (!sel?.rangeCount) return

  // 框选多个 @图片 / 文本后删除
  if (!sel.isCollapsed) {
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return
    event.preventDefault()
    range.deleteContents()
    const text = mentionApi.serializePromptEl(el)
    const offsets = mentionApi.getSelectionPlainOffsets(el)
    if (offsets) savedPromptCaret = offsets
    emitPrompt(text)
    nextTick(() => syncPromptView(text))
    return
  }

  const mention = event.key === 'Backspace'
    ? mentionApi.findMentionBeforeCursor()
    : mentionApi.findMentionAfterCursor()

  if (!mention) return

  event.preventDefault()
  mention.remove()
  const text = mentionApi.serializePromptEl(el)
  capturePromptCaret()
  emitPrompt(text)
  nextTick(() => syncPromptView(text))
}

function onPromptPaste(event: ClipboardEvent) {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  document.execCommand('insertText', false, text)
  onPromptInput()
}

function onSend() {
  if (validationError.value) return
  const prompt = props.prompt.trim()
  if (!prompt) {
    message.warning('请输入提示词')
    return
  }

  const payload: VideoGenPromptSubmitPayload = {
    prompt,
    model: resolveVideoDialogueModelApiValue(selectedModelKey.value, props.chatTools),
    ratio: videoAspectRatio.value,
    clarity: videoResolution.value,
    duration: videoDuration.value,
    generateAudio: generateAudio.value,
    videoCount: props.videoNum,
    mode: resolveVideoGenApiMode(props.activeTab),
    tab: props.activeTab,
  }
  emit('submit', payload)
}

watch(
  () => props.prompt,
  (value) => {
    if (skipPromptWatch || isPromptComposing.value) return
    const el = promptInputRef.value
    if (!el || mentionApi.serializePromptEl(el) === value) return
    nextTick(() => syncPromptView(value))
  },
)

watch(
  () => props.elementMarks?.map((mark) => `${mark.id}:${mark.pending ? 1 : 0}:${mark.selectedLabelIndex ?? 0}:${mark.label}`).join('|') ?? '',
  () => {
    nextTick(() => stripMarkMentionsFromPrompt())
  },
)

onMounted(() => {
  bindMarkLabelMenuDocumentClose()
  nextTick(() => {
    syncPromptView()
    stripMarkMentionsFromPrompt()
  })
})

onBeforeUnmount(() => {
  unbindMarkLabelMenuDocumentClose()
})
</script>

<style scoped lang="scss">
@use './promptMention.scss' as *;
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
    // border-color: rgba(107, 124, 255, 0.55);
    transform: translateY(-1px);
    .video-gen-prompt-panel__ref-remove {
      opacity: 1;
    }
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
    background: transparent
  }
}

.video-gen-prompt-panel__ref--text {
  width: auto;
  min-width: 72px;
  max-width: 180px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: default;
}

.video-gen-prompt-panel__text-ref-preview {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 32px;
  color: #d1d5db;

  .video-gen-prompt-panel--light & {
    color: #374151;
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

  // .video-gen-prompt-panel__ref:hover & {
  //   opacity: 1;
  // }

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

.video-gen-prompt-panel__input-wrap {
  position: relative;
  margin-bottom: 10px;
  // border: 1px solid #3d3d45;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;

  .video-gen-prompt-panel--light & {
    // border-color: #e5e7eb;
    background: #fff;
  }
}

.video-gen-prompt-panel__input {
  width: 100%;
  min-height: 52px;
  margin-bottom: 0;
  padding: 0 10px 8px;
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

  @include prompt-mark-mention-pill('video-gen-prompt-panel__mention');

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

.video-gen-prompt-panel__model-menu {
  min-width: 220px;
  max-width: 300px;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid #4b4b55;
  border-radius: 12px;
  background: #1e1e22;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);

  .video-gen-prompt-panel--light & {
    border-color: #ebedf0;
    background: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
  }
}

.video-gen-prompt-panel__model-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: #2a2a30;
  }

  .video-gen-prompt-panel--light & {
    &:hover,
    &--active {
      background: #f3f4f6;
    }
  }
}

.video-gen-prompt-panel__model-item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: #2a2a30;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 16px 16px;

  &[data-icon='lib'],
  &[data-icon='seedream'],
  &[data-icon='seedance'],
  &[data-icon='kling'],
  &[data-icon='happy-horse'],
  &[data-icon='wan'] {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 18 18'%3E%3Cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3' d='M4 13V8M9 13V5M14 13v-3'/%3E%3C/svg%3E");
  }

  .video-gen-prompt-panel--light & {
    background-color: #f3f4f6;
  }

  &--font {
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: none;

    .iconfont {
      font-size: 16px;
      line-height: 1;
      color: #9ca3af;
    }
  }

  .video-gen-prompt-panel--light &--font .iconfont {
    color: #6b7280;
  }
}

.video-gen-prompt-panel__model-item-name {
  flex: 1;
  min-width: 0;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.3;
  word-break: break-all;

  .video-gen-prompt-panel--light & {
    color: #374151;
  }
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

  &:hover:not(:disabled) {
    background: #252528;
    color: #e5e7eb;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &--loading {
    opacity: 0.55;
    width: auto;
    min-width: 28px;
    padding: 0 6px;
    cursor: not-allowed;
  }

  &--active {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
  }

  .video-gen-prompt-panel--light & {
    color: #6b7280;

    &:hover:not(:disabled) {
      background: #f3f4f6;
      color: #374151;
    }
  }
}

.video-gen-prompt-panel__translate-label {
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  color: #9ca3af;

  .video-gen-prompt-panel--light & {
    color: #6b7280;
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
.inline-block {
    display: inline-block;
}
.size-12 {
    width: 48px;
    height: 48px;
}
.relative {
    position: relative;
}
.flex-none {
    flex: 0 0 auto;
}
.bg-panel-background, .bg-panel-background\/92 {
    background-color: #ffffff;
}
.border-canvas-controls-border, .border-canvas-controls-border\/60 {
    border-color: #0000000f;
}
.border-hair {
    border-width: 0.5px;
}
.rounded-xl {
    border-radius: 12px;
}
.overflow-hidden {
    overflow: hidden;
}
.size-full {
    width: 100%;
    height: 100%;
}
.bg-neutral-200 {
    background-color: rgb(229, 230, 236);
}
.justify-center {
    justify-content: center;
}
.items-center {
    align-items: center;
}
.size-full {
    width: 100%;
    height: 100%;
}
.flex {
    display: flex;
}
.transition-opacity {
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0,0,.2,1), cubic-bezier(.4,0,.2,1);
    transition-duration: 0.15s, 0.15s;
}
.backdrop-blur-sm {
    --tw-backdrop-blur: blur(8px);
}
.text-white {
    color: rgb(255, 255, 255);
}
.leading-none {
    --tw-leading: 1;
    line-height: 1;
}
.text-\[9px\] {
    font-size: 9px;
}
.px-1 {
    padding-inline: 4px;
}
.bg-black\/65 {
    background-color: lab(0 0 0 / 0.65);
}
.rounded-lg {
    border-radius: 8px;
}
.justify-center {
    justify-content: center;
}
.items-center {
    align-items: center;
}
.flex {
    display: flex;
}
.left-1 {
    left: 4px;
}
.top-1 {
    top: 4px;
}
.absolute {
    position: absolute;
}
.pointer-events-none {
    pointer-events: none;
}


.image-dialogue__icon-glyph {
  width: 16px;
  height: 16px;

  &[data-icon='translate'] {
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 16 16'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='M2.5 4h5M5 2.5v1.5M6.5 4c-.4 2.6-2 4.6-4 5.5M3.5 6.5c.6 1.4 1.8 2.4 3.2 2.9'/%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.2' d='m8.2 13 2.4-6h.4l2.4 6M9 11h3.6'/%3E%3C/svg%3E") center / 16px 16px no-repeat;
  }
}
</style>
