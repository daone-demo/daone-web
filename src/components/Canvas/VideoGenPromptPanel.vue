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
  createPromptMentionApi,
  isInputComposing,
  needsSpaceBeforeMention,
} from './promptMention'
import { resolveMarkMentionMeta } from './composables/usePromptMarkMentions'
import VideoGenSettingsPopover from './VideoGenSettingsPopover.vue'
import MarkLabelOptionMenu from './MarkLabelOptionMenu.vue'
import MarkTagsEcho from './MarkTagsEcho.vue'
import { useImageMarkLabelMenu } from './useImageMarkLabelMenu'
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

function resolveMarkMentionMetaForPrompt(token: string) {
  return resolveMarkMentionMeta(token, {
    marks: props.elementMarks ?? [],
    resolvePreviewUrl: resolveMarkPreviewUrl,
  })
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
  resolveMention: resolveMarkMentionMetaForPrompt,
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

<style scoped lang="scss" src="./VideoGenPromptPanel.scss"></style>
