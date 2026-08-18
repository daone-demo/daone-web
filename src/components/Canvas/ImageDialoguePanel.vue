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
    <div v-if="!hideWorkflowAndMark" class="image-dialogue__workflow-row">
      <DialogueWorkflowSelect
        :model-value="selectedWorkFlow || undefined"
        :groups="workflowOptionGroups"
        placeholder="选择工作流"
        :light="isLightTheme"
        :disabled="workflowDisabled"
        @update:model-value="onWorkflowChange"
        @select-digital-human="onDigitalHumanSelect"
      />
      <!-- <button type="button" class="image-dialogue__expand" title="展开">
        <span class="image-dialogue__expand-icon" aria-hidden="true" />
      </button> -->
    </div>

    <div class="image-dialogue__head">
      <div class="image-dialogue__thumbs">
        <div
          v-for="(item, index) in previewList"
          :key="item.key"
          class="image-dialogue__thumb"
          :title="`点击插入 @图片${index + 1}`"
          @mousedown.prevent.stop="onRefMouseDown"
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

    <div class="image-dialogue__input-wrap">
      <MarkTagsEcho
        v-if="!hideWorkflowAndMark"
        :marks="elementMarks ?? []"
        @remove="emit('remove-mark', $event)"
        @clear="emit('clear-marks')"
        @open-label-menu="onMarkTagOpenLabelMenu"
      />
      <div
        ref="promptInputRef"
        class="image-dialogue__input image-dialogue__input--rich"
        :class="{ 'image-dialogue__input--empty': !modelValue.length }"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :data-placeholder="IMAGE_DIALOGUE_PLACEHOLDER"
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

    <div class="image-dialogue__footer">
      <div class="image-dialogue__footer-left">
        <div class="image-dialogue__model-wrap">
          <button
            type="button"
            class="image-dialogue__model"
            :class="{ 'image-dialogue__model--active': showModelMenu }"
            @click="toggleModelMenu"
          >
            <span
              class="image-dialogue__model-icon"
              :class="{ 'image-dialogue__model-icon--font': isDialogueModelIconfont(selectedModelIcon) }"
              :data-icon="isDialogueModelIconfont(selectedModelIcon) ? undefined : selectedModelIcon"
              aria-hidden="true"
            >
              <i
                v-if="isDialogueModelIconfont(selectedModelIcon)"
                class="iconfont"
                :class="normalizeDialogueModelIcon(selectedModelIcon)"
              />
            </span>
            {{ selectedModelName }}
            <span class="image-dialogue__model-caret" aria-hidden="true" />
          </button>
          <div
            v-if="showModelMenu"
            class="image-dialogue__model-menu"
            @mousedown.stop
          >
            <button
              v-for="model in modelMenu"
              :key="model.key"
              type="button"
              class="image-dialogue__model-item"
              :class="{ 'image-dialogue__model-item--active': model.key === selectedModelKey }"
              @click="selectModel(model)"
            >
              <span
                class="image-dialogue__model-item-icon"
                :class="{ 'image-dialogue__model-item-icon--font': isDialogueModelIconfont(model.icon) }"
                :data-icon="isDialogueModelIconfont(model.icon) ? undefined : model.icon"
                aria-hidden="true"
              >
                <i
                  v-if="isDialogueModelIconfont(model.icon)"
                  class="iconfont"
                  :class="normalizeDialogueModelIcon(model.icon)"
                />
              </span>
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
            <!-- <span class="image-dialogue__pill-icon" data-icon="frame" aria-hidden="true" /> -->
            <i class="iconfont icon-ic_suodingkuangaobi" style="font-size: 16px;"></i>
            {{ qualityLabel }}
            <span class="image-dialogue__select-arrow" aria-hidden="true" />
          </button>
          <div
            v-if="showGenSettings"
            class="image-dialogue__gen-settings-menu"
            @mousedown.stop
          >
            <ImageGenSettingsPopover
              v-model:aspect-ratio="genAspectRatio"
              v-model:resolution="genResolution"
              v-model:image-count="genImageCount"
              :chat-tools="chatTools"
              :model-key="selectedModelKey"
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
        <a-tooltip v-if="!hideWorkflowAndMark">
          <template #title>标记</template>
          <button
            type="button"
            class="video-gen-prompt-panel__tool"
            :class="{ 'video-gen-prompt-panel__tool--active': elementSelectMode }"
            title="标记"
            @mousedown.stop
            @click.stop="onToggleMark"
          >
            <i class="iconfont icon-biaoji" style="font-size: 16px;"></i>
          </button>
        </a-tooltip>
        <a-tooltip>
          <template #title>从画布选图</template>
          <button
            type="button"
            class="canvas-dialogue-tool"
            :class="{ 'canvas-dialogue-tool--active': canvasPickMode }"
            title="从画布选图"
            @mousedown.stop
            @click.stop="emit('toggle-canvas-pick')"
          >
            <i class="iconfont icon-shubiaoxuanze" style="font-size: 16px;"></i>
          </button>
        </a-tooltip>
        <button
          type="button"
          class="image-dialogue__icon"
          :class="{ 'image-dialogue__icon--loading': translating }"
          :title="translating ? '翻译中' : '翻译'"
          :disabled="translating"
          @mousedown.stop
          @click.stop="onTranslatePrompt"
        >
          <span v-if="translating" class="image-dialogue__translate-label">翻译中...</span>
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
        <span class="image-dialogue__credits">
          <i class="iconfont icon-huiyuanjifen" style="font-size: 14px;color: rgb(255, 198, 0);"></i>
          &nbsp;{{ estimatedCreditsLabel }}
        </span>
        <a-popover placement="top">
          <template #content>
            <span>发送</span>
          </template>
          <button
            type="button"
            class="image-dialogue__send"
            @mousedown.stop
            @click.stop="onSend"
          >
            <span class="image-dialogue__send-icon" aria-hidden="true" />
          </button>
        </a-popover>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useCanvasBgTheme } from './useCanvasBgTheme';
import { useCanvasImageDropUpload } from './composables/useCanvasImageDropUpload';
import { usePromptTranslate } from './composables/usePromptTranslate';
import { useImageDialoguePointEstimate } from './composables/useImageDialoguePointEstimate'
import ImageGenSettingsPopover from './ImageGenSettingsPopover.vue';
import ImageStylePanel from './ImageStylePanel.vue';
import DialogueWorkflowSelect from './DialogueWorkflowSelect.vue';
import type { DigitalHumanPickerItem } from './DigitalHumanPickerPanel.vue';
import MarkLabelOptionMenu from './MarkLabelOptionMenu.vue'
import MarkTagsEcho from './MarkTagsEcho.vue';
import { useImageMarkLabelMenu } from './useImageMarkLabelMenu';
import { canSubmitImageDialogueTask, hasCompletedImageMarks } from './imageMarkUtils';
import {
  buildPromptWithMentionInsert,
  createPromptMentionApi,
  isInputComposing,
} from './promptMention';
import { resolveMarkMentionMeta } from './composables/usePromptMarkMentions';
import {
  IMAGE_DIALOGUE_PLACEHOLDER,
  IMAGE_DIALOGUE_MODEL_MENU,
  buildImageDialogueModelsFromCapabilities,
  buildImageWorkflowOptionGroups,
  buildImageWorkflowOptions,
  isDialogueModelIconfont,
  isMyModelWorkflow,
  normalizeDialogueModelIcon,
  normalizeImageDialogueSettingsForModel,
  pickImageDialogueSettingsInput,
  resolveImageDialogueModelApiValue,
  resolveImageDialogueModelKey,
  type ChatTools,
  type ImageDialogueModelItem,
  type ImageDialogueSettings,
  type ImageDialogueSubmitPayload,
  type ImageSourceRef,
  type ImageMarkItem,
  type ImageStyleCard,
  type WorkflowCategoryGroup,
} from './constants';

const props = defineProps<{
  modelValue: string
  settings: ImageDialogueSettings
  previewUrl?: string
  previews?: ImageSourceRef[]
  workflowDisabled?: boolean
  canvasPickMode?: boolean
  elementSelectMode?: boolean
  elementMarks?: ImageMarkItem[]
  mentionInsertSerial?: number
  mentionInsertToken?: string
  resolveMarkPreviewUrl?: (mark: ImageMarkItem) => string
  chatTools?: ChatTools | null
  workflows: WorkflowCategoryGroup[]
  /** 待生成占位节点：隐藏工作流选择与标记入口 */
  hideWorkflowAndMark?: boolean
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:settings': [value: ImageDialogueSettings]
  remove: [sourceNodeId?: string]
  'upload-images': [files: File[]]
  'add-canvas-node': [nodeId: string]
  'toggle-canvas-pick': []
  'toggle-mark': [options?: { coordinateOnly?: boolean }]
  'add-digital-human-ref': [payload: { assetId: string; previewUrl: string }]
  'mention-inserted': []
  'select-mark-label': [markId: string, index: number]
  'remove-mark': [markId: string]
  'clear-marks': []
  submit: [payload: ImageDialogueSubmitPayload]
}>()

const { isLightTheme } = useCanvasBgTheme()
const promptInputRef = ref<HTMLElement | null>(null)
let skipPromptWatch = false
const isPromptComposing = ref(false)
/** 点击缩略图插入前缓存光标，避免抢焦点导致插入到末尾 */
let savedPromptCaret = { start: 0, end: 0 }
let hasSavedPromptCaret = false
/** 程序化 focus/重绘期间禁止覆盖已缓存的插入光标 */
let suppressCaretCapture = false

function capturePromptCaret() {
  if (suppressCaretCapture) return
  const el = promptInputRef.value
  if (!el) return
  const offsets = mentionApi.getSelectionPlainOffsets(el)
  if (!offsets) return
  savedPromptCaret = offsets
  hasSavedPromptCaret = true
}

function onRefMouseDown() {
  capturePromptCaret()
}

function resolveInsertCaret(textLen: number): { start: number; end: number } {
  if (hasSavedPromptCaret) {
    const start = Math.max(0, Math.min(savedPromptCaret.start, textLen))
    const end = Math.max(start, Math.min(savedPromptCaret.end, textLen))
    return { start, end }
  }
  return { start: textLen, end: textLen }
}

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

const workflowDisabled = computed(() => props.workflowDisabled ?? previewList.value.length > 1)

watch(workflowDisabled, (disabled) => {
  if (!disabled || !selectedWorkFlow.value) return
  selectedWorkFlow.value = ''
  emitSettings()
})

function resolveMarkPreviewUrl(mark: ImageMarkItem) {
  const resolved = props.resolveMarkPreviewUrl?.(mark)
  if (resolved) return resolved
  const ref = previewList.value.find((item) => item.nodeId === mark.sourceNodeId)
  return ref?.previewUrl || props.previewUrl || ''
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

onMounted(() => {
  bindMarkLabelMenuDocumentClose()
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  nextTick(() => {
    syncPromptView()
    stripMarkMentionsFromPrompt()
  })
})

onBeforeUnmount(() => {
  unbindMarkLabelMenuDocumentClose()
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
})

const mentionApi = createPromptMentionApi('image-dialogue__mention', {
  resolveMention: resolveMarkMentionMetaForPrompt,
})

const hoveredThumb = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const {
  isDragOver,
  onDragEnter: onDialogueDragEnter,
  onDragOver: onDialogueDragOver,
  onDragLeave: onDialogueDragLeave,
  onDrop: onDialogueDrop,
  openFilePicker,
  onFileInputChange,
} = useCanvasImageDropUpload({
  fileInputRef,
  onAddCanvasNode: (nodeId) => emit('add-canvas-node', nodeId),
  onUploadImages: (files) => emit('upload-images', files),
})
const showStyleModal = ref(false)
const showGenSettings = ref(false)
const showModelMenu = ref(false)
const showCountMenu = ref(false)
const genAspectRatio = ref('')
const genResolution = ref('')
const genImageCount = ref(1)
const selectedModelKey = ref(
  resolveImageDialogueModelKey(IMAGE_DIALOGUE_MODEL_MENU[0].key, null),
)
const selectedWorkFlow = ref('')
const { translating, onTranslatePrompt } = usePromptTranslate({
  getText: () => props.modelValue,
  onTranslated: (translated) => {
    emitPrompt(translated)
    nextTick(() => syncPromptView(translated))
  },
})
const { estimatedCreditsLabel } = useImageDialoguePointEstimate({
  modelKey: selectedModelKey,
  aspectRatio: genAspectRatio,
  resolution: genResolution,
  imageCount: genImageCount,
  prompt: () => props.modelValue,
  elementMarks: () => props.elementMarks,
  chatTools: () => props.chatTools,
})
let skipSettingsWatch = false

function buildSettingsFromRefs(): ImageDialogueSettings {
  return {
    aspectRatio: genAspectRatio.value,
    resolution: genResolution.value,
    imageCount: genImageCount.value,
    modelKey: selectedModelKey.value,
    workflowId: selectedWorkFlow.value,
  }
}

function getSettingsSignature(settings: Partial<ImageDialogueSettings>) {
  return [
    settings.workflowId ?? '',
    settings.modelKey ?? '',
    settings.aspectRatio ?? '',
    settings.resolution ?? '',
    settings.imageCount ?? '',
  ].join('|')
}

/** 按 chatTools 列表第一项回填宽高比 / 分辨率 / 张数 */
function applyApiListDefaults(options?: {
  modelKey?: string
  workflowId?: string
  emit?: boolean
}) {
  const normalized = normalizeImageDialogueSettingsForModel(
    pickImageDialogueSettingsInput({
      modelKey: options?.modelKey ?? selectedModelKey.value,
      workflowId: options?.workflowId ?? selectedWorkFlow.value,
    }),
    props.chatTools,
  )
  skipSettingsWatch = true
  genAspectRatio.value = normalized.aspectRatio
  genResolution.value = normalized.resolution
  genImageCount.value = normalized.imageCount
  selectedModelKey.value = normalized.modelKey
  nextTick(() => {
    skipSettingsWatch = false
    if (options?.emit !== false) {
      emitSettings()
    }
  })
}

function applyExternalSettings(settings: ImageDialogueSettings) {
  const normalized = normalizeImageDialogueSettingsForModel(
    pickImageDialogueSettingsInput(settings),
    props.chatTools,
  )
  skipSettingsWatch = true
  selectedWorkFlow.value = normalized.workflowId ?? ''
  genAspectRatio.value = normalized.aspectRatio
  genResolution.value = normalized.resolution
  genImageCount.value = normalized.imageCount
  selectedModelKey.value = normalized.modelKey
  nextTick(() => {
    skipSettingsWatch = false
  })
}

function emitSettings() {
  if (skipSettingsWatch) return
  emit('update:settings', buildSettingsFromRefs())
}

function hasCompletedElementMarks() {
  return hasCompletedImageMarks(props.elementMarks)
}

/** 标记只采坐标钉点，不请求 AI 识别 */
function onToggleMark() {
  emit('toggle-mark', { coordinateOnly: true })
}

function onWorkflowChange(workflowId: string | undefined) {
  selectedWorkFlow.value = workflowId ?? ''
  if (props.hideWorkflowAndMark) return
  const workflow = workflowOptions.value.find((item) => item.id === workflowId)
  if (isMyModelWorkflow(workflow)) return
  if (!workflowId || hasCompletedElementMarks() || props.elementSelectMode) return
  // 工作流选点：只采坐标钉点，不触发 AI 识别
  emit('toggle-mark', { coordinateOnly: true })
}

function onDigitalHumanSelect(item: DigitalHumanPickerItem) {
  if (!item.assetId || !item.previewUrl) return
  emit('add-digital-human-ref', {
    assetId: item.assetId,
    previewUrl: item.previewUrl,
  })
}

watch(
  () => [props.settings, props.chatTools] as const,
  ([settings, chatTools]) => {
    if (!chatTools) return
    const incoming = getSettingsSignature(settings)
    const current = getSettingsSignature(buildSettingsFromRefs())
    if (incoming === current) return
    applyExternalSettings(settings)
  },
  { deep: true, immediate: true },
)

watch([genAspectRatio, genResolution, genImageCount, selectedModelKey, selectedWorkFlow], () => {
  emitSettings()
})

const workflowOptions = computed(() => buildImageWorkflowOptions(props.workflows))
const workflowOptionGroups = computed(() => buildImageWorkflowOptionGroups(props.workflows))

const selectedWorkflowRecord = computed(() =>
  workflowOptions.value.find((workflow) => workflow.id === selectedWorkFlow.value),
)

const modelMenu = computed(() =>
  buildImageDialogueModelsFromCapabilities(props.chatTools),
)
const selectedModelName = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.name ??
    modelMenu.value[0]?.name ??
    IMAGE_DIALOGUE_MODEL_MENU[0].name,
)
const selectedModelIcon = computed(
  () =>
    modelMenu.value.find((model) => model.key === selectedModelKey.value)?.icon ??
    modelMenu.value[0]?.icon ??
    IMAGE_DIALOGUE_MODEL_MENU[0].icon,
)

const qualityLabel = computed(() => {
  const aspectLabel = genAspectRatio.value === 'auto' ? '自适应' : genAspectRatio.value
  return `${aspectLabel} · ${genResolution.value} · x${genImageCount.value}`
})

watch(
  () => selectedModelKey.value,
  () => {
    if (skipSettingsWatch) return
    applyApiListDefaults()
  },
)

watch(
  workflowOptions,
  (options) => {
    if (!options.length) {
      if (selectedWorkFlow.value) {
        selectedWorkFlow.value = ''
        emitSettings()
      }
      return
    }
    if (
      selectedWorkFlow.value &&
      !options.some((workflow) => workflow.id === selectedWorkFlow.value)
    ) {
      selectedWorkFlow.value = ''
      emitSettings()
    }
  },
  { immediate: true },
)

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

  const offsets = mentionApi.getSelectionPlainOffsets(el)
  const start = offsets?.start ?? (hasSavedPromptCaret ? savedPromptCaret.start : text.length)
  const end = offsets?.end ?? (hasSavedPromptCaret ? savedPromptCaret.end : start)

  mentionApi.renderPromptToEl(el, text)
  mentionApi.setPlainTextSelection(el, start, end)
  savedPromptCaret = { start, end }
  hasSavedPromptCaret = true
}

function insertMentionToken(token: string) {
  if (!token) return

  const el = promptInputRef.value
  const current = el ? mentionApi.serializePromptEl(el) : props.modelValue
  const caret = resolveInsertCaret(current.length)
  const { nextText, nextCaret } = buildPromptWithMentionInsert({
    text: current,
    token,
    start: caret.start,
    end: caret.end,
  })

  if (!el) {
    emitPrompt(nextText)
    savedPromptCaret = { start: nextCaret, end: nextCaret }
    hasSavedPromptCaret = true
    return
  }

  // 始终按缓存偏移拼接，不信任 focus 后的 live selection（易跳到开头/末尾）
  suppressCaretCapture = true
  try {
    mentionApi.renderPromptToEl(el, nextText)
    el.focus({ preventScroll: true })
    mentionApi.setPlainTextSelection(el, nextCaret, nextCaret)
    savedPromptCaret = { start: nextCaret, end: nextCaret }
    hasSavedPromptCaret = true
    emitPrompt(nextText)
  } finally {
    requestAnimationFrame(() => {
      suppressCaretCapture = false
    })
  }
}

function insertRefMention(index: number) {
  insertMentionToken(`@图片${index}`)
}

function stripMarkMentionsFromPrompt() {
  const marks = props.elementMarks ?? []
  let text = props.modelValue
  for (const mark of marks) {
    const tokens = [mark.mentionToken, `@标记#${mark.id}`].filter(Boolean)
    for (const token of tokens) {
      text = text.split(token).join('')
    }
  }
  text = text.replace(/@标记#[^\s@]+(?:：[^\s@]+)?/g, '').replace(/\s{2,}/g, ' ').trim()
  if (text === props.modelValue) return
  emitPrompt(text)
  nextTick(() => syncPromptView(text))
}

function onPromptClick(event: MouseEvent) {
  const el = promptInputRef.value
  if (!el) return
  const mention = (event.target as HTMLElement).closest('.image-dialogue__mention--mark-switchable') as HTMLElement | null
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
  if (!mentionApi.needsMentionRerender(el)) return
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

  const sel = window.getSelection()
  if (!sel?.rangeCount) return

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

watch(
  () => props.modelValue,
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

function selectModel(model: ImageDialogueModelItem) {
  selectedModelKey.value = model.key
  showModelMenu.value = false
}

function onSend() {
  const prompt = props.modelValue.trim()
  if (!canSubmitImageDialogueTask(prompt, props.elementMarks)) {
    message.warning('请输入提示词或标记需要识别的商品位置')
    return
  }

  const payload: ImageDialogueSubmitPayload = {
    prompt,
    model: resolveImageDialogueModelApiValue(selectedModelKey.value, props.chatTools),
    aspectRatio: genAspectRatio.value,
    count: genImageCount.value,
    resolution: genResolution.value,
    workflowId: selectedWorkflowRecord.value?.id,
    workflow: selectedWorkflowRecord.value,
  }
  emit('submit', payload)
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

</script>

<style scoped lang="scss" src="./ImageDialoguePanel.scss"></style>
